import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";
import { requireSameOrigin } from "../../../lib/security";
export const dynamic = "force-dynamic";
const date = /^\d{4}-\d{2}-\d{2}$/,
  time = /^([01]\d|2[0-3]):[0-5]\d$/,
  statuses = new Set([
    "present",
    "absent",
    "late",
    "leave",
    "half_day",
    "official_duty",
  ]);
const clean = (v: unknown, n = 500) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
const minutes = (a: string, b: string) => {
  if (!a || !b) return null;
  const [ah, am] = a.split(":").map(Number),
    [bh, bm] = b.split(":").map(Number);
  return Math.max(0, bh * 60 + bm - ah * 60 - am);
};
export async function GET(request: Request) {
  const auth = await authorize("staff_attendance.view");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const u = new URL(request.url),
    day = u.searchParams.get("date") || new Date().toISOString().slice(0, 10),
    campus = u.searchParams.get("campusId") || "",
    month = u.searchParams.get("month") || day.slice(0, 7),
    campusSql = campus ? " AND s.campus_id=?3" : "";
  const bind = (sql: string) =>
    campus
      ? env.DB.prepare(sql).bind(auth.organizationId, day, campus)
      : env.DB.prepare(sql).bind(auth.organizationId, day);
  const [roster, summary, monthly, corrections, campuses] = await Promise.all([
    bind(
      `SELECT s.id staff_id,s.employee_number,s.first_name,s.last_name,s.designation,s.department,s.campus_id,c.name campus_name,a.id attendance_id,a.status,a.check_in,a.check_out,a.late_minutes,a.worked_minutes,a.notes FROM staff s JOIN campuses c ON c.id=s.campus_id LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.organization_id=s.organization_id AND a.attendance_date=?2 WHERE s.organization_id=?1 AND s.status='active'${campusSql} ORDER BY c.name,s.first_name,s.last_name`,
    ).all(),
    bind(
      `SELECT count(*) total,sum(CASE WHEN a.status='present' THEN 1 ELSE 0 END) present,sum(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) absent,sum(CASE WHEN a.status='late' THEN 1 ELSE 0 END) late,sum(CASE WHEN a.status='leave' THEN 1 ELSE 0 END) on_leave FROM staff s LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.organization_id=s.organization_id AND a.attendance_date=?2 WHERE s.organization_id=?1 AND s.status='active'${campusSql}`,
    ).first(),
    env.DB.prepare(
      `SELECT s.id staff_id,s.employee_number,s.first_name,s.last_name,s.designation,count(a.id) marked,sum(CASE WHEN a.status='present' THEN 1 ELSE 0 END) present,sum(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) absent,sum(CASE WHEN a.status='late' THEN 1 ELSE 0 END) late,sum(CASE WHEN a.status='leave' THEN 1 ELSE 0 END) on_leave,sum(a.late_minutes) late_minutes FROM staff s LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.organization_id=s.organization_id AND substr(a.attendance_date,1,7)=?2 WHERE s.organization_id=?1 AND s.status='active' ${campus ? "AND s.campus_id=?3" : ""} GROUP BY s.id ORDER BY s.first_name`,
    )
      .bind(auth.organizationId, month, ...(campus ? [campus] : []))
      .all(),
    env.DB.prepare(
      `SELECT x.*,s.employee_number,s.first_name,s.last_name,a.attendance_date FROM staff_attendance_corrections x JOIN staff s ON s.id=x.staff_id JOIN staff_attendance a ON a.id=x.attendance_id WHERE x.organization_id=?1 ORDER BY CASE x.status WHEN 'pending' THEN 0 ELSE 1 END,x.created_at DESC LIMIT 50`,
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name",
    )
      .bind(auth.organizationId)
      .all(),
  ]);
  return Response.json(
    {
      date: day,
      month,
      roster: roster.results,
      summary,
      campusId: campus,
      monthly: monthly.results,
      corrections: corrections.results,
      campuses: campuses.results,
      canManage: auth.permissions.has("staff_attendance.manage"),
      canCorrect: auth.permissions.has("staff_attendance.correct"),
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
    action = clean(b?.action, 30);
  if (action === "request_correction") {
    const auth = await authorize("staff_attendance.correct");
    if (!auth)
      return Response.json({ error: "Permission denied." }, { status: 403 });
    const attendanceId = clean(b?.attendanceId, 80),
      status = clean(b?.status, 30),
      reason = clean(b?.reason);
    if (!attendanceId || !statuses.has(status) || !reason)
      return Response.json(
        { error: "Choose the corrected status and provide a reason." },
        { status: 400 },
      );
    const row = await env.DB.prepare(
      "SELECT id,staff_id FROM staff_attendance WHERE id=?1 AND organization_id=?2",
    )
      .bind(attendanceId, auth.organizationId)
      .first<{ id: string; staff_id: string }>();
    if (!row)
      return Response.json(
        { error: "Attendance record not found." },
        { status: 404 },
      );
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO staff_attendance_corrections (id,organization_id,attendance_id,staff_id,requested_status,requested_check_in,requested_check_out,reason,requested_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
      ).bind(
        id,
        auth.organizationId,
        row.id,
        row.staff_id,
        status,
        clean(b?.checkIn, 5) || null,
        clean(b?.checkOut, 5) || null,
        reason,
        auth.userId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'staff.attendance.correction.request','attendance_correction',?4,'success')",
      ).bind(crypto.randomUUID(), auth.organizationId, auth.userId, id),
    ]);
    return Response.json({ ok: true, id });
  }
  const auth = await authorize("staff_attendance.manage");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const day = clean(b?.date, 10),
    entries = Array.isArray(b?.entries)
      ? (b.entries as Record<string, unknown>[])
      : [];
  if (!date.test(day) || !entries.length || entries.length > 300)
    return Response.json(
      { error: "Choose a valid date and attendance entries." },
      { status: 400 },
    );
  const ids = [...new Set(entries.map((v) => clean(v.staffId, 80)))],
    staff = (
      await env.DB.prepare(
        `SELECT id,campus_id FROM staff WHERE organization_id=?1 AND status='active' AND id IN (${ids.map((_, i) => `?${i + 2}`).join(",") || "NULL"})`,
      )
        .bind(auth.organizationId, ...ids)
        .all<{ id: string; campus_id: string }>()
    ).results,
    map = new Map(staff.map((v) => [v.id, v.campus_id]));
  if (map.size !== ids.length)
    return Response.json(
      { error: "One or more staff records are outside your school." },
      { status: 400 },
    );
  const statements = [];
  for (const e of entries) {
    const staffId = clean(e.staffId, 80),
      status = clean(e.status, 30),
      checkIn = clean(e.checkIn, 5),
      checkOut = clean(e.checkOut, 5);
    if (
      !statuses.has(status) ||
      (checkIn && !time.test(checkIn)) ||
      (checkOut && !time.test(checkOut))
    )
      return Response.json(
        { error: "An attendance row contains an invalid status or time." },
        { status: 400 },
      );
    const id = crypto.randomUUID(),
      late =
        status === "late" && checkIn
          ? Math.max(0, minutes("09:00", checkIn) ?? 0)
          : 0;
    statements.push(
      env.DB.prepare(
        "INSERT INTO staff_attendance (id,organization_id,campus_id,staff_id,attendance_date,status,check_in,check_out,late_minutes,worked_minutes,notes,recorded_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12) ON CONFLICT(organization_id,staff_id,attendance_date) DO UPDATE SET status=excluded.status,check_in=excluded.check_in,check_out=excluded.check_out,late_minutes=excluded.late_minutes,worked_minutes=excluded.worked_minutes,notes=excluded.notes,recorded_by=excluded.recorded_by,updated_at=unixepoch()*1000",
      ).bind(
        id,
        auth.organizationId,
        map.get(staffId),
        staffId,
        day,
        status,
        checkIn || null,
        checkOut || null,
        late,
        minutes(checkIn, checkOut),
        clean(e.notes, 300) || null,
        auth.userId,
      ),
    );
  }
  statements.push(
    env.DB.prepare(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,outcome,metadata_json) VALUES (?1,?2,?3,'staff.attendance.bulk_save','staff_attendance','success',?4)",
    ).bind(
      crypto.randomUUID(),
      auth.organizationId,
      auth.userId,
      JSON.stringify({ date: day, count: entries.length }),
    ),
  );
  await env.DB.batch(statements);
  return Response.json({ ok: true, count: entries.length });
}
export async function PATCH(request: Request) {
  const same = requireSameOrigin(request);
  if (same) return same;
  const auth = await authorize("staff_attendance.manage");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const b = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null,
    id = clean(b?.id, 80),
    decision = clean(b?.decision, 20);
  if (!["approved", "rejected"].includes(decision))
    return Response.json(
      { error: "Choose approve or reject." },
      { status: 400 },
    );
  const correction = await env.DB.prepare(
    "SELECT * FROM staff_attendance_corrections WHERE id=?1 AND organization_id=?2 AND status='pending'",
  )
    .bind(id, auth.organizationId)
    .first<Record<string, unknown>>();
  if (!correction)
    return Response.json(
      { error: "Pending correction not found." },
      { status: 404 },
    );
  const statements = [
    env.DB.prepare(
      "UPDATE staff_attendance_corrections SET status=?1,reviewed_by=?2,reviewed_at=unixepoch()*1000,review_notes=?3,updated_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5",
    ).bind(
      decision,
      auth.userId,
      clean(b?.notes, 400) || null,
      id,
      auth.organizationId,
    ),
  ];
  if (decision === "approved")
    statements.push(
      env.DB.prepare(
        "UPDATE staff_attendance SET status=?1,check_in=?2,check_out=?3,updated_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5",
      ).bind(
        correction.requested_status,
        correction.requested_check_in,
        correction.requested_check_out,
        correction.attendance_id,
        auth.organizationId,
      ),
    );
  statements.push(
    env.DB.prepare(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'attendance_correction',?5,'success')",
    ).bind(
      crypto.randomUUID(),
      auth.organizationId,
      auth.userId,
      `staff.attendance.correction.${decision}`,
      id,
    ),
  );
  await env.DB.batch(statements);
  return Response.json({ ok: true });
}
