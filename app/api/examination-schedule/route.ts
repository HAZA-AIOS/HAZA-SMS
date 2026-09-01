import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../lib/authorization";
import {
  enforceRateLimit,
  requireSameOrigin,
  safeMetadata,
} from "../../../lib/security";

export const dynamic = "force-dynamic";
const clean = (v: unknown, n = 140) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";
const date = /^\d{4}-\d{2}-\d{2}$/;
const time = /^([01]\d|2[0-3]):[0-5]\d$/;
const overlap = "NOT (ends_at<=?4 OR starts_at>=?5)";

export async function GET() {
  const auth = await authorize("examinations.view");
  if (!auth)
    return Response.json(
      { error: "You do not have permission to view examination schedules." },
      { status: 403 },
    );
  const campusId = auth.activeCampusId ?? auth.campuses[0]?.id;
  if (!campusId)
    return Response.json(
      { error: "Select an active campus." },
      { status: 400 },
    );
  const denied = await requireCampusAccess(auth, campusId, "examinations.view");
  if (denied) return denied;
  const [
    entries,
    events,
    years,
    terms,
    classes,
    sections,
    subjects,
    staff,
    examTypes,
    gradingSchemes,
    gradeBoundaries,
    assessments,
  ] = await Promise.all([
    env.DB.prepare(
      "SELECT e.*,c.name class_name,se.name section_name,s.name subject_name,st.first_name||' '||coalesce(st.last_name,'') invigilator_name FROM examination_timetable_entries e JOIN classes c ON c.id=e.class_id LEFT JOIN sections se ON se.id=e.section_id JOIN subjects s ON s.id=e.subject_id LEFT JOIN staff st ON st.id=e.invigilator_staff_id WHERE e.organization_id=?1 AND e.campus_id=?2 AND e.status!='cancelled' ORDER BY e.exam_date,e.starts_at",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT * FROM school_events WHERE organization_id=?1 AND (campus_id IS NULL OR campus_id=?2) AND status!='cancelled' ORDER BY starts_on,starts_at",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,is_current FROM academic_years WHERE organization_id=?1 AND status!='archived' ORDER BY is_current DESC",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,academic_year_id FROM academic_terms WHERE organization_id=?1 AND status='active' ORDER BY starts_on",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name FROM classes WHERE organization_id=?1 AND status='active' AND (campus_id IS NULL OR campus_id=?2) ORDER BY sort_order,name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,class_id FROM sections WHERE organization_id=?1 AND campus_id=?2 AND status='active' ORDER BY name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT id,name FROM subjects WHERE organization_id=?1 AND status='active' AND (campus_id IS NULL OR campus_id=?2) ORDER BY name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT id,first_name||' '||coalesce(last_name,'') name FROM staff WHERE organization_id=?1 AND campus_id=?2 AND status='active' ORDER BY first_name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT * FROM examination_types WHERE organization_id=?1 AND status='active' ORDER BY name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT g.*,y.name academic_year_name FROM grading_schemes g LEFT JOIN academic_years y ON y.id=g.academic_year_id WHERE g.organization_id=?1 AND g.status='active' ORDER BY g.is_default DESC,g.name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT b.* FROM grade_boundaries b JOIN grading_schemes g ON g.id=b.grading_scheme_id WHERE b.organization_id=?1 AND g.organization_id=?1 ORDER BY b.grading_scheme_id,b.minimum_percentage DESC",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT a.*,et.name examination_type_name,et.assessment_mode,c.name class_name,se.name section_name,s.name subject_name,g.name grading_scheme_name,t.name term_name FROM assessments a JOIN examination_types et ON et.id=a.examination_type_id JOIN classes c ON c.id=a.class_id LEFT JOIN sections se ON se.id=a.section_id JOIN subjects s ON s.id=a.subject_id LEFT JOIN grading_schemes g ON g.id=a.grading_scheme_id LEFT JOIN academic_terms t ON t.id=a.term_id WHERE a.organization_id=?1 AND a.campus_id=?2 ORDER BY a.assessment_date DESC,a.title",
    )
      .bind(auth.organizationId, campusId)
      .all(),
  ]);
  return Response.json(
    {
      campusId,
      entries: entries.results,
      events: events.results,
      academicYears: years.results,
      terms: terms.results,
      classes: classes.results,
      sections: sections.results,
      subjects: subjects.results,
      staff: staff.results,
      examTypes: examTypes.results,
      gradingSchemes: gradingSchemes.results,
      gradeBoundaries: gradeBoundaries.results,
      assessments: assessments.results,
      canManage: auth.permissions.has("examinations.manage"),
      canManageEvents: auth.permissions.has("events.manage"),
      canManageTypes: auth.permissions.has("examination_types.manage"),
      canManageAssessments: auth.permissions.has("assessments.manage"),
      canManageGrading: auth.permissions.has("grading.manage"),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const same = requireSameOrigin(request);
  if (same) return same;
  const auth = await authorize();
  if (!auth)
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  if (!(await enforceRateLimit(auth, "examination.schedule.change", 80, 300)))
    return Response.json(
      { error: "Too many changes. Try again later." },
      { status: 429 },
    );
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const action = clean(body?.action, 30),
    campusId = clean(body?.campusId);
  const permission = action.includes("event")
    ? "events.manage"
    : action.includes("exam_type")
      ? "examination_types.manage"
      : action.includes("grading") || action.includes("grade_boundary")
        ? "grading.manage"
        : action.includes("assessment")
          ? "assessments.manage"
          : "examinations.manage";
  if (!auth.permissions.has(permission))
    return Response.json(
      { error: "You do not have permission for this action." },
      { status: 403 },
    );
  const denied = await requireCampusAccess(auth, campusId, permission);
  if (denied) return denied;
  if (action === "create_exam_type") {
    const name = clean(body?.name, 80),
      code = clean(body?.code, 20).toUpperCase(),
      mode = clean(body?.assessmentMode, 20) || "written",
      weight = Math.max(
        1,
        Math.min(100, Number(body?.defaultWeightage) || 100),
      );
    if (
      !name ||
      !code ||
      !["written", "oral", "practical", "project", "mixed"].includes(mode)
    )
      return Response.json(
        { error: "Enter a valid examination type, code and assessment mode." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO examination_types (id,organization_id,name,code,assessment_mode,default_weightage,requires_approval,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        ).bind(
          id,
          auth.organizationId,
          name,
          code,
          mode,
          weight,
          body?.requiresApproval ? 1 : 0,
          auth.userId,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'examination.type.create','examination_type',?5,'success',?6)",
        ).bind(
          crypto.randomUUID(),
          auth.organizationId,
          campusId,
          auth.userId,
          id,
          safeMetadata({ code, mode }),
        ),
      ]);
    } catch {
      return Response.json(
        { error: "That examination type code already exists." },
        { status: 409 },
      );
    }
    return Response.json({ ok: true, id });
  }
  if (action === "create_grading_scheme") {
    const name = clean(body?.name, 80),
      code = clean(body?.code, 20).toUpperCase(),
      academicYearId = clean(body?.academicYearId) || null,
      isDefault = body?.isDefault ? 1 : 0;
    if (!name || !code)
      return Response.json(
        { error: "Enter a grading scheme name and code." },
        { status: 400 },
      );
    if (
      academicYearId &&
      !(await env.DB.prepare(
        "SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2",
      )
        .bind(academicYearId, auth.organizationId)
        .first())
    )
      return Response.json(
        { error: "The selected academic year is invalid." },
        { status: 400 },
      );
    const id = crypto.randomUUID(),
      statements = [];
    if (isDefault)
      statements.push(
        env.DB.prepare(
          "UPDATE grading_schemes SET is_default=0 WHERE organization_id=?1 AND coalesce(academic_year_id,'')=coalesce(?2,'')",
        ).bind(auth.organizationId, academicYearId),
      );
    statements.push(
      env.DB.prepare(
        "INSERT INTO grading_schemes (id,organization_id,academic_year_id,name,code,is_default,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7)",
      ).bind(
        id,
        auth.organizationId,
        academicYearId,
        name,
        code,
        isDefault,
        auth.userId,
      ),
    );
    statements.push(
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'grading.scheme.create','grading_scheme',?5,'success')",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        id,
      ),
    );
    try {
      await env.DB.batch(statements);
    } catch {
      return Response.json(
        { error: "That grading scheme code already exists." },
        { status: 409 },
      );
    }
    return Response.json({ ok: true, id });
  }
  if (action === "add_grade_boundary") {
    const gradingSchemeId = clean(body?.gradingSchemeId),
      label = clean(body?.label, 20),
      minimum = Number(body?.minimumPercentage),
      maximum = Number(body?.maximumPercentage),
      gradePoint = body?.gradePoint === "" ? null : Number(body?.gradePoint);
    if (
      !gradingSchemeId ||
      !label ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum < 0 ||
      maximum > 100 ||
      minimum > maximum
    )
      return Response.json(
        { error: "Enter a valid grade label and percentage range." },
        { status: 400 },
      );
    if (
      !(await env.DB.prepare(
        "SELECT id FROM grading_schemes WHERE id=?1 AND organization_id=?2",
      )
        .bind(gradingSchemeId, auth.organizationId)
        .first())
    )
      return Response.json(
        { error: "The selected grading scheme is invalid." },
        { status: 400 },
      );
    const overlapBand = await env.DB.prepare(
      "SELECT id FROM grade_boundaries WHERE grading_scheme_id=?1 AND organization_id=?2 AND NOT (maximum_percentage<?3 OR minimum_percentage>?4)",
    )
      .bind(gradingSchemeId, auth.organizationId, minimum, maximum)
      .first();
    if (overlapBand)
      return Response.json(
        { error: "This percentage range overlaps an existing grade band." },
        { status: 409 },
      );
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO grade_boundaries (id,organization_id,grading_scheme_id,label,minimum_percentage,maximum_percentage,grade_point,remarks,is_passing,sort_order) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
      ).bind(
        id,
        auth.organizationId,
        gradingSchemeId,
        label,
        minimum,
        maximum,
        gradePoint,
        clean(body?.remarks, 100) || null,
        body?.isPassing ? 1 : 0,
        Math.round(100 - minimum),
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'grading.boundary.create','grade_boundary',?5,'success')",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        id,
      ),
    ]);
    return Response.json({ ok: true, id });
  }
  if (action === "create_assessment") {
    const academicYearId = clean(body?.academicYearId),
      termId = clean(body?.termId) || null,
      examinationTypeId = clean(body?.examinationTypeId),
      gradingSchemeId = clean(body?.gradingSchemeId) || null,
      classId = clean(body?.classId),
      sectionId = clean(body?.sectionId) || null,
      subjectId = clean(body?.subjectId),
      title = clean(body?.title, 120),
      assessmentDate = clean(body?.assessmentDate, 10),
      maximumMarks = Number(body?.maximumMarks),
      passingMarks = Number(body?.passingMarks),
      weightage = Number(body?.weightage);
    if (
      !academicYearId ||
      !examinationTypeId ||
      !classId ||
      !subjectId ||
      !title ||
      !date.test(assessmentDate) ||
      maximumMarks <= 0 ||
      passingMarks < 0 ||
      passingMarks > maximumMarks ||
      weightage <= 0 ||
      weightage > 100
    )
      return Response.json(
        {
          error:
            "Complete the assessment with valid marks, weightage and date.",
        },
        { status: 400 },
      );
    const checks = await Promise.all([
      env.DB.prepare(
        "SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2",
      )
        .bind(academicYearId, auth.organizationId)
        .first(),
      env.DB.prepare(
        "SELECT id FROM examination_types WHERE id=?1 AND organization_id=?2 AND status='active'",
      )
        .bind(examinationTypeId, auth.organizationId)
        .first(),
      env.DB.prepare(
        "SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3)",
      )
        .bind(classId, auth.organizationId, campusId)
        .first(),
      env.DB.prepare(
        "SELECT id FROM subjects WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3)",
      )
        .bind(subjectId, auth.organizationId, campusId)
        .first(),
      sectionId
        ? env.DB.prepare(
            "SELECT id FROM sections WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND class_id=?4",
          )
            .bind(sectionId, auth.organizationId, campusId, classId)
            .first()
        : Promise.resolve(true),
      termId
        ? env.DB.prepare(
            "SELECT id FROM academic_terms WHERE id=?1 AND organization_id=?2 AND academic_year_id=?3",
          )
            .bind(termId, auth.organizationId, academicYearId)
            .first()
        : Promise.resolve(true),
      gradingSchemeId
        ? env.DB.prepare(
            "SELECT id FROM grading_schemes WHERE id=?1 AND organization_id=?2 AND status='active'",
          )
            .bind(gradingSchemeId, auth.organizationId)
            .first()
        : Promise.resolve(true),
    ]);
    if (checks.some((v) => !v))
      return Response.json(
        {
          error:
            "One or more selected records are invalid for this organization or campus.",
        },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO assessments (id,organization_id,campus_id,academic_year_id,term_id,examination_type_id,grading_scheme_id,class_id,section_id,subject_id,title,assessment_date,maximum_marks,passing_marks,weightage,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
      ).bind(
        id,
        auth.organizationId,
        campusId,
        academicYearId,
        termId,
        examinationTypeId,
        gradingSchemeId,
        classId,
        sectionId,
        subjectId,
        title,
        assessmentDate,
        maximumMarks,
        passingMarks,
        weightage,
        auth.userId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'assessment.create','assessment',?5,'success',?6)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        id,
        safeMetadata({ classId, subjectId, assessmentDate }),
      ),
    ]);
    return Response.json({ ok: true, id });
  }
  if (action === "create_exam") {
    const academicYearId = clean(body?.academicYearId),
      termId = clean(body?.termId) || null,
      examName = clean(body?.examName),
      examType = clean(body?.examType, 30) || "term",
      classId = clean(body?.classId),
      sectionId = clean(body?.sectionId) || null,
      subjectId = clean(body?.subjectId),
      examDate = clean(body?.examDate, 10),
      startsAt = clean(body?.startsAt, 5),
      endsAt = clean(body?.endsAt, 5),
      roomName = clean(body?.roomName, 80) || null,
      invigilatorId = clean(body?.invigilatorId) || null,
      notes = clean(body?.notes, 500) || null,
      maximumMarks = Math.max(
        1,
        Math.min(1000, Number(body?.maximumMarks) || 100),
      );
    if (
      !examName ||
      !academicYearId ||
      !classId ||
      !subjectId ||
      !date.test(examDate) ||
      !time.test(startsAt) ||
      !time.test(endsAt) ||
      startsAt >= endsAt
    )
      return Response.json(
        {
          error: "Complete the examination details with a valid date and time.",
        },
        { status: 400 },
      );
    const [year, klass, subject, section, invigilator] = await Promise.all([
      env.DB.prepare(
        "SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2",
      )
        .bind(academicYearId, auth.organizationId)
        .first(),
      env.DB.prepare(
        "SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3)",
      )
        .bind(classId, auth.organizationId, campusId)
        .first(),
      env.DB.prepare(
        "SELECT id FROM subjects WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3)",
      )
        .bind(subjectId, auth.organizationId, campusId)
        .first(),
      sectionId
        ? env.DB.prepare(
            "SELECT id FROM sections WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND class_id=?4",
          )
            .bind(sectionId, auth.organizationId, campusId, classId)
            .first()
        : Promise.resolve({ id: null }),
      invigilatorId
        ? env.DB.prepare(
            "SELECT id FROM staff WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND status='active'",
          )
            .bind(invigilatorId, auth.organizationId, campusId)
            .first()
        : Promise.resolve({ id: null }),
    ]);
    if (
      !year ||
      !klass ||
      !subject ||
      (sectionId && !section) ||
      (invigilatorId && !invigilator)
    )
      return Response.json(
        { error: "One or more selected records are invalid for this campus." },
        { status: 400 },
      );
    if (invigilatorId) {
      const conflict = await env.DB.prepare(
        `SELECT id FROM examination_timetable_entries WHERE organization_id=?1 AND campus_id=?2 AND exam_date=?3 AND ${overlap} AND invigilator_staff_id=?6 AND status!='cancelled'`,
      )
        .bind(
          auth.organizationId,
          campusId,
          examDate,
          startsAt,
          endsAt,
          invigilatorId,
        )
        .first();
      if (conflict)
        return Response.json(
          {
            error:
              "This invigilator already has an examination during that time.",
          },
          { status: 409 },
        );
    }
    if (roomName) {
      const conflict = await env.DB.prepare(
        `SELECT id FROM examination_timetable_entries WHERE organization_id=?1 AND campus_id=?2 AND exam_date=?3 AND ${overlap} AND lower(room_name)=lower(?6) AND status!='cancelled'`,
      )
        .bind(
          auth.organizationId,
          campusId,
          examDate,
          startsAt,
          endsAt,
          roomName,
        )
        .first();
      if (conflict)
        return Response.json(
          { error: "This room is already assigned during that time." },
          { status: 409 },
        );
    }
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO examination_timetable_entries (id,organization_id,campus_id,academic_year_id,term_id,exam_name,exam_type,class_id,section_id,subject_id,exam_date,starts_at,ends_at,room_name,invigilator_staff_id,maximum_marks,notes,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)",
      ).bind(
        id,
        auth.organizationId,
        campusId,
        academicYearId,
        termId,
        examName,
        examType,
        classId,
        sectionId,
        subjectId,
        examDate,
        startsAt,
        endsAt,
        roomName,
        invigilatorId,
        maximumMarks,
        notes,
        auth.userId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'examination.timetable.create','examination_timetable_entry',?5,'success',?6)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        id,
        safeMetadata({ examDate, classId, subjectId }),
      ),
    ]);
    return Response.json({ ok: true, id });
  }
  if (action === "create_event") {
    const title = clean(body?.title),
      eventType = clean(body?.eventType, 30) || "school",
      startsOn = clean(body?.startsOn, 10),
      endsOn = clean(body?.endsOn, 10) || startsOn,
      startsAt = clean(body?.startsAt, 5) || null,
      endsAt = clean(body?.endsAt, 5) || null,
      location = clean(body?.location, 120) || null,
      description = clean(body?.description, 500) || null,
      audience = clean(body?.audience, 40) || "all",
      academicYearId = clean(body?.academicYearId) || null;
    if (
      !title ||
      !date.test(startsOn) ||
      !date.test(endsOn) ||
      startsOn > endsOn ||
      (startsAt && !time.test(startsAt)) ||
      (endsAt && !time.test(endsAt))
    )
      return Response.json(
        { error: "Enter a valid event title and date range." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO school_events (id,organization_id,campus_id,academic_year_id,title,event_type,starts_on,ends_on,starts_at,ends_at,location,description,audience,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
      ).bind(
        id,
        auth.organizationId,
        campusId,
        academicYearId,
        title,
        eventType,
        startsOn,
        endsOn,
        startsAt,
        endsAt,
        location,
        description,
        audience,
        auth.userId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'school.event.create','school_event',?5,'success')",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        id,
      ),
    ]);
    return Response.json({ ok: true, id });
  }
  if (action === "cancel_exam" || action === "cancel_event") {
    const id = clean(body?.id),
      table =
        action === "cancel_exam"
          ? "examination_timetable_entries"
          : "school_events",
      audit =
        action === "cancel_exam"
          ? "examination.timetable.cancel"
          : "school.event.cancel";
    const result = await env.DB.prepare(
      `UPDATE ${table} SET status='cancelled',updated_at=unixepoch()*1000 WHERE id=?1 AND organization_id=?2 AND campus_id=?3`,
    )
      .bind(id, auth.organizationId, campusId)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: "Record not found in this campus." },
        { status: 404 },
      );
    await env.DB.prepare(
      "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,?5,?6,?7,'success')",
    )
      .bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        audit,
        table,
        id,
      )
      .run();
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unsupported action." }, { status: 400 });
}
