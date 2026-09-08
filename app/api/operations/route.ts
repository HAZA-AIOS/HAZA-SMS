import { env } from "cloudflare:workers";
import { authorize, canAccessCampus } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../lib/security";

export const dynamic = "force-dynamic";
const categories = new Set(["library", "assets", "transport", "visitors", "requests", "documents", "medical", "discipline", "events"]);
const statuses = new Set(["open", "in_progress", "issued", "scheduled", "resolved", "completed", "returned", "closed", "cancelled"]);
const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

export async function GET() {
  const auth = await authorize("operations.view");
  if (!auth) return Response.json({ error: "You do not have permission to view operations." }, { status: 403 });
  const scope = auth.activeCampusId ? " AND (r.campus_id=?2 OR r.campus_id IS NULL)" : "";
  const statement = env.DB.prepare(`SELECT r.*,c.name campus_name,u.display_name created_by_name FROM operation_records r LEFT JOIN campuses c ON c.id=r.campus_id JOIN users u ON u.id=r.created_by WHERE r.organization_id=?1${scope} ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,r.updated_at DESC LIMIT 500`);
  const records = auth.activeCampusId ? await statement.bind(auth.organizationId, auth.activeCampusId).all() : await statement.bind(auth.organizationId).all();
  return Response.json({ records: records.results, campuses: auth.campuses, activeCampusId: auth.activeCampusId, canManage: auth.permissions.has("operations.manage") }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const sameOrigin = requireSameOrigin(request); if (sameOrigin) return sameOrigin;
  const auth = await authorize("operations.manage");
  if (!auth) return Response.json({ error: "You do not have permission to manage operations." }, { status: 403 });
  if (!await enforceRateLimit(auth, "operations.create", 100, 300)) return Response.json({ error: "Too many changes. Try again shortly." }, { status: 429 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const category = clean(body?.category, 30), title = clean(body?.title, 180), campusId = clean(body?.campusId, 80) || auth.activeCampusId;
  if (!categories.has(category) || !title || (campusId && !canAccessCampus(auth, campusId))) return Response.json({ error: "Enter a title and choose a valid category and campus." }, { status: 400 });
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO operation_records (id,organization_id,campus_id,category,title,reference_code,person_name,assigned_to,status,priority,due_on,quantity,amount,notes,details_json,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)").bind(id, auth.organizationId, campusId || null, category, title, clean(body?.referenceCode, 80) || null, clean(body?.personName, 160) || null, clean(body?.assignedTo, 160) || null, statuses.has(String(body?.status)) ? String(body?.status) : "open", ["low","normal","high","urgent"].includes(String(body?.priority)) ? String(body?.priority) : "normal", clean(body?.dueOn, 10) || null, Number.isFinite(Number(body?.quantity)) ? Number(body?.quantity) : null, Number.isFinite(Number(body?.amount)) ? Number(body?.amount) : null, clean(body?.notes, 3000) || null, "{}", auth.userId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'operations.record.create','operation_record',?5,'success',?6)").bind(crypto.randomUUID(), auth.organizationId, campusId || null, auth.userId, id, JSON.stringify({ category })),
  ]);
  return Response.json({ ok: true, id });
}

export async function PATCH(request: Request) {
  const sameOrigin = requireSameOrigin(request); if (sameOrigin) return sameOrigin;
  const auth = await authorize("operations.manage");
  if (!auth) return Response.json({ error: "You do not have permission to manage operations." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = clean(body?.id, 80), status = clean(body?.status, 30);
  if (!id || !statuses.has(status)) return Response.json({ error: "Choose a valid status." }, { status: 400 });
  const current = await env.DB.prepare("SELECT campus_id FROM operation_records WHERE id=?1 AND organization_id=?2").bind(id, auth.organizationId).first<{campus_id:string|null}>();
  if (!current || (current.campus_id && !canAccessCampus(auth, current.campus_id))) return Response.json({ error: "Record not found in your campus scope." }, { status: 404 });
  await env.DB.batch([
    env.DB.prepare("UPDATE operation_records SET status=?1,closed_at=CASE WHEN ?1 IN ('resolved','completed','returned','closed','cancelled') THEN unixepoch()*1000 ELSE NULL END,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(status, id, auth.organizationId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'operations.record.status','operation_record',?5,'success',?6)").bind(crypto.randomUUID(), auth.organizationId, current.campus_id, auth.userId, id, JSON.stringify({ status })),
  ]);
  return Response.json({ ok: true });
}
