import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin, safeMetadata } from "../../../lib/security";

export const dynamic = "force-dynamic";
const PROBE_TIMEOUT_MS = 5000;
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const sources = new Set(["platform", "database", "storage", "deployment", "security", "backup", "manual"]);
const severities = new Set(["critical", "high", "medium", "low"]);

async function probe(check: () => Promise<boolean>) {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ready = await Promise.race([
      Promise.resolve().then(check).catch(() => false),
      new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), PROBE_TIMEOUT_MS); }),
    ]);
    return { ready, latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const auth = await authorize("monitoring.view");
  if (!auth || !auth.organizationWide)
    return Response.json({ error: "You do not have permission to view production monitoring." }, { status: 403 });
  const since = Date.now() - 86400000;
  const [checks, incidents, failedOperations, lastBackup] = await Promise.all([
    env.DB.prepare("SELECT r.*,u.display_name triggered_by_name FROM operational_check_runs r JOIN users u ON u.id=r.triggered_by WHERE r.organization_id=?1 ORDER BY r.created_at DESC LIMIT 30").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT i.*,creator.display_name created_by_name,ack.display_name acknowledged_by_name,resolver.display_name resolved_by_name FROM monitoring_incidents i JOIN users creator ON creator.id=i.created_by LEFT JOIN users ack ON ack.id=i.acknowledged_by LEFT JOIN users resolver ON resolver.id=i.resolved_by WHERE i.organization_id=?1 ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,i.updated_at DESC LIMIT 100").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT count(*) value FROM audit_logs WHERE organization_id=?1 AND created_at>=?2 AND outcome!='success'").bind(auth.organizationId, since).first<{value:number}>(),
    env.DB.prepare("SELECT max(completed_at) value FROM backup_runs WHERE organization_id=?1 AND status='completed'").bind(auth.organizationId).first<{value:number|null}>(),
  ]);
  return Response.json({
    checks: checks.results,
    incidents: incidents.results,
    summary: { failedOperations24h: failedOperations?.value ?? 0, lastBackupAt: lastBackup?.value ?? null },
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
    const [database, storage] = await Promise.all([
      probe(async () => (await env.DB.prepare("SELECT 1 AS ready").first<{ready:number}>())?.ready === 1),
      probe(async () => { await env.BUCKET.head("__health_probe__"); return true; }),
    ]);
    const status = database.ready && storage.ready ? "ready" : "degraded";
    const id = crypto.randomUUID();
    const statements = [
      env.DB.prepare("INSERT INTO operational_check_runs (id,organization_id,status,application_status,database_status,storage_status,database_latency_ms,storage_latency_ms,triggered_by,details_json) VALUES (?1,?2,?3,'ready',?4,?5,?6,?7,?8,?9)").bind(id, auth.organizationId, status, database.ready ? "ready" : "unavailable", storage.ready ? "ready" : "unavailable", database.latencyMs, storage.latencyMs, auth.userId, safeMetadata({ probeTimeoutMs: PROBE_TIMEOUT_MS })),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'monitoring.check.run','operational_check_run',?4,?5,?6)").bind(crypto.randomUUID(), auth.organizationId, auth.userId, id, status === "ready" ? "success" : "failed", safeMetadata({ database: database.ready, storage: storage.ready })),
    ];
    if (status === "degraded") {
      const existing = await env.DB.prepare("SELECT id FROM monitoring_incidents WHERE organization_id=?1 AND source='platform' AND status!='resolved' LIMIT 1").bind(auth.organizationId).first<{id:string}>();
      if (!existing) statements.push(env.DB.prepare("INSERT INTO monitoring_incidents (id,organization_id,source,severity,status,title,description,created_by) VALUES (?1,?2,'platform','critical','open','Production service check degraded',?3,?4)").bind(crypto.randomUUID(), auth.organizationId, `Database: ${database.ready ? "ready" : "unavailable"}; storage: ${storage.ready ? "ready" : "unavailable"}.`, auth.userId));
    }
    await env.DB.batch(statements);
    return Response.json({ ok: true, id, status }, { status: status === "ready" ? 200 : 503 });
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
