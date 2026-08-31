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
  const [entries, events, years, terms, classes, sections, subjects, staff] =
    await Promise.all([
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
      canManage: auth.permissions.has("examinations.manage"),
      canManageEvents: auth.permissions.has("events.manage"),
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
    : "examinations.manage";
  if (!auth.permissions.has(permission))
    return Response.json(
      { error: "You do not have permission for this action." },
      { status: 403 },
    );
  const denied = await requireCampusAccess(auth, campusId, permission);
  if (denied) return denied;
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
