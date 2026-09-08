import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../lib/authorization";

export const dynamic = "force-dynamic";
const clean = (value: string | null) => (value ?? "").trim().slice(0, 80);
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export async function GET(request: Request) {
  const auth = await authorize("examinations.view");
  if (!auth) return Response.json({ error: "You do not have permission to view examination analysis." }, { status: 403 });
  const campusId = auth.activeCampusId ?? auth.campuses[0]?.id;
  if (!campusId) return Response.json({ error: "Select an active campus." }, { status: 400 });
  const denied = await requireCampusAccess(auth, campusId, "examinations.performance.view");
  if (denied) return denied;

  const url = new URL(request.url);
  const academicYearId = clean(url.searchParams.get("academicYearId"));
  const termId = clean(url.searchParams.get("termId"));
  const classId = clean(url.searchParams.get("classId"));
  const sectionId = clean(url.searchParams.get("sectionId"));
  const subjectId = clean(url.searchParams.get("subjectId"));
  const exportCsv = url.searchParams.get("format") === "csv";
  const filters = [academicYearId, termId, classId, sectionId, subjectId];
  const where = `
    a.organization_id=?1 AND a.campus_id=?2
    AND a.status IN ('marks_entered','submitted','approved','published')
    AND (?3='' OR a.academic_year_id=?3)
    AND (?4='' OR a.term_id=?4)
    AND (?5='' OR a.class_id=?5)
    AND (?6='' OR a.section_id=?6)
    AND (?7='' OR a.subject_id=?7)`;
  const bind = (statement: D1PreparedStatement) => statement.bind(auth.organizationId, campusId, ...filters);

  const [options, summary, subjects, classes, grades, students] = await Promise.all([
    env.DB.batch([
      env.DB.prepare("SELECT id,name,is_current FROM academic_years WHERE organization_id=?1 ORDER BY starts_on DESC").bind(auth.organizationId),
      env.DB.prepare("SELECT id,name,academic_year_id FROM academic_terms WHERE organization_id=?1 ORDER BY starts_on DESC").bind(auth.organizationId),
      env.DB.prepare("SELECT id,name,academic_year_id FROM classes WHERE organization_id=?1 AND campus_id=?2 ORDER BY name").bind(auth.organizationId, campusId),
      env.DB.prepare("SELECT id,name,class_id FROM sections WHERE organization_id=?1 AND campus_id=?2 ORDER BY name").bind(auth.organizationId, campusId),
      env.DB.prepare("SELECT id,name,code FROM subjects WHERE organization_id=?1 ORDER BY name").bind(auth.organizationId),
    ]),
    bind(env.DB.prepare(`
      SELECT count(DISTINCT a.id) assessment_count,count(DISTINCT m.student_id) student_count,
        round(avg(CASE WHEN m.is_absent=0 THEN m.percentage END),2) average_percentage,
        round(100.0*sum(CASE WHEN m.is_passing=1 THEN 1 ELSE 0 END)/nullif(sum(CASE WHEN m.is_absent=0 THEN 1 ELSE 0 END),0),2) pass_rate,
        sum(CASE WHEN m.is_passing=1 THEN 1 ELSE 0 END) passed_count,
        sum(CASE WHEN m.is_passing=0 AND m.is_absent=0 THEN 1 ELSE 0 END) failed_count,
        sum(CASE WHEN m.is_absent=1 THEN 1 ELSE 0 END) absent_count
      FROM assessments a LEFT JOIN assessment_marks m ON m.assessment_id=a.id AND m.organization_id=a.organization_id
      WHERE ${where}`)).first(),
    bind(env.DB.prepare(`
      SELECT s.id subject_id,s.name subject_name,count(DISTINCT a.id) assessment_count,count(m.id) result_count,
        round(avg(CASE WHEN m.is_absent=0 THEN m.percentage END),2) average_percentage,
        round(100.0*sum(CASE WHEN m.is_passing=1 THEN 1 ELSE 0 END)/nullif(sum(CASE WHEN m.is_absent=0 THEN 1 ELSE 0 END),0),2) pass_rate
      FROM assessments a JOIN subjects s ON s.id=a.subject_id
      LEFT JOIN assessment_marks m ON m.assessment_id=a.id AND m.organization_id=a.organization_id
      WHERE ${where} GROUP BY s.id,s.name ORDER BY average_percentage DESC,s.name`)).all(),
    bind(env.DB.prepare(`
      SELECT c.id class_id,c.name class_name,se.id section_id,se.name section_name,count(DISTINCT a.id) assessment_count,
        count(m.id) result_count,round(avg(CASE WHEN m.is_absent=0 THEN m.percentage END),2) average_percentage,
        round(100.0*sum(CASE WHEN m.is_passing=1 THEN 1 ELSE 0 END)/nullif(sum(CASE WHEN m.is_absent=0 THEN 1 ELSE 0 END),0),2) pass_rate
      FROM assessments a JOIN classes c ON c.id=a.class_id LEFT JOIN sections se ON se.id=a.section_id
      LEFT JOIN assessment_marks m ON m.assessment_id=a.id AND m.organization_id=a.organization_id
      WHERE ${where} GROUP BY c.id,c.name,se.id,se.name ORDER BY average_percentage DESC,c.name,se.name`)).all(),
    bind(env.DB.prepare(`
      SELECT coalesce(m.grade_label,'Pending') grade_label,count(*) student_count,
        round(100.0*count(*)/sum(count(*)) OVER (),2) percentage
      FROM assessments a JOIN assessment_marks m ON m.assessment_id=a.id AND m.organization_id=a.organization_id
      WHERE ${where} GROUP BY coalesce(m.grade_label,'Pending') ORDER BY max(coalesce(m.percentage,-1)) DESC`)).all(),
    bind(env.DB.prepare(`
      SELECT m.student_id,s.admission_number,s.first_name,s.last_name,e.roll_number,
        count(m.id) assessment_count,round(avg(CASE WHEN m.is_absent=0 THEN m.percentage END),2) average_percentage,
        sum(CASE WHEN m.is_passing=1 THEN 1 ELSE 0 END) passed_count,
        sum(CASE WHEN m.is_passing=0 AND m.is_absent=0 THEN 1 ELSE 0 END) failed_count,
        sum(CASE WHEN m.is_absent=1 THEN 1 ELSE 0 END) absent_count,
        rank() OVER (ORDER BY avg(CASE WHEN m.is_absent=0 THEN m.percentage END) DESC) rank_position
      FROM assessments a JOIN assessment_marks m ON m.assessment_id=a.id AND m.organization_id=a.organization_id
      JOIN students s ON s.id=m.student_id AND s.organization_id=m.organization_id
      JOIN enrollments e ON e.id=m.enrollment_id AND e.organization_id=m.organization_id
      WHERE ${where} GROUP BY m.student_id,s.admission_number,s.first_name,s.last_name,e.roll_number
      ORDER BY average_percentage DESC,s.first_name,s.last_name LIMIT 250`)).all(),
  ]);

  if (exportCsv) {
    const rows = students.results as Record<string, unknown>[];
    const lines = [
      ["Rank","Admission number","Student","Roll number","Assessments","Average percentage","Passed","Failed","Absent"].map(csv).join(","),
      ...rows.map((row) => [row.rank_position,row.admission_number,`${row.first_name} ${row.last_name ?? ""}`.trim(),row.roll_number,row.assessment_count,row.average_percentage,row.passed_count,row.failed_count,row.absent_count].map(csv).join(",")),
    ];
    return new Response(`\ufeff${lines.join("\r\n")}`, { headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="examination-performance-${new Date().toISOString().slice(0,10)}.csv"`,
      "cache-control": "private, no-store",
    }});
  }

  return Response.json({
    campusId,
    filters: { academicYearId, termId, classId, sectionId, subjectId },
    options: {
      academicYears: options[0].results, terms: options[1].results, classes: options[2].results,
      sections: options[3].results, subjects: options[4].results,
    },
    summary: summary ?? {},
    subjects: subjects.results,
    classes: classes.results,
    grades: grades.results,
    students: students.results,
  }, { headers: { "cache-control": "private, no-store" } });
}
