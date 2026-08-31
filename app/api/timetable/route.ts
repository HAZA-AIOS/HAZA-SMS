import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../lib/authorization";
import {
  enforceRateLimit,
  requireSameOrigin,
  safeMetadata,
} from "../../../lib/security";

export const dynamic = "force-dynamic";
const clean = (v: unknown, n = 100) =>
  typeof v === "string" ? v.trim().slice(0, n) : "";
const time = /^([01]\d|2[0-3]):[0-5]\d$/;
const md = /^\d{2}-\d{2}$/;
async function owned(
  table:
    | "campuses"
    | "academic_years"
    | "classes"
    | "sections"
    | "subjects"
    | "staff"
    | "school_schedules"
    | "timetable_periods",
  id: string,
  org: string,
) {
  return env.DB.prepare(
    `SELECT * FROM ${table} WHERE id=?1 AND organization_id=?2`,
  )
    .bind(id, org)
    .first<Record<string, unknown>>();
}
async function seedSchedules(org: string, campusId: string) {
  const count = await env.DB.prepare(
    "SELECT count(*) value FROM school_schedules WHERE organization_id=?1 AND campus_id=?2",
  )
    .bind(org, campusId)
    .first<{ value: number }>();
  if ((count?.value ?? 0) > 0) return;
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO school_schedules (id,organization_id,campus_id,name,season,starts_on,ends_on,school_starts_at,school_ends_at,break_starts_at,break_ends_at) VALUES (?1,?2,?3,'Winter schedule','winter','10-15','04-15','08:30','14:30','11:40','12:30')",
    ).bind(`schedule:${campusId}:winter`, org, campusId),
    env.DB.prepare(
      "INSERT OR IGNORE INTO school_schedules (id,organization_id,campus_id,name,season,starts_on,ends_on,school_starts_at,school_ends_at,break_starts_at,break_ends_at) VALUES (?1,?2,?3,'Summer schedule','summer','04-16','10-14','08:00','13:00','11:00','11:40')",
    ).bind(`schedule:${campusId}:summer`, org, campusId),
  ]);
}

