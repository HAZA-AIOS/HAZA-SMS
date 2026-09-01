import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin, safeMetadata } from "../../../lib/security";

export const dynamic = "force-dynamic";
const clean = (v: unknown, n = 500) => typeof v === "string" ? v.trim().slice(0, n) : "";

export async function GET(request: Request) {
  const auth = await authorize("examinations.view");
  if (!auth) return Response.json({ error: "You do not have permission to view results." }, { status: 403 });
  const campusId = auth.activeCampusId ?? auth.campuses[0]?.id;
  if (!campusId) return Response.json({ error: "Select an active campus." }, { status: 400 });
  const denied = await requireCampusAccess(auth, campusId, "results.view");
  if (denied) return denied;
  const assessmentId = new URL(request.url).searchParams.get("assessmentId")?.slice(0, 80) || "";
  const assessments = await env.DB.prepare(`
    SELECT a.*,c.name class_name,se.name section_name,s.name subject_name,t.name term_name,y.name academic_year_name,
      u1.display_name submitted_by_name,u2.display_name approved_by_name,u3.display_name published_by_name,
      count(m.id) marked_count,sum(CASE WHEN m.is_passing=1 THEN 1 ELSE 0 END) passed_count,
      sum(CASE WHEN m.is_absent=1 THEN 1 ELSE 0 END) absent_count,round(avg(m.percentage),2) class_average
    FROM assessments a JOIN classes c ON c.id=a.class_id LEFT JOIN sections se ON se.id=a.section_id
    JOIN subjects s ON s.id=a.subject_id LEFT JOIN academic_terms t ON t.id=a.term_id JOIN academic_years y ON y.id=a.academic_year_id
    LEFT JOIN users u1 ON u1.id=a.submitted_by LEFT JOIN users u2 ON u2.id=a.approved_by LEFT JOIN users u3 ON u3.id=a.published_by
    LEFT JOIN assessment_marks m ON m.assessment_id=a.id AND m.organization_id=a.organization_id
    WHERE a.organization_id=?1 AND a.campus_id=?2 GROUP BY a.id ORDER BY a.assessment_date DESC,a.title
  `).bind(auth.organizationId, campusId).all();
  let roster: unknown[] = [];
  if (assessmentId) {
    const owned = assessments.results.some((v) => String(v.id) === assessmentId);
    if (!owned) return Response.json({ error: "Assessment not found in this campus." }, { status: 404 });
    roster = (await env.DB.prepare(`
      SELECT m.student_id,s.admission_number,s.first_name,s.last_name,e.roll_number,m.obtained_marks,m.percentage,m.grade_label,m.is_passing,m.is_absent,m.teacher_remarks
      FROM assessment_marks m JOIN students s ON s.id=m.student_id AND s.organization_id=m.organization_id
      JOIN enrollments e ON e.id=m.enrollment_id AND e.organization_id=m.organization_id
      WHERE m.organization_id=?1 AND m.campus_id=?2 AND m.assessment_id=?3
      ORDER BY CAST(e.roll_number AS INTEGER),s.first_name,s.last_name
    `).bind(auth.organizationId, campusId, assessmentId).all()).results;
  }
  return Response.json({
    campusId, assessments: assessments.results, roster,
    canApprove: auth.permissions.has("results.approve"),
    canPublish: auth.permissions.has("results.publish"),
    canPrint: auth.permissions.has("result_cards.print"),
  }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  const same = requireSameOrigin(request); if (same) return same;
  const auth = await authorize();
  if (!auth) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (!(await enforceRateLimit(auth, "results.workflow.change", 50, 300))) return Response.json({ error: "Too many changes. Try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = clean(body?.action, 30), assessmentId = clean(body?.assessmentId, 80), campusId = clean(body?.campusId, 80), remarks = clean(body?.remarks) || null;
  const permission = action === "submit" ? "marks.enter" : action === "approve" || action === "return" ? "results.approve" : "results.publish";
  if (!auth.permissions.has(permission)) return Response.json({ error: "You do not have permission for this result action." }, { status: 403 });
  const denied = await requireCampusAccess(auth, campusId, permission); if (denied) return denied;
  const assessment = await env.DB.prepare("SELECT a.*,count(m.id) marked_count FROM assessments a LEFT JOIN assessment_marks m ON m.assessment_id=a.id AND m.organization_id=a.organization_id WHERE a.id=?1 AND a.organization_id=?2 AND a.campus_id=?3 GROUP BY a.id")
    .bind(assessmentId, auth.organizationId, campusId).first<Record<string, unknown>>();
  if (!assessment) return Response.json({ error: "Assessment not found." }, { status: 404 });
  const transitions: Record<string, { from: string[]; to: string; fields: string }> = {
    submit: { from: ["marks_entered"], to: "submitted", fields: "submitted_by=?1,submitted_at=unixepoch()*1000" },
    approve: { from: ["submitted"], to: "approved", fields: "approved_by=?1,approved_at=unixepoch()*1000,approval_remarks=?5" },
    publish: { from: ["approved"], to: "published", fields: "published_by=?1,published_at=unixepoch()*1000" },
    unpublish: { from: ["published"], to: "approved", fields: "published_by=NULL,published_at=NULL,approval_remarks=?5" },
    return: { from: ["submitted", "approved"], to: "marks_entered", fields: "submitted_by=NULL,submitted_at=NULL,approved_by=NULL,approved_at=NULL,approval_remarks=?5" },
  };
  const transition = transitions[action];
  if (!transition || !transition.from.includes(String(assessment.status))) return Response.json({ error: `This result cannot be ${action}ed from its current status.` }, { status: 409 });
  if (action === "submit" && Number(assessment.marked_count) < 1) return Response.json({ error: "Enter and calculate student marks before submission." }, { status: 409 });
  const publicationId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`UPDATE assessments SET status=?4,${transition.fields},updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3 AND campus_id=?6`).bind(auth.userId, assessmentId, auth.organizationId, transition.to, remarks, campusId),
    env.DB.prepare("INSERT INTO result_publications (id,organization_id,campus_id,assessment_id,action,remarks,acted_by) VALUES (?1,?2,?3,?4,?5,?6,?7)").bind(publicationId, auth.organizationId, campusId, assessmentId, action, remarks, auth.userId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,?5,'assessment',?6,'success',?7)").bind(crypto.randomUUID(), auth.organizationId, campusId, auth.userId, `result.${action}`, assessmentId, safeMetadata({ from: assessment.status, to: transition.to, remarks })),
  ]);
  return Response.json({ ok: true, status: transition.to });
}
