import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin, safeMetadata } from "../../../lib/security";
import { runOperationalCheck } from "../../../lib/monitoring";

export const dynamic = "force-dynamic";
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const sources = new Set(["platform", "automation", "database", "storage", "deployment", "security", "backup", "manual"]);
const severities = new Set(["critical", "high", "medium", "low"]);

export async function GET() {
  const auth = await authorize("monitoring.view");
  if (!auth || !auth.organizationWide)
    return Response.json({ error: "You do not have permission to view production monitoring." }, { status: 403 });
  const since = Date.now() - 86400000;
  const [checks, incidents, failedOperations, lastBackup, policy] = await Promise.all([
    env.DB.prepare("SELECT r.*,u.display_name triggered_by_name FROM operational_check_runs r JOIN users u ON u.id=r.triggered_by WHERE r.organization_id=?1 ORDER BY r.created_at DESC LIMIT 30").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT i.*,creator.display_name created_by_name,ack.display_name acknowledged_by_name,resolver.display_name resolved_by_name FROM monitoring_incidents i JOIN users creator ON creator.id=i.created_by LEFT JOIN users ack ON ack.id=i.acknowledged_by LEFT JOIN users resolver ON resolver.id=i.resolved_by WHERE i.organization_id=?1 ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,i.updated_at DESC LIMIT 100").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT count(*) value FROM audit_logs WHERE organization_id=?1 AND created_at>=?2 AND outcome!='success'").bind(auth.organizationId, since).first<{value:number}>(),
    env.DB.prepare("SELECT max(completed_at) value FROM backup_runs WHERE organization_id=?1 AND status='completed'").bind(auth.organizationId).first<{value:number|null}>(),
    env.DB.prepare("SELECT enabled,interval_minutes,failure_threshold,notify_recovery,last_evaluated_at,last_result FROM operational_automation_policies WHERE organization_id=?1").bind(auth.organizationId).first(),
  ]);
  return Response.json({
    checks: checks.results,
    incidents: incidents.results,
    summary: { failedOperations24h: failedOperations?.value ?? 0, lastBackupAt: lastBackup?.value ?? null },
    policy: policy ?? { enabled:0, interval_minutes:15, failure_threshold:2, notify_recovery:1, last_evaluated_at:null, last_result:null },
    canManage: auth.permissions.has("monitoring.manage"),
  }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const sameOrigin = requireSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const auth = await authorize("monitoring.manage");
  if (!auth || !auth.organizationWide)
    return Response.json({ error: "You do not have permission to manage production monitoring." }, { status: 403 });
  if (!(await enforceRateLimit(auth, "monitoring.change", 30, 300)))
    return Response.json({ error: "Too many monitoring changes. Try again shortly." }, { status: 429 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = clean(body?.action, 30);

  if (action === "run_check") {
    const result=await runOperationalCheck({organizationId:auth.organizationId,operatorUserId:auth.userId,triggerType:"manual"});
    return Response.json({ ok:true,id:result.id,status:result.status }, { status:result.status==="ready"?200:503 });
  }

  if(action==="update_policy"){
    const enabled=body?.enabled===true?1:0,interval=Number(body?.intervalMinutes),threshold=Number(body?.failureThreshold),notifyRecovery=body?.notifyRecovery!==false?1:0;
    if(![5,15,30,60].includes(interval)||![1,2,3].includes(threshold))return Response.json({error:"Choose a supported interval and failure threshold."},{status:400});
    await env.DB.batch([
      env.DB.prepare("INSERT INTO operational_automation_policies (id,organization_id,enabled,interval_minutes,failure_threshold,notify_recovery,updated_by) VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(organization_id) DO UPDATE SET enabled=excluded.enabled,interval_minutes=excluded.interval_minutes,failure_threshold=excluded.failure_threshold,notify_recovery=excluded.notify_recovery,updated_by=excluded.updated_by,updated_at=unixepoch()*1000").bind(crypto.randomUUID(),auth.organizationId,enabled,interval,threshold,notifyRecovery,auth.userId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'monitoring.policy.update','operational_automation_policy',?2,'success',?4)").bind(crypto.randomUUID(),auth.organizationId,auth.userId,safeMetadata({enabled:Boolean(enabled),intervalMinutes:interval,failureThreshold:threshold,notifyRecovery:Boolean(notifyRecovery)})),
    ]);
    return Response.json({ok:true});
  }

  if (action === "create_incident") {
    const title = clean(body?.title, 180), description = clean(body?.description, 2000);
    const source = clean(body?.source, 30), severity = clean(body?.severity, 20);
    if (!title || !sources.has(source) || !severities.has(severity))
      return Response.json({ error: "Enter a title and choose a valid source and severity." }, { status: 400 });
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO monitoring_incidents (id,organization_id,source,severity,status,title,description,created_by) VALUES (?1,?2,?3,?4,'open',?5,?6,?7)").bind(id, auth.organizationId, source, severity, title, description || null, auth.userId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'monitoring.incident.create','monitoring_incident',?4,'success',?5)").bind(crypto.randomUUID(), auth.organizationId, auth.userId, id, safeMetadata({ source, severity })),
    ]);
    return Response.json({ ok: true, id });
  }

  if (action === "acknowledge_incident" || action === "resolve_incident") {
    const id = clean(body?.id, 80), note = clean(body?.note, 2000);
    const incident = await env.DB.prepare("SELECT id,status FROM monitoring_incidents WHERE id=?1 AND organization_id=?2").bind(id, auth.organizationId).first<{id:string;status:string}>();
    if (!incident) return Response.json({ error: "Incident not found." }, { status: 404 });
    if (incident.status === "resolved") return Response.json({ error: "This incident is already resolved." }, { status: 409 });
    if (action === "resolve_incident" && !note) return Response.json({ error: "Add a resolution note before resolving the incident." }, { status: 400 });
    const resolving = action === "resolve_incident";
    await env.DB.batch([
      resolving
        ? env.DB.prepare("UPDATE monitoring_incidents SET status='resolved',resolved_by=?1,resolved_at=unixepoch()*1000,resolution_note=?2,updated_at=unixepoch()*1000 WHERE id=?3 AND organization_id=?4").bind(auth.userId, note, id, auth.organizationId)
        : env.DB.prepare("UPDATE monitoring_incidents SET status='acknowledged',acknowledged_by=?1,acknowledged_at=unixepoch()*1000,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(auth.userId, id, auth.organizationId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'monitoring_incident',?5,'success',?6)").bind(crypto.randomUUID(), auth.organizationId, auth.userId, resolving ? "monitoring.incident.resolve" : "monitoring.incident.acknowledge", id, safeMetadata({ note: resolving ? note : undefined })),
    ]);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Choose a valid monitoring action." }, { status: 400 });
}
