import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";
import { requireSameOrigin } from "../../../lib/security";
export const dynamic = "force-dynamic";
const clean = (v: unknown, n = 500) =>
    String(v ?? "")
      .trim()
      .slice(0, n),
  date = /^\d{4}-\d{2}-\d{2}$/;
const days = (a: string, b: string) =>
  Math.floor((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
export async function GET() {
  const auth = await authorize("staff_leave.view");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const [types, requests, balances, staff, years] = await Promise.all([
    env.DB.prepare(
      "SELECT * FROM leave_types WHERE organization_id=?1 AND status='active' ORDER BY name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      `SELECT r.*,s.employee_number,s.first_name,s.last_name,t.name leave_type_name,t.code leave_type_code,c.name campus_name FROM staff_leave_requests r JOIN staff s ON s.id=r.staff_id JOIN leave_types t ON t.id=r.leave_type_id JOIN campuses c ON c.id=r.campus_id WHERE r.organization_id=?1 ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100`,
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      `SELECT b.*,s.employee_number,s.first_name,s.last_name,t.name leave_type_name,t.code leave_type_code,(b.allocated_days+b.carried_forward_days-b.used_days) remaining_days FROM staff_leave_balances b JOIN staff s ON s.id=b.staff_id JOIN leave_types t ON t.id=b.leave_type_id WHERE b.organization_id=?1 ORDER BY s.first_name,t.name`,
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,employee_number,first_name,last_name,campus_id FROM staff WHERE organization_id=?1 AND status='active' ORDER BY first_name,last_name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,is_current FROM academic_years WHERE organization_id=?1 AND status!='archived' ORDER BY starts_on DESC",
    )
      .bind(auth.organizationId)
      .all(),
  ]);
  return Response.json(
    {
      types: types.results,
      requests: requests.results,
      balances: balances.results,
      staff: staff.results,
      academicYears: years.results,
      canApprove: auth.permissions.has("staff_leave.approve"),
      canManageTypes: auth.permissions.has("leave_types.manage"),
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
  if (action === "create_type") {
    const auth = await authorize("leave_types.manage");
    if (!auth)
      return Response.json({ error: "Permission denied." }, { status: 403 });
    const name = clean(b?.name, 80),
      code = clean(b?.code, 20).toUpperCase(),
      allowance = Number(b?.annualAllowance);
    if (!name || !code || !Number.isFinite(allowance) || allowance < 0)
      return Response.json(
        { error: "Enter a valid leave name, code and allowance." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO leave_types (id,organization_id,name,code,annual_allowance,is_paid,carry_forward) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        ).bind(
          id,
          auth.organizationId,
          name,
          code,
          allowance,
          b?.isPaid === false ? 0 : 1,
          b?.carryForward ? 1 : 0,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'staff.leave_type.create','leave_type',?4,'success')",
        ).bind(crypto.randomUUID(), auth.organizationId, auth.userId, id),
      ]);
    } catch {
      return Response.json(
        { error: "That leave code already exists." },
        { status: 409 },
      );
    }
    return Response.json({ ok: true, id });
  }
  const auth = await authorize("staff_leave.request");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const staffId = clean(b?.staffId, 80),
    typeId = clean(b?.leaveTypeId, 80),
    yearId = clean(b?.academicYearId, 80),
    starts = clean(b?.startsOn, 10),
    ends = clean(b?.endsOn, 10),
    reason = clean(b?.reason),
    total = days(starts, ends);
  if (
    !date.test(starts) ||
    !date.test(ends) ||
    total < 1 ||
    total > 365 ||
    !reason
  )
    return Response.json(
      { error: "Enter a valid date range and reason." },
      { status: 400 },
    );
  const [staff, type, year, overlap] = await Promise.all([
    env.DB.prepare(
      "SELECT id,campus_id FROM staff WHERE id=?1 AND organization_id=?2 AND status='active'",
    )
      .bind(staffId, auth.organizationId)
      .first<{ id: string; campus_id: string }>(),
    env.DB.prepare(
      "SELECT id,annual_allowance FROM leave_types WHERE id=?1 AND organization_id=?2 AND status='active'",
    )
      .bind(typeId, auth.organizationId)
      .first<{ id: string; annual_allowance: number }>(),
    env.DB.prepare(
      "SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2",
    )
      .bind(yearId, auth.organizationId)
      .first(),
    env.DB.prepare(
      "SELECT id FROM staff_leave_requests WHERE organization_id=?1 AND staff_id=?2 AND status IN ('pending','approved') AND starts_on<=?3 AND ends_on>=?4 LIMIT 1",
    )
      .bind(auth.organizationId, staffId, ends, starts)
      .first(),
  ]);
  if (!staff || !type || !year)
    return Response.json(
      { error: "Choose valid staff, leave type and academic year." },
      { status: 400 },
    );
  if (overlap)
    return Response.json(
      { error: "This staff member already has an overlapping leave request." },
      { status: 409 },
    );
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO staff_leave_balances (id,organization_id,staff_id,leave_type_id,academic_year_id,allocated_days) VALUES (?1,?2,?3,?4,?5,?6)",
    ).bind(
      crypto.randomUUID(),
      auth.organizationId,
      staffId,
      typeId,
      yearId,
      type.annual_allowance,
    ),
    env.DB.prepare(
      "INSERT INTO staff_leave_requests (id,organization_id,campus_id,staff_id,leave_type_id,academic_year_id,starts_on,ends_on,total_days,reason,requested_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
    ).bind(
      id,
      auth.organizationId,
      staff.campus_id,
      staffId,
      typeId,
      yearId,
      starts,
      ends,
      total,
      reason,
      auth.userId,
    ),
    env.DB.prepare(
      "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'staff.leave.request','staff_leave_request',?5,'success')",
    ).bind(
      crypto.randomUUID(),
      auth.organizationId,
      staff.campus_id,
      auth.userId,
      id,
    ),
  ]);
  return Response.json({ ok: true, id });
}
export async function PATCH(request: Request) {
  const same = requireSameOrigin(request);
  if (same) return same;
  const auth = await authorize("staff_leave.approve");
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
  const r = await env.DB.prepare(
    "SELECT * FROM staff_leave_requests WHERE id=?1 AND organization_id=?2 AND status='pending'",
  )
    .bind(id, auth.organizationId)
    .first<Record<string, unknown>>();
  if (!r)
    return Response.json(
      { error: "Pending leave request not found." },
      { status: 404 },
    );
  if (decision === "approved") {
    const balance = await env.DB.prepare(
      "SELECT allocated_days+carried_forward_days-used_days remaining FROM staff_leave_balances WHERE organization_id=?1 AND staff_id=?2 AND leave_type_id=?3 AND academic_year_id=?4",
    )
      .bind(
        auth.organizationId,
        r.staff_id,
        r.leave_type_id,
        r.academic_year_id,
      )
      .first<{ remaining: number }>();
    if ((balance?.remaining ?? 0) < Number(r.total_days))
      return Response.json(
        { error: "The leave balance is insufficient." },
        { status: 409 },
      );
  }
  const statements = [
    env.DB.prepare(
      "UPDATE staff_leave_requests SET status=?1,reviewed_by=?2,reviewed_at=unixepoch()*1000,review_notes=?3,updated_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5",
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
        "UPDATE staff_leave_balances SET used_days=used_days+?1,updated_at=unixepoch()*1000 WHERE organization_id=?2 AND staff_id=?3 AND leave_type_id=?4 AND academic_year_id=?5",
      ).bind(
        r.total_days,
        auth.organizationId,
        r.staff_id,
        r.leave_type_id,
        r.academic_year_id,
      ),
    );
  statements.push(
    env.DB.prepare(
      "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,?5,'staff_leave_request',?6,'success')",
    ).bind(
      crypto.randomUUID(),
      auth.organizationId,
      r.campus_id,
      auth.userId,
      `staff.leave.${decision}`,
      id,
    ),
  );
  await env.DB.batch(statements);
  return Response.json({ ok: true });
}
