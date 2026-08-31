import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";
import { requireSameOrigin } from "../../../lib/security";

export const dynamic = "force-dynamic";
const clean = (v: unknown, n = 100) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
const date = /^\d{4}-\d{2}-\d{2}$/;
async function owned(
  table:
    "academic_years" | "campuses" | "grade_levels" | "classes" | "subjects",
  id: string,
  org: string,
) {
  return env.DB.prepare(
    `SELECT * FROM ${table} WHERE id=?1 AND organization_id=?2`,
  )
    .bind(id, org)
    .first<Record<string, unknown>>();
}
async function audit(
  org: string,
  user: string,
  action: string,
  type: string,
  id: string,
  campus: string | null = null,
) {
  await env.DB.prepare(
    "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,?5,?6,?7,'success')",
  )
    .bind(crypto.randomUUID(), org, campus, user, action, type, id)
    .run();
}

export async function GET() {
  const auth = await authorize("academics.view");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const [
    years,
    terms,
    grades,
    classes,
    sections,
    campuses,
    subjects,
    mappings,
  ] = await Promise.all([
    env.DB.prepare(
      "SELECT id,name,starts_on,ends_on,is_current,status FROM academic_years WHERE organization_id=?1 ORDER BY starts_on DESC",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT t.*,y.name academic_year_name FROM academic_terms t JOIN academic_years y ON y.id=t.academic_year_id WHERE t.organization_id=?1 ORDER BY y.starts_on DESC,t.sort_order,t.starts_on",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT g.*,p.name promotion_to_name FROM grade_levels g LEFT JOIN grade_levels p ON p.id=g.promotion_to_grade_id WHERE g.organization_id=?1 ORDER BY g.sort_order,g.name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT cl.*,c.name campus_name,y.name academic_year_name,g.name grade_name,(SELECT count(*) FROM sections s WHERE s.class_id=cl.id AND s.status='active') section_count,(SELECT count(*) FROM enrollments e WHERE e.class_id=cl.id AND e.status='active') student_count FROM classes cl LEFT JOIN campuses c ON c.id=cl.campus_id LEFT JOIN academic_years y ON y.id=cl.academic_year_id LEFT JOIN grade_levels g ON g.id=cl.grade_level_id WHERE cl.organization_id=?1 ORDER BY cl.sort_order,cl.name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT s.*,cl.name class_name,c.name campus_name,(SELECT count(*) FROM enrollments e WHERE e.section_id=s.id AND e.status='active') student_count FROM sections s JOIN classes cl ON cl.id=s.class_id JOIN campuses c ON c.id=s.campus_id WHERE s.organization_id=?1 ORDER BY cl.sort_order,s.name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,code,is_main FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT s.*,(SELECT count(*) FROM curriculum_mappings m WHERE m.subject_id=s.id AND m.organization_id=s.organization_id AND m.status='active') mapping_count,(SELECT count(DISTINCT a.staff_id) FROM teacher_subject_assignments a WHERE a.subject_id=s.id AND a.organization_id=s.organization_id AND a.status='active') teacher_count FROM subjects s WHERE s.organization_id=?1 ORDER BY s.name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT m.*,y.name academic_year_name,c.name campus_name,g.name grade_name,cl.name class_name,s.name subject_name,s.code subject_code,s.color FROM curriculum_mappings m JOIN academic_years y ON y.id=m.academic_year_id LEFT JOIN campuses c ON c.id=m.campus_id JOIN grade_levels g ON g.id=m.grade_level_id LEFT JOIN classes cl ON cl.id=m.class_id JOIN subjects s ON s.id=m.subject_id WHERE m.organization_id=?1 ORDER BY y.starts_on DESC,g.sort_order,s.name",
    )
      .bind(auth.organizationId)
      .all(),
  ]);
  return Response.json(
    {
      academicYears: years.results,
      terms: terms.results,
      grades: grades.results,
      classes: classes.results,
      sections: sections.results,
      campuses: campuses.results,
      subjects: subjects.results,
      curriculumMappings: mappings.results,
      canManage: auth.permissions.has("academics.manage"),
      canManageCurriculum: auth.permissions.has("curriculum.manage"),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const same = requireSameOrigin(request);
  if (same) return same;
  const b = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null,
    action = clean(b?.action, 30),
    curriculumAction = ["create_subject", "create_mapping"].includes(action),
    auth = await authorize(
      curriculumAction ? "curriculum.manage" : "academics.manage",
    );
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const id = crypto.randomUUID();
  try {
    if (action === "create_term") {
      const yearId = clean(b?.academicYearId),
        name = clean(b?.name),
        code = clean(b?.code, 20).toUpperCase(),
        starts = clean(b?.startsOn, 10),
        ends = clean(b?.endsOn, 10),
        order = Math.max(0, Number(b?.sortOrder) || 0),
        year = await owned("academic_years", yearId, auth.organizationId);
      if (
        !year ||
        !name ||
        !code ||
        !date.test(starts) ||
        !date.test(ends) ||
        starts > ends ||
        starts < String(year.starts_on) ||
        ends > String(year.ends_on)
      )
        return Response.json(
          { error: "Enter valid term dates within the academic year." },
          { status: 400 },
        );
      await env.DB.prepare(
        "INSERT INTO academic_terms (id,organization_id,academic_year_id,name,code,starts_on,ends_on,sort_order) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
      )
        .bind(id, auth.organizationId, yearId, name, code, starts, ends, order)
        .run();
      await audit(
        auth.organizationId,
        auth.userId,
        "academic.term.create",
        "academic_term",
        id,
      );
    } else if (action === "create_grade") {
      const name = clean(b?.name),
        code = clean(b?.code, 20).toUpperCase(),
        stage = clean(b?.stage, 20),
        order = Math.max(0, Number(b?.sortOrder) || 0),
        promotion = clean(b?.promotionToGradeId) || null;
      if (
        !name ||
        !code ||
        !["early_years", "primary", "middle", "secondary"].includes(stage) ||
        (promotion &&
          !(await owned("grade_levels", promotion, auth.organizationId)))
      )
        return Response.json(
          { error: "Enter a valid grade level." },
          { status: 400 },
        );
      await env.DB.prepare(
        "INSERT INTO grade_levels (id,organization_id,name,code,stage,sort_order,promotion_to_grade_id) VALUES (?1,?2,?3,?4,?5,?6,?7)",
      )
        .bind(id, auth.organizationId, name, code, stage, order, promotion)
        .run();
      await audit(
        auth.organizationId,
        auth.userId,
        "academic.grade.create",
        "grade_level",
        id,
      );
    } else if (action === "create_class") {
      const name = clean(b?.name),
        code = clean(b?.code, 20).toUpperCase(),
        campusId = clean(b?.campusId) || null,
        yearId = clean(b?.academicYearId) || null,
        gradeId = clean(b?.gradeLevelId) || null,
        capacity = Math.max(0, Number(b?.capacity) || 0),
        order = Math.max(0, Number(b?.sortOrder) || 0);
      if (
        !name ||
        !code ||
        (campusId &&
          !(await owned("campuses", campusId, auth.organizationId))) ||
        (yearId &&
          !(await owned("academic_years", yearId, auth.organizationId))) ||
        (gradeId &&
          !(await owned("grade_levels", gradeId, auth.organizationId)))
      )
        return Response.json(
          { error: "Select valid school-owned academic values." },
          { status: 400 },
        );
      await env.DB.prepare(
        "INSERT INTO classes (id,organization_id,campus_id,name,code,sort_order,academic_year_id,grade_level_id,capacity) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
      )
        .bind(
          id,
          auth.organizationId,
          campusId,
          name,
          code,
          order,
          yearId,
          gradeId,
          capacity || null,
        )
        .run();
      await audit(
        auth.organizationId,
        auth.userId,
        "academic.class.create",
        "class",
        id,
        campusId,
      );
    } else if (action === "create_section") {
      const name = clean(b?.name),
        code = clean(b?.code, 20).toUpperCase(),
        classId = clean(b?.classId),
        campusId = clean(b?.campusId),
        capacity = Math.max(0, Number(b?.capacity) || 0),
        cl = await owned("classes", classId, auth.organizationId),
        campus = await owned("campuses", campusId, auth.organizationId);
      if (
        !name ||
        !code ||
        !cl ||
        !campus ||
        (cl.campus_id && cl.campus_id !== campusId)
      )
        return Response.json(
          { error: "Section campus must match its class." },
          { status: 400 },
        );
      await env.DB.prepare(
        "INSERT INTO sections (id,organization_id,campus_id,class_id,name,code,capacity) VALUES (?1,?2,?3,?4,?5,?6,?7)",
      )
        .bind(
          id,
          auth.organizationId,
          campusId,
          classId,
          name,
          code,
          capacity || null,
        )
        .run();
      await audit(
        auth.organizationId,
        auth.userId,
        "academic.section.create",
        "section",
        id,
        campusId,
      );
    } else if (action === "create_subject") {
      const name = clean(b?.name),
        code = clean(b?.code, 20).toUpperCase(),
        campusId = clean(b?.campusId) || null,
        type = clean(b?.subjectType, 20),
        department = clean(b?.department, 60) || null,
        description = clean(b?.description, 500) || null,
        periods = Math.max(
          1,
          Math.min(30, Number(b?.defaultWeeklyPeriods) || 5),
        ),
        color = clean(b?.color, 10) || "#7456de";
      if (
        !name ||
        !code ||
        ![
          "academic",
          "language",
          "religious",
          "activity",
          "technology",
        ].includes(type) ||
        !/^#[0-9a-fA-F]{6}$/.test(color) ||
        (campusId && !(await owned("campuses", campusId, auth.organizationId)))
      )
        return Response.json(
          { error: "Enter valid subject information." },
          { status: 400 },
        );
      await env.DB.prepare(
        "INSERT INTO subjects (id,organization_id,campus_id,name,code,subject_type,color,description,department,default_weekly_periods) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
      )
        .bind(
          id,
          auth.organizationId,
          campusId,
          name,
          code,
          type,
          color,
          description,
          department,
          periods,
        )
        .run();
      await audit(
        auth.organizationId,
        auth.userId,
        "curriculum.subject.create",
        "subject",
        id,
        campusId,
      );
    } else if (action === "create_mapping") {
      const yearId = clean(b?.academicYearId),
        campusId = clean(b?.campusId) || null,
        gradeId = clean(b?.gradeLevelId),
        classId = clean(b?.classId) || null,
        subjectId = clean(b?.subjectId),
        source = clean(b?.curriculumSource, 100) || null,
        reference = clean(b?.curriculumReference, 300) || null,
        periods = Math.max(1, Math.min(30, Number(b?.weeklyPeriods) || 5));
      const [year, grade, subject, schoolClass, campus] = await Promise.all([
        owned("academic_years", yearId, auth.organizationId),
        owned("grade_levels", gradeId, auth.organizationId),
        owned("subjects", subjectId, auth.organizationId),
        classId ? owned("classes", classId, auth.organizationId) : null,
        campusId ? owned("campuses", campusId, auth.organizationId) : null,
      ]);
      if (
        !year ||
        !grade ||
        !subject ||
        (classId && !schoolClass) ||
        (campusId && !campus) ||
        (schoolClass &&
          schoolClass.grade_level_id &&
          schoolClass.grade_level_id !== gradeId) ||
        (schoolClass &&
          campusId &&
          schoolClass.campus_id &&
          schoolClass.campus_id !== campusId)
      )
        return Response.json(
          { error: "Select a valid school-owned curriculum scope." },
          { status: 400 },
        );
      await env.DB.prepare(
        "INSERT INTO curriculum_mappings (id,organization_id,academic_year_id,campus_id,grade_level_id,class_id,subject_id,curriculum_source,curriculum_reference,weekly_periods,is_compulsory,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
      )
        .bind(
          id,
          auth.organizationId,
          yearId,
          campusId,
          gradeId,
          classId,
          subjectId,
          source,
          reference,
          periods,
          b?.isCompulsory === false ? 0 : 1,
          auth.userId,
        )
        .run();
      await audit(
        auth.organizationId,
        auth.userId,
        "curriculum.mapping.create",
        "curriculum_mapping",
        id,
        campusId,
      );
    } else
      return Response.json({ error: "Unsupported action." }, { status: 400 });
    return Response.json({ ok: true, id });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof Error && e.message.includes("UNIQUE")
            ? "That code already exists in this scope."
            : "Unable to save academic structure.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const same = requireSameOrigin(request);
  if (same) return same;
  const auth = await authorize("academics.manage");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const b = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null,
    id = clean(b?.id),
    entity = clean(b?.entity, 20),
    status = clean(b?.status, 12);
  const map = {
      term: ["academic_terms", "academic_term"],
      grade: ["grade_levels", "grade_level"],
      class: ["classes", "class"],
      section: ["sections", "section"],
    } as const,
    item = map[entity as keyof typeof map];
  if (!item || !["active", "inactive", "archived"].includes(status))
    return Response.json({ error: "Invalid status update." }, { status: 400 });
  const result = await env.DB.prepare(
    `UPDATE ${item[0]} SET status=?1,updated_at=?2 WHERE id=?3 AND organization_id=?4`,
  )
    .bind(status, Date.now(), id, auth.organizationId)
    .run();
  if (!result.meta.changes)
    return Response.json({ error: "Record not found." }, { status: 404 });
  await audit(
    auth.organizationId,
    auth.userId,
    `academic.${entity}.${status}`,
    item[1],
    id,
  );
  return Response.json({ ok: true });
}
