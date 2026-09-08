import { env } from "cloudflare:workers";
import { authorize, canAccessCampus } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../lib/security";

export const dynamic = "force-dynamic";
const clean = (value: unknown, max = 1000) => String(value ?? "").trim().slice(0, max);
const validDate = /^\d{4}-\d{2}-\d{2}$/;

async function ownedTarget(auth: NonNullable<Awaited<ReturnType<typeof authorize>>>, campusId: string, academicYearId: string, classId: string, sectionId: string | null, subjectId: string) {
  if (!canAccessCampus(auth, campusId)) return false;
  const row = await env.DB.prepare(`SELECT cl.id FROM classes cl JOIN academic_years y ON y.id=?2 AND y.organization_id=cl.organization_id JOIN subjects sub ON sub.id=?3 AND sub.organization_id=cl.organization_id LEFT JOIN sections sec ON sec.id=?4 AND sec.class_id=cl.id AND sec.organization_id=cl.organization_id WHERE cl.id=?1 AND cl.organization_id=?5 AND cl.campus_id=?6 AND cl.academic_year_id=?2 AND (?4 IS NULL OR sec.id IS NOT NULL)`).bind(classId, academicYearId, subjectId, sectionId, auth.organizationId, campusId).first();
  return !!row;
}

async function ownedResourceTarget(auth: NonNullable<Awaited<ReturnType<typeof authorize>>>, campusId: string | null, academicYearId: string | null, classId: string | null, sectionId: string | null, subjectId: string | null) {
  if (campusId && !canAccessCampus(auth, campusId)) return false;
  const checks: Promise<unknown>[] = [];
  if (academicYearId) checks.push(env.DB.prepare("SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2").bind(academicYearId, auth.organizationId).first());
  if (classId) checks.push(env.DB.prepare("SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (?3 IS NULL OR campus_id=?3)").bind(classId, auth.organizationId, campusId).first());
  if (sectionId) checks.push(env.DB.prepare("SELECT id FROM sections WHERE id=?1 AND organization_id=?2 AND (?3 IS NULL OR campus_id=?3) AND (?4 IS NULL OR class_id=?4)").bind(sectionId, auth.organizationId, campusId, classId).first());
  if (subjectId) checks.push(env.DB.prepare("SELECT id FROM subjects WHERE id=?1 AND organization_id=?2").bind(subjectId, auth.organizationId).first());
  return (await Promise.all(checks)).every(Boolean);
}