export async function GET() {
  const auth = await authorize("timetable.view");
  if (!auth)
    return Response.json(
      { error: "You do not have permission to view the timetable." },
      { status: 403 },
    );
  const campusId = auth.activeCampusId ?? auth.campuses[0]?.id;
  if (!campusId)
    return Response.json(
      { error: "Create an active campus first." },
      { status: 400 },
    );
  const denied = await requireCampusAccess(auth, campusId, "timetable.view");
  if (denied) return denied;
  await seedSchedules(auth.organizationId, campusId);
  const [
    schedules,
    periods,
    entries,
    years,
    classes,
    sections,
    subjects,
    teachers,
    substitutions,
    teacherConflicts,
    roomConflicts,
  ] = await Promise.all([
    env.DB.prepare(
      "SELECT * FROM school_schedules WHERE organization_id=?1 AND campus_id=?2 AND status='active' ORDER BY season DESC",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT p.*,s.name schedule_name,s.season FROM timetable_periods p JOIN school_schedules s ON s.id=p.schedule_id WHERE p.organization_id=?1 AND p.campus_id=?2 AND p.status='active' ORDER BY s.season DESC,p.period_number",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT e.*,cl.name class_name,se.name section_name,s.name subject_name,s.color,st.first_name||' '||coalesce(st.last_name,'') teacher_name,p.name period_name,p.starts_at,p.ends_at FROM timetable_entries e JOIN classes cl ON cl.id=e.class_id LEFT JOIN sections se ON se.id=e.section_id LEFT JOIN subjects s ON s.id=e.subject_id LEFT JOIN staff st ON st.id=e.staff_id JOIN timetable_periods p ON p.id=e.period_id WHERE e.organization_id=?1 AND e.campus_id=?2 AND e.status='active' ORDER BY e.weekday,p.period_number",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,is_current FROM academic_years WHERE organization_id=?1 AND status!='archived' ORDER BY is_current DESC,starts_on DESC",
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
      "SELECT id,name,color FROM subjects WHERE organization_id=?1 AND status='active' AND (campus_id IS NULL OR campus_id=?2) ORDER BY name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT id,first_name||' '||coalesce(last_name,'') name,designation FROM staff WHERE organization_id=?1 AND campus_id=?2 AND status='active' ORDER BY first_name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT ts.*,e.weekday,e.schedule_id,e.period_id,e.class_id,e.section_id,e.subject_id,p.name period_name,p.starts_at,p.ends_at,cl.name class_name,se.name section_name,s.name subject_name,os.first_name||' '||coalesce(os.last_name,'') original_teacher_name,ss.first_name||' '||coalesce(ss.last_name,'') substitute_teacher_name FROM timetable_substitutions ts JOIN timetable_entries e ON e.id=ts.timetable_entry_id JOIN timetable_periods p ON p.id=e.period_id JOIN classes cl ON cl.id=e.class_id LEFT JOIN sections se ON se.id=e.section_id LEFT JOIN subjects s ON s.id=e.subject_id LEFT JOIN staff os ON os.id=ts.original_staff_id JOIN staff ss ON ss.id=ts.substitute_staff_id WHERE ts.organization_id=?1 AND ts.campus_id=?2 AND ts.status!='cancelled' ORDER BY ts.substitution_date DESC,p.period_number",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT staff_id,schedule_id,weekday,period_id,count(*) conflict_count FROM timetable_entries WHERE organization_id=?1 AND campus_id=?2 AND status='active' AND staff_id IS NOT NULL GROUP BY staff_id,schedule_id,weekday,period_id HAVING count(*)>1",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT room_name,schedule_id,weekday,period_id,count(*) conflict_count FROM timetable_entries WHERE organization_id=?1 AND campus_id=?2 AND status='active' AND room_name IS NOT NULL AND trim(room_name)!='' GROUP BY lower(room_name),schedule_id,weekday,period_id HAVING count(*)>1",
    )
      .bind(auth.organizationId, campusId)
      .all(),
  ]);
  const workload = (teachers.results as Record<string, unknown>[]).map(
    (teacher) => {
      const assigned = (entries.results as Record<string, unknown>[]).filter(
        (entry) => entry.staff_id === teacher.id,
      );
      return {
        ...teacher,
        weeklyPeriods: assigned.length,
        teachingDays: new Set(assigned.map((entry) => entry.weekday)).size,
        freePeriods: Math.max(
          0,
          (periods.results as Record<string, unknown>[]).filter(
            (period) => !period.is_break,
          ).length *
            6 -
            assigned.length,
        ),
      };
    },
  );
  return Response.json(
    {
      campusId,
      schedules: schedules.results,
      periods: periods.results,
      entries: entries.results,
      academicYears: years.results,
      classes: classes.results,
      sections: sections.results,
      subjects: subjects.results,
      teachers: teachers.results,
      workload,
      substitutions: substitutions.results,
      conflicts: [
        ...(teacherConflicts.results as Record<string, unknown>[]).map((v) => ({
          ...v,
          type: "teacher",
        })),
        ...(roomConflicts.results as Record<string, unknown>[]).map((v) => ({
          ...v,
          type: "room",
        })),
      ],
      canManage: auth.permissions.has("timetable.manage"),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const origin = requireSameOrigin(request);
  if (origin) return origin;
  const auth = await authorize("timetable.manage");
  if (!auth)
    return Response.json(
      { error: "You do not have permission to manage timetables." },
      { status: 403 },
    );
  if (!(await enforceRateLimit(auth, "timetable.change", 80, 300)))
    return Response.json(
      { error: "Too many timetable changes. Try again later." },
      { status: 429 },
    );
  const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null,
    action = clean(body?.action, 30),
    campusId = clean(body?.campusId);
  const denied = await requireCampusAccess(auth, campusId, "timetable.manage");
  if (denied) return denied;
  if (!(await owned("campuses", campusId, auth.organizationId)))
    return Response.json({ error: "Invalid campus." }, { status: 400 });
  if (action === "save_schedule") {
    const season = clean(body?.season, 20),
      name = clean(body?.name),
      startsOn = clean(body?.startsOn, 5),
      endsOn = clean(body?.endsOn, 5),
      schoolStartsAt = clean(body?.schoolStartsAt, 5),
      schoolEndsAt = clean(body?.schoolEndsAt, 5),
      breakStartsAt = clean(body?.breakStartsAt, 5),
      breakEndsAt = clean(body?.breakEndsAt, 5),
      workingDays = clean(body?.workingDays, 20) || "1,2,3,4,5,6";
    if (
      !["winter", "summer", "custom"].includes(season) ||
      !name ||
      !md.test(startsOn) ||
      !md.test(endsOn) ||
      ![schoolStartsAt, schoolEndsAt, breakStartsAt, breakEndsAt].every((v) =>
        time.test(v),
      ) ||
      schoolStartsAt >= schoolEndsAt ||
      breakStartsAt >= breakEndsAt ||
      breakStartsAt < schoolStartsAt ||
      breakEndsAt > schoolEndsAt
    )
      return Response.json(
        { error: "Enter valid schedule dates and times." },
        { status: 400 },
      );
    const existing = await env.DB.prepare(
        "SELECT id FROM school_schedules WHERE organization_id=?1 AND campus_id=?2 AND season=?3",
      )
        .bind(auth.organizationId, campusId, season)
        .first<{ id: string }>(),
      id = existing?.id ?? crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO school_schedules (id,organization_id,campus_id,name,season,starts_on,ends_on,school_starts_at,school_ends_at,break_starts_at,break_ends_at,working_days) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12) ON CONFLICT(organization_id,campus_id,season) DO UPDATE SET name=excluded.name,starts_on=excluded.starts_on,ends_on=excluded.ends_on,school_starts_at=excluded.school_starts_at,school_ends_at=excluded.school_ends_at,break_starts_at=excluded.break_starts_at,break_ends_at=excluded.break_ends_at,working_days=excluded.working_days,updated_at=unixepoch()*1000",
      ).bind(
        id,
        auth.organizationId,
        campusId,
        name,
        season,
        startsOn,
        endsOn,
        schoolStartsAt,
        schoolEndsAt,
        breakStartsAt,
        breakEndsAt,
        workingDays,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'timetable.schedule.save','school_schedule',?5,'success',?6)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        id,
        safeMetadata({ season }),
      ),
    ]);
    return Response.json({ ok: true, id });
  }
  if (action === "create_period") {
    const scheduleId = clean(body?.scheduleId),
      name = clean(body?.name),
      periodNumber = Math.max(1, Number(body?.periodNumber) || 0),
      startsAt = clean(body?.startsAt, 5),
      endsAt = clean(body?.endsAt, 5),
      isBreak = body?.isBreak === true;
    const schedule = await owned(
      "school_schedules",
      scheduleId,
      auth.organizationId,
    );
    if (
      !schedule ||
      schedule.campus_id !== campusId ||
      !name ||
      !time.test(startsAt) ||
      !time.test(endsAt) ||
      startsAt >= endsAt ||
      startsAt < String(schedule.school_starts_at) ||
      endsAt > String(schedule.school_ends_at)
    )
      return Response.json(
        { error: "Enter a valid period inside the selected school schedule." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO timetable_periods (id,organization_id,campus_id,schedule_id,name,period_number,starts_at,ends_at,is_break) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        ).bind(
          id,
          auth.organizationId,
          campusId,
          scheduleId,
          name,
          periodNumber,
          startsAt,
          endsAt,
          isBreak ? 1 : 0,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'timetable.period.create','timetable_period',?5,'success')",
        ).bind(
          crypto.randomUUID(),
          auth.organizationId,
          campusId,
          auth.userId,
          id,
        ),
      ]);
      return Response.json({ ok: true, id });
    } catch {
      return Response.json(
        { error: "That period number already exists in this schedule." },
        { status: 409 },
      );
    }
  }
  if (action === "create_entry") {
    const academicYearId = clean(body?.academicYearId),
      classId = clean(body?.classId),
      sectionId = clean(body?.sectionId) || null,
      scheduleId = clean(body?.scheduleId),
      periodId = clean(body?.periodId),
      subjectId = clean(body?.subjectId) || null,
      staffId = clean(body?.staffId) || null,
      roomName = clean(body?.roomName),
      weekday = Number(body?.weekday);
    const [year, cl, section, schedule, period, subject, teacher] =
      await Promise.all([
        owned("academic_years", academicYearId, auth.organizationId),
        owned("classes", classId, auth.organizationId),
        sectionId ? owned("sections", sectionId, auth.organizationId) : null,
        owned("school_schedules", scheduleId, auth.organizationId),
        owned("timetable_periods", periodId, auth.organizationId),
        subjectId ? owned("subjects", subjectId, auth.organizationId) : null,
        staffId ? owned("staff", staffId, auth.organizationId) : null,
      ]);
    if (
      !year ||
      !cl ||
      !schedule ||
      schedule.campus_id !== campusId ||
      !period ||
      period.schedule_id !== scheduleId ||
      weekday < 1 ||
      weekday > 6 ||
      (section &&
        (section.class_id !== classId || section.campus_id !== campusId)) ||
      (subject && subject.campus_id && subject.campus_id !== campusId) ||
      (teacher && teacher.campus_id !== campusId)
    )
      return Response.json(
        { error: "Select valid timetable values for this campus." },
        { status: 400 },
      );
    if (staffId) {
      const conflict = await env.DB.prepare(
        "SELECT id FROM timetable_entries WHERE organization_id=?1 AND campus_id=?2 AND academic_year_id=?3 AND schedule_id=?4 AND weekday=?5 AND period_id=?6 AND staff_id=?7 AND status='active'",
      )
        .bind(
          auth.organizationId,
          campusId,
          academicYearId,
          scheduleId,
          weekday,
          periodId,
          staffId,
        )
        .first();
      if (conflict)
        return Response.json(
          { error: "This teacher is already assigned during that period." },
          { status: 409 },
        );
    }
    if (roomName) {
      const roomConflict = await env.DB.prepare(
        "SELECT id FROM timetable_entries WHERE organization_id=?1 AND campus_id=?2 AND academic_year_id=?3 AND schedule_id=?4 AND weekday=?5 AND period_id=?6 AND lower(room_name)=lower(?7) AND status='active'",
      )
        .bind(
          auth.organizationId,
          campusId,
          academicYearId,
          scheduleId,
          weekday,
          periodId,
          roomName,
        )
        .first();
      if (roomConflict)
        return Response.json(
          { error: "That room is already in use during this period." },
          { status: 409 },
        );
    }
    const classConflict = await env.DB.prepare(
      "SELECT id FROM timetable_entries WHERE organization_id=?1 AND campus_id=?2 AND academic_year_id=?3 AND class_id=?4 AND section_id IS ?5 AND schedule_id=?6 AND weekday=?7 AND period_id=?8 AND status='active'",
    )
      .bind(
        auth.organizationId,
        campusId,
        academicYearId,
        classId,
        sectionId,
        scheduleId,
        weekday,
        periodId,
      )
      .first();
    if (classConflict)
      return Response.json(
        { error: "This class already has an activity in that timetable slot." },
        { status: 409 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO timetable_entries (id,organization_id,academic_year_id,campus_id,class_id,section_id,schedule_id,period_id,weekday,subject_id,staff_id,room_name,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        ).bind(
          id,
          auth.organizationId,
          academicYearId,
          campusId,
          classId,
          sectionId,
          scheduleId,
          periodId,
          weekday,
          subjectId,
          staffId,
          roomName || null,
          auth.userId,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'timetable.entry.create','timetable_entry',?5,'success',?6)",
        ).bind(
          crypto.randomUUID(),
          auth.organizationId,
          campusId,
          auth.userId,
          id,
          safeMetadata({ classId, sectionId, weekday, periodId }),
        ),
      ]);
      return Response.json({ ok: true, id });
    } catch {
      return Response.json(
        { error: "This class already has an activity in that timetable slot." },
        { status: 409 },
      );
    }
  }
  if (action === "create_substitution") {
    const timetableEntryId = clean(body?.timetableEntryId),
      substituteStaffId = clean(body?.substituteStaffId),
      substitutionDate = clean(body?.substitutionDate, 10),
      reason = clean(body?.reason, 300),
      notes = clean(body?.notes, 500) || null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(substitutionDate) || !reason)
      return Response.json(
        { error: "Choose a valid date and enter a substitution reason." },
        { status: 400 },
      );
    const entry = await env.DB.prepare(
      "SELECT * FROM timetable_entries WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND status='active'",
    )
      .bind(timetableEntryId, auth.organizationId, campusId)
      .first<Record<string, unknown>>();
    const substitute = await owned(
      "staff",
      substituteStaffId,
      auth.organizationId,
    );
    if (
      !entry ||
      !entry.staff_id ||
      !substitute ||
      substitute.campus_id !== campusId ||
      substitute.status !== "active" ||
      substituteStaffId === entry.staff_id
    )
      return Response.json(
        { error: "Select a valid timetable entry and substitute teacher." },
        { status: 400 },
      );
    const dateWeekday = new Date(`${substitutionDate}T12:00:00Z`).getUTCDay();
    if (dateWeekday !== Number(entry.weekday))
      return Response.json(
        { error: "The substitution date must match the timetable weekday." },
        { status: 400 },
      );
    const conflict = await env.DB.prepare(
      "SELECT id FROM timetable_entries WHERE organization_id=?1 AND campus_id=?2 AND academic_year_id=?3 AND schedule_id=?4 AND weekday=?5 AND period_id=?6 AND staff_id=?7 AND status='active'",
    )
      .bind(
        auth.organizationId,
        campusId,
        entry.academic_year_id,
        entry.schedule_id,
        entry.weekday,
        entry.period_id,
        substituteStaffId,
      )
      .first();
    if (conflict)
      return Response.json(
        { error: "The substitute teacher is already teaching in this period." },
        { status: 409 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO timetable_substitutions (id,organization_id,campus_id,timetable_entry_id,substitution_date,original_staff_id,substitute_staff_id,reason,notes,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        ).bind(
          id,
          auth.organizationId,
          campusId,
          timetableEntryId,
          substitutionDate,
          entry.staff_id,
          substituteStaffId,
          reason,
          notes,
          auth.userId,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'timetable.substitution.create','timetable_substitution',?5,'success',?6)",
        ).bind(
          crypto.randomUUID(),
          auth.organizationId,
          campusId,
          auth.userId,
          id,
          safeMetadata({
            timetableEntryId,
            substituteStaffId,
            substitutionDate,
          }),
        ),
      ]);
      return Response.json({ ok: true, id });
    } catch {
      return Response.json(
        {
          error:
            "A substitution already exists for this class period and date.",
        },
        { status: 409 },
      );
    }
  }
  if (action === "cancel_substitution") {
    const substitutionId = clean(body?.substitutionId),
      reason = clean(body?.reason, 300);
    if (!reason)
      return Response.json(
        { error: "Enter a reason for cancelling the substitution." },
        { status: 400 },
      );
    const changed = await env.DB.prepare(
      "UPDATE timetable_substitutions SET status='cancelled',notes=coalesce(notes,'')||?1,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3 AND campus_id=?4 AND status!='cancelled'",
    )
      .bind(
        `\nCancelled: ${reason}`,
        substitutionId,
        auth.organizationId,
        campusId,
      )
      .run();
    if (!changed.meta.changes)
      return Response.json(
        { error: "Substitution not found." },
        { status: 404 },
      );
    await env.DB.prepare(
      "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'timetable.substitution.cancel','timetable_substitution',?5,'success',?6)",
    )
      .bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        substitutionId,
        safeMetadata({ reason }),
      )
      .run();
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Invalid timetable action." }, { status: 400 });
}
