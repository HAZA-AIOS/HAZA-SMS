import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../lib/security";

export const dynamic = "force-dynamic";
const clean = (value: unknown, length = 80) => typeof value === "string" ? value.trim().slice(0, length) : "";
const checked = (value: unknown) => value === true || value === "true" || value === "on";

export async function POST(request: Request) {
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth = await authorize("academic_years.manage");
  if (!auth) return Response.json({ error: "You do not have permission to manage academic years." }, { status: 403 });
  if(!await enforceRateLimit(auth,"academic_year.create",10,300))return Response.json({error:"Too many academic-year changes. Try again later."},{status:429});
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = clean(body?.name), startsOn = clean(body?.startsOn, 10), endsOn = clean(body?.endsOn, 10);
  const isCurrent = checked(body?.isCurrent);
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn) || startsOn >= endsOn) {
    return Response.json({ error: "Enter a valid name and date range." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const statements = [];
  if (isCurrent) statements.push(env.DB.prepare("UPDATE academic_years SET is_current=0,status=CASE WHEN status='active' THEN 'closed' ELSE status END,updated_at=unixepoch()*1000 WHERE organization_id=?1").bind(auth.organizationId));
  statements.push(
    env.DB.prepare("INSERT INTO academic_years (id,organization_id,name,starts_on,ends_on,is_current,status) VALUES (?1,?2,?3,?4,?5,?6,?7)").bind(id, auth.organizationId, name, startsOn, endsOn, isCurrent ? 1 : 0, isCurrent ? "active" : "draft"),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'academic_year.create','academic_year',?4,'success')").bind(crypto.randomUUID(), auth.organizationId, auth.userId, id),
  );
  try { await env.DB.batch(statements); return Response.json({ ok: true }); }
  catch { return Response.json({ error: "An academic year with this name already exists." }, { status: 409 }); }
}

export async function PUT(request: Request) {
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth = await authorize("academic_years.manage");
  if (!auth) return Response.json({ error: "You do not have permission to manage academic years." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = clean(body?.academicYearId);
  const year = await env.DB.prepare("SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2").bind(id, auth.organizationId).first();
  if (!year) return Response.json({ error: "Academic year not found." }, { status: 404 });
  await env.DB.batch([
    env.DB.prepare("UPDATE academic_years SET is_current=0,status=CASE WHEN status='active' THEN 'closed' ELSE status END,updated_at=unixepoch()*1000 WHERE organization_id=?1").bind(auth.organizationId),
    env.DB.prepare("UPDATE academic_years SET is_current=1,status='active',updated_at=unixepoch()*1000 WHERE id=?1 AND organization_id=?2").bind(id, auth.organizationId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'academic_year.set_current','academic_year',?4,'success')").bind(crypto.randomUUID(), auth.organizationId, auth.userId, id),
  ]);
  return Response.json({ ok: true });
}