export async function GET() {
  const auth = await authorize("learning.view");
  if (!auth) return Response.json({ error: "You do not have permission to view learning resources." }, { status: 403 });
  const campusWhere = auth.activeCampusId ? " AND x.campus_id=?2" : "";
  const bind = (statement: D1PreparedStatement) => auth.activeCampusId ? statement.bind(auth.organizationId, auth.activeCampusId) : statement.bind(auth.organizationId);
  const [resources, assignments, years, classes, sections, subjects] = await Promise.all([
    bind(env.DB.prepare(`SELECT x.*,c.name campus_name,y.name academic_year_name,cl.name class_name,se.name section_name,s.name subject_name FROM learning_resources x LEFT JOIN campuses c ON c.id=x.campus_id LEFT JOIN academic_years y ON y.id=x.academic_year_id LEFT JOIN classes cl ON cl.id=x.class_id LEFT JOIN sections se ON se.id=x.section_id LEFT JOIN subjects s ON s.id=x.subject_id WHERE x.organization_id=?1${campusWhere} ORDER BY x.created_at DESC LIMIT 200`)).all(),
    bind(env.DB.prepare(`SELECT x.*,c.name campus_name,y.name academic_year_name,cl.name class_name,se.name section_name,s.name subject_name,(SELECT count(*) FROM assignment_resources ar WHERE ar.assignment_id=x.id) resource_count FROM assignments x JOIN campuses c ON c.id=x.campus_id JOIN academic_years y ON y.id=x.academic_year_id JOIN classes cl ON cl.id=x.class_id LEFT JOIN sections se ON se.id=x.section_id JOIN subjects s ON s.id=x.subject_id WHERE x.organization_id=?1${campusWhere} ORDER BY CASE x.status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,x.due_at DESC LIMIT 200`)).all(),
    env.DB.prepare("SELECT id,name,is_current FROM academic_years WHERE organization_id=?1 AND status='active' ORDER BY starts_on DESC").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT id,name,campus_id,academic_year_id FROM classes WHERE organization_id=?1 AND status='active' ORDER BY sort_order,name").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT id,name,class_id,campus_id FROM sections WHERE organization_id=?1 AND status='active' ORDER BY name").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT id,name,code FROM subjects WHERE organization_id=?1 AND status='active' ORDER BY name").bind(auth.organizationId).all(),
  ]);
  return Response.json({ resources: resources.results, assignments: assignments.results, academicYears: years.results, classes: classes.results, sections: sections.results, subjects: subjects.results, campuses: auth.campuses, activeCampusId: auth.activeCampusId, canManageResources: auth.permissions.has("resources.manage"), canManageAssignments: auth.permissions.has("assignments.manage") }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const kind = clean(body?.kind, 20);
  const permission = kind === "resource" ? "resources.manage" : "assignments.manage";
  const auth = await authorize(permission);
  if (!auth) return Response.json({ error: "You do not have permission for this action." }, { status: 403 });
  if (!await enforceRateLimit(auth, `learning.${kind}.create`, 40, 300)) return Response.json({ error: "Too many changes. Try again shortly." }, { status: 429 });
  const id = crypto.randomUUID(), title = clean(body?.title, 160), campusId = clean(body?.campusId, 80) || auth.activeCampusId || "", academicYearId = clean(body?.academicYearId, 80), classId = clean(body?.classId, 80), sectionId = clean(body?.sectionId, 80) || null, subjectId = clean(body?.subjectId, 80), status = body?.status === "published" ? "published" : "draft", now = Date.now();
  if (!title) return Response.json({ error: "Enter a title." }, { status: 400 });
  if (kind === "resource") {
    if (!(await ownedResourceTarget(auth, campusId || null, academicYearId || null, classId || null, sectionId, subjectId || null))) return Response.json({ error: "One or more resource targets are not available in this school or campus." }, { status: 403 });
    const externalUrl = clean(body?.externalUrl, 1200);
    if (externalUrl && !/^https?:\/\//i.test(externalUrl)) return Response.json({ error: "Resource link must start with http:// or https://." }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare("INSERT INTO learning_resources (id,organization_id,campus_id,academic_year_id,class_id,section_id,subject_id,title,description,resource_type,external_url,status,published_at,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)").bind(id, auth.organizationId, campusId || null, academicYearId || null, classId || null, sectionId, subjectId || null, title, clean(body?.description, 2000) || null, externalUrl ? "link" : "note", externalUrl || null, status, status === "published" ? now : null, auth.userId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'learning.resource.create','learning_resource',?5,'success')").bind(crypto.randomUUID(), auth.organizationId, campusId || null, auth.userId, id),
    ]);
  } else if (kind === "assignment") {
    const assignedOn = clean(body?.assignedOn, 10), dueAt = body?.dueAt ? Date.parse(String(body.dueAt)) : null, maxPoints = Number(body?.maxPoints ?? 100);
    if (!campusId || !academicYearId || !classId || !subjectId || !validDate.test(assignedOn) || !(maxPoints > 0 && maxPoints <= 10000) || !(await ownedTarget(auth, campusId, academicYearId, classId, sectionId, subjectId))) return Response.json({ error: "Choose a valid campus, year, class, optional section, subject, assigned date and points." }, { status: 400 });
    const resourceId = clean(body?.resourceId, 80) || null;
    const statements = [
      env.DB.prepare("INSERT INTO assignments (id,organization_id,campus_id,academic_year_id,class_id,section_id,subject_id,title,instructions,assigned_on,due_at,max_points,status,published_at,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)").bind(id, auth.organizationId, campusId, academicYearId, classId, sectionId, subjectId, title, clean(body?.instructions, 4000) || null, assignedOn, Number.isFinite(dueAt) ? dueAt : null, maxPoints, status, status === "published" ? now : null, auth.userId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'learning.assignment.create','assignment',?5,'success')").bind(crypto.randomUUID(), auth.organizationId, campusId, auth.userId, id),
    ];
    if (resourceId) statements.push(env.DB.prepare("INSERT INTO assignment_resources (assignment_id,resource_id) SELECT ?1,id FROM learning_resources WHERE id=?2 AND organization_id=?3").bind(id, resourceId, auth.organizationId));
    await env.DB.batch(statements);
  } else return Response.json({ error: "Invalid learning item type." }, { status: 400 });
  return Response.json({ ok: true, id });
}

export async function PATCH(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const kind = clean(body?.kind, 20), id = clean(body?.id, 80), status = clean(body?.status, 20);
  const auth = await authorize(kind === "resource" ? "resources.manage" : "assignments.manage");
  if (!auth || !id || !["draft", "published", "closed"].includes(status)) return Response.json({ error: "Invalid or unauthorized status change." }, { status: 403 });
  const table = kind === "resource" ? "learning_resources" : "assignments";
  const campusClause = auth.activeCampusId ? " AND campus_id=?5" : "";
  const statement = env.DB.prepare(`UPDATE ${table} SET status=?1,published_at=CASE WHEN ?1='published' THEN COALESCE(published_at,?2) ELSE published_at END,updated_at=?2 WHERE id=?3 AND organization_id=?4${campusClause}`);
  const result = auth.activeCampusId ? await statement.bind(status, Date.now(), id, auth.organizationId, auth.activeCampusId).run() : await statement.bind(status, Date.now(), id, auth.organizationId).run();
  if (!result.meta.changes) return Response.json({ error: "Item not found." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const origin = requireSameOrigin(request); if (origin) return origin;
  const url = new URL(request.url), kind = clean(url.searchParams.get("kind"), 20), id = clean(url.searchParams.get("id"), 80);
  const auth = await authorize(kind === "resource" ? "resources.manage" : "assignments.manage");
  if (!auth || !id) return Response.json({ error: "Permission denied." }, { status: 403 });
  const table = kind === "resource" ? "learning_resources" : "assignments";
  const campusClause = auth.activeCampusId ? " AND campus_id=?3" : "";
  const statement = env.DB.prepare(`DELETE FROM ${table} WHERE id=?1 AND organization_id=?2${campusClause}`);
  const result = auth.activeCampusId ? await statement.bind(id, auth.organizationId, auth.activeCampusId).run() : await statement.bind(id, auth.organizationId).run();
  return Response.json({ ok: true, deleted: result.meta.changes });
}
