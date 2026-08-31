import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";
import { requireSameOrigin, safeMetadata } from "../../../lib/security";
export const dynamic = "force-dynamic";
const clean = (v: unknown, n = 160) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";
export async function GET(request: Request) {
  const auth = await authorize("teacher_assignments.view");
  if (!auth)
    return Response.json(
      { error: "You do not have permission to view teacher assignments." },
      { status: 403 },
    );
  const u = new URL(request.url),
    yearId = clean(u.searchParams.get("academicYearId")),
    campusId = clean(u.searchParams.get("campusId"));
  const [
    assignments,
    classTeachers,
    teachers,
    subjects,
    classes,
    sections,
    years,
    campuses,
    curriculumCoverage,
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT a.id,a.staff_id,a.weekly_periods,a.is_primary,s.employee_number,s.first_name,s.last_name,s.designation,sub.name subject_name,sub.code subject_code,sub.color,cl.name class_name,se.name section_name,c.name campus_name,y.name academic_year_name FROM teacher_subject_assignments a JOIN staff s ON s.id=a.staff_id JOIN subjects sub ON sub.id=a.subject_id JOIN classes cl ON cl.id=a.class_id LEFT JOIN sections se ON se.id=a.section_id JOIN campuses c ON c.id=a.campus_id JOIN academic_years y ON y.id=a.academic_year_id WHERE a.organization_id=?1 AND a.status='active' AND (?2='' OR a.academic_year_id=?2) AND (?3='' OR a.campus_id=?3) ORDER BY s.first_name,cl.sort_order,sub.name`,
    )
      .bind(auth.organizationId, yearId, campusId)
      .all(),
    env.DB.prepare(
      `SELECT a.id,a.staff_id,s.employee_number,s.first_name,s.last_name,cl.name class_name,se.name section_name,c.name campus_name,y.name academic_year_name,a.notes FROM class_teacher_assignments a JOIN staff s ON s.id=a.staff_id JOIN classes cl ON cl.id=a.class_id LEFT JOIN sections se ON se.id=a.section_id JOIN campuses c ON c.id=a.campus_id JOIN academic_years y ON y.id=a.academic_year_id WHERE a.organization_id=?1 AND a.status='active' AND (?2='' OR a.academic_year_id=?2) AND (?3='' OR a.campus_id=?3) ORDER BY c.name,cl.sort_order,se.name`,
    )
      .bind(auth.organizationId, yearId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT id,employee_number,first_name,last_name,campus_id,designation FROM staff WHERE organization_id=?1 AND status='active' AND staff_category IN ('teaching','management') ORDER BY first_name,last_name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,code,campus_id,color,subject_type,default_weekly_periods,department FROM subjects WHERE organization_id=?1 AND status='active' ORDER BY name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,code,campus_id FROM classes WHERE organization_id=?1 AND status='active' ORDER BY sort_order,name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,class_id,campus_id FROM sections WHERE organization_id=?1 AND status='active' ORDER BY name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,is_current FROM academic_years WHERE organization_id=?1 AND status!='archived' ORDER BY starts_on DESC",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      `SELECT m.id,m.weekly_periods,m.is_compulsory,g.name grade_name,cl.name class_name,s.name subject_name,s.code subject_code,c.name campus_name,y.name academic_year_name,(SELECT count(*) FROM teacher_subject_assignments a WHERE a.organization_id=m.organization_id AND a.academic_year_id=m.academic_year_id AND a.subject_id=m.subject_id AND (m.class_id IS NULL OR a.class_id=m.class_id) AND (m.campus_id IS NULL OR a.campus_id=m.campus_id) AND a.status='active') teacher_count FROM curriculum_mappings m JOIN academic_years y ON y.id=m.academic_year_id JOIN grade_levels g ON g.id=m.grade_level_id LEFT JOIN classes cl ON cl.id=m.class_id JOIN subjects s ON s.id=m.subject_id LEFT JOIN campuses c ON c.id=m.campus_id WHERE m.organization_id=?1 AND m.status='active' AND (?2='' OR m.academic_year_id=?2) AND (?3='' OR m.campus_id IS NULL OR m.campus_id=?3) ORDER BY g.sort_order,s.name`,
    )
      .bind(auth.organizationId, yearId, campusId)
      .all(),
  ]);
  const workload = new Map<
    string,
    {
      staff_id: string;
      employee_number: string;
      name: string;
      designation: string;
      classes: Set<string>;
      subjects: Set<string>;
      periods: number;
    }
  >();
  for (const a of assignments.results as Array<Record<string, unknown>>) {
    const id = String(a.staff_id),
      v = workload.get(id) ?? {
        staff_id: id,
        employee_number: String(a.employee_number),
        name: `${a.first_name} ${a.last_name ?? ""}`.trim(),
        designation: String(a.designation),
        classes: new Set(),
        subjects: new Set(),
        periods: 0,
      };
    v.classes.add(
      `${a.class_name}${a.section_name ? ` · ${a.section_name}` : ""}`,
    );
    v.subjects.add(String(a.subject_name));
    v.periods += Number(a.weekly_periods);
    workload.set(id, v);
  }
  return Response.json(
    {
      assignments: assignments.results,
      classTeachers: classTeachers.results,
      curriculumCoverage: curriculumCoverage.results,
      workload: [...workload.values()].map((v) => ({
        ...v,
        classes: [...v.classes],
        subjects: [...v.subjects],
      })),
      teachers: teachers.results,
      subjects: subjects.results,
      classes: classes.results,
      sections: sections.results,
      academicYears: years.results,
      campuses: campuses.results,
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
export async function POST(request: Request) {
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const b = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null,
    action = clean(b?.action, 30),
    auth = await authorize(
      action === "create_subject"
        ? "subjects.manage"
        : "teacher_assignments.manage",
    );
  if (!auth)
    return Response.json(
      { error: "You do not have permission to manage teacher assignments." },
      { status: 403 },
    );
  if (action === "create_subject") {
    const name = clean(b?.name, 100),
      code = clean(b?.code, 30).toUpperCase(),
      campusId = clean(b?.campusId),
      type = clean(b?.subjectType, 30) || "academic",
      color = clean(b?.color, 10) || "#7456de";
    if (
      !name ||
      !code ||
      !["academic", "language", "religious", "activity", "technology"].includes(
        type,
      ) ||
      !/^#[0-9a-fA-F]{6}$/.test(color)
    )
      return Response.json(
        { error: "Enter valid subject information." },
        { status: 400 },
      );
    if (
      campusId &&
      !(await env.DB.prepare(
        "SELECT id FROM campuses WHERE id=?1 AND organization_id=?2",
      )
        .bind(campusId, auth.organizationId)
        .first())
    )
      return Response.json({ error: "Campus not found." }, { status: 404 });
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO subjects (id,organization_id,campus_id,name,code,subject_type,color) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        ).bind(
          id,
          auth.organizationId,
          campusId || null,
          name,
          code,
          type,
          color,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'subject.create','subject',?5,'success',?6)",
        ).bind(
          crypto.randomUUID(),
          auth.organizationId,
          campusId || null,
          auth.userId,
          id,
          safeMetadata({ code }),
        ),
      ]);
      return Response.json({ ok: true, id });
    } catch {
      return Response.json(
        { error: "Subject code already exists." },
        { status: 409 },
      );
    }
  }
  const staffId = clean(b?.staffId),
    academicYearId = clean(b?.academicYearId),
    campusId = clean(b?.campusId),
    classId = clean(b?.classId),
    sectionId = clean(b?.sectionId),
    staff = await env.DB.prepare(
      "SELECT id FROM staff WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND status='active' AND staff_category IN ('teaching','management')",
    )
      .bind(staffId, auth.organizationId, campusId)
      .first();
  if (!staff)
    return Response.json(
      { error: "Select an active teacher assigned to this campus." },
      { status: 400 },
    );
  const [year, schoolClass] = await Promise.all([
    env.DB.prepare(
      "SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2",
    )
      .bind(academicYearId, auth.organizationId)
      .first(),
    env.DB.prepare(
      "SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'",
    )
      .bind(classId, auth.organizationId, campusId)
      .first(),
  ]);
  if (!year || !schoolClass)
    return Response.json(
      { error: "Select a valid academic year and class." },
      { status: 400 },
    );
  if (
    sectionId &&
    !(await env.DB.prepare(
      "SELECT id FROM sections WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND class_id=?4 AND status='active'",
    )
      .bind(sectionId, auth.organizationId, campusId, classId)
      .first())
  )
    return Response.json(
      { error: "Section does not belong to the selected class." },
      { status: 400 },
    );
  if (action === "assign_subject") {
    const subjectId = clean(b?.subjectId),
      periods = Number(b?.weeklyPeriods);
    if (!Number.isInteger(periods) || periods < 1 || periods > 30)
      return Response.json(
        { error: "Weekly periods must be between 1 and 30." },
        { status: 400 },
      );
    if (
      !(await env.DB.prepare(
        "SELECT id FROM subjects WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'",
      )
        .bind(subjectId, auth.organizationId, campusId)
        .first())
    )
      return Response.json(
        { error: "Select a valid subject." },
        { status: 400 },
      );
    const duplicate = await env.DB.prepare(
      "SELECT id FROM teacher_subject_assignments WHERE organization_id=?1 AND academic_year_id=?2 AND staff_id=?3 AND subject_id=?4 AND class_id=?5 AND coalesce(section_id,'')=?6 AND status='active'",
    )
      .bind(
        auth.organizationId,
        academicYearId,
        staffId,
        subjectId,
        classId,
        sectionId,
      )
      .first();
    if (duplicate)
      return Response.json(
        { error: "This teacher already has the same subject assignment." },
        { status: 409 },
      );
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO teacher_subject_assignments (id,organization_id,academic_year_id,campus_id,staff_id,subject_id,class_id,section_id,weekly_periods,is_primary,assigned_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
      ).bind(
        id,
        auth.organizationId,
        academicYearId,
        campusId,
        staffId,
        subjectId,
        classId,
        sectionId || null,
        periods,
        b?.isPrimary ? 1 : 0,
        auth.userId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'teacher.subject.assign','teacher_assignment',?5,'success',?6)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        id,
        safeMetadata({
          staffId,
          subjectId,
          classId,
          sectionId,
          academicYearId,
        }),
      ),
    ]);
    return Response.json({ ok: true, id });
  }
  if (action === "assign_class_teacher") {
    const scopeKey = `${campusId}:${classId}:${sectionId || "all"}`,
      id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO class_teacher_assignments (id,organization_id,academic_year_id,campus_id,staff_id,class_id,section_id,scope_key,notes,assigned_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        ).bind(
          id,
          auth.organizationId,
          academicYearId,
          campusId,
          staffId,
          classId,
          sectionId || null,
          scopeKey,
          clean(b?.notes, 400) || null,
          auth.userId,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'teacher.class.assign','class_teacher_assignment',?5,'success',?6)",
        ).bind(
          crypto.randomUUID(),
          auth.organizationId,
          campusId,
          auth.userId,
          id,
          safeMetadata({ staffId, classId, sectionId, academicYearId }),
        ),
      ]);
      return Response.json({ ok: true, id });
    } catch {
      return Response.json(
        {
          error:
            "This class or section already has a class teacher for the selected year.",
        },
        { status: 409 },
      );
    }
  }
  return Response.json(
    { error: "Select a valid assignment action." },
    { status: 400 },
  );
}
export async function DELETE(request: Request) {
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const auth = await authorize("teacher_assignments.manage");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const u = new URL(request.url),
    id = clean(u.searchParams.get("id")),
    type = clean(u.searchParams.get("type")),
    table =
      type === "class_teacher"
        ? "class_teacher_assignments"
        : type === "subject"
          ? "teacher_subject_assignments"
          : "";
  if (!table)
    return Response.json(
      { error: "Invalid assignment type." },
      { status: 400 },
    );
  const row = await env.DB.prepare(
    `SELECT campus_id FROM ${table} WHERE id=?1 AND organization_id=?2`,
  )
    .bind(id, auth.organizationId)
    .first<{ campus_id: string }>();
  if (!row)
    return Response.json({ error: "Assignment not found." }, { status: 404 });
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM ${table} WHERE id=?1 AND organization_id=?2`,
    ).bind(id, auth.organizationId),
    env.DB.prepare(
      "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'teacher.assignment.remove','teacher_assignment',?5,'success')",
    ).bind(
      crypto.randomUUID(),
      auth.organizationId,
      row.campus_id,
      auth.userId,
      id,
    ),
  ]);
  return Response.json({ ok: true });
}
