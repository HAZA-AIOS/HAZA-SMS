import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";
import { requireSameOrigin } from "../../../lib/security";
export const dynamic = "force-dynamic";
const clean = (v: unknown, n = 500) =>
    String(v ?? "")
      .trim()
      .slice(0, n),
  date = /^\d{4}-\d{2}-\d{2}$/,
  month = /^\d{4}-\d{2}$/;
export async function GET(request: Request) {
  const auth = await authorize("payroll.view");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const u = new URL(request.url),
    periodId = u.searchParams.get("periodId") || "";
  const [components, assignments, periods, items, staff, campuses] =
    await Promise.all([
      env.DB.prepare(
        "SELECT * FROM salary_components WHERE organization_id=?1 AND is_active=1 ORDER BY component_type,name",
      )
        .bind(auth.organizationId)
        .all(),
      env.DB.prepare(
        `SELECT a.*,s.employee_number,s.first_name,s.last_name,s.designation,c.name campus_name,coalesce(sum(CASE WHEN sc.component_type='earning' THEN x.value ELSE 0 END),0) earnings,coalesce(sum(CASE WHEN sc.component_type='deduction' THEN x.value ELSE 0 END),0) deductions FROM staff_salary_assignments a JOIN staff s ON s.id=a.staff_id JOIN campuses c ON c.id=a.campus_id LEFT JOIN staff_salary_components x ON x.salary_assignment_id=a.id LEFT JOIN salary_components sc ON sc.id=x.component_id WHERE a.organization_id=?1 AND a.status='active' GROUP BY a.id ORDER BY s.first_name`,
      )
        .bind(auth.organizationId)
        .all(),
      env.DB.prepare(
        `SELECT p.*,u.display_name approved_by_name,count(i.id) staff_count,coalesce(sum(i.net_salary),0) net_total FROM payroll_periods p LEFT JOIN users u ON u.id=p.approved_by LEFT JOIN payroll_items i ON i.payroll_period_id=p.id WHERE p.organization_id=?1 GROUP BY p.id ORDER BY p.period_month DESC LIMIT 24`,
      )
        .bind(auth.organizationId)
        .all(),
      periodId
        ? env.DB.prepare(
            `SELECT i.*,s.employee_number,s.first_name,s.last_name,s.designation,c.name campus_name FROM payroll_items i JOIN staff s ON s.id=i.staff_id JOIN campuses c ON c.id=i.campus_id WHERE i.organization_id=?1 AND i.payroll_period_id=?2 ORDER BY c.name,s.first_name`,
          )
            .bind(auth.organizationId, periodId)
            .all()
        : Promise.resolve({ results: [] }),
      env.DB.prepare(
        "SELECT id,employee_number,first_name,last_name,designation,campus_id FROM staff WHERE organization_id=?1 AND status='active' ORDER BY first_name,last_name",
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
      components: components.results,
      assignments: assignments.results,
      periods: periods.results,
      items: items.results,
      staff: staff.results,
      campuses: campuses.results,
      selectedPeriodId: periodId,
      canConfigure: auth.permissions.has("payroll.configure"),
      canGenerate: auth.permissions.has("payroll.generate"),
      canApprove: auth.permissions.has("payroll.approve"),
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
  if (action === "create_component") {
    const auth = await authorize("payroll.configure");
    if (!auth)
      return Response.json({ error: "Permission denied." }, { status: 403 });
    const name = clean(b?.name, 80),
      code = clean(b?.code, 20).toUpperCase(),
      type = clean(b?.componentType, 20),
      calc = clean(b?.calculationType, 20),
      value = Number(b?.defaultValue);
    if (
      !name ||
      !code ||
      !["earning", "deduction"].includes(type) ||
      !["fixed", "percentage"].includes(calc) ||
      !Number.isFinite(value) ||
      value < 0
    )
      return Response.json(
        { error: "Enter a valid salary component." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO salary_components (id,organization_id,name,code,component_type,calculation_type,default_value,is_taxable) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        ).bind(
          id,
          auth.organizationId,
          name,
          code,
          type,
          calc,
          value,
          b?.isTaxable ? 1 : 0,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'payroll.component.create','salary_component',?4,'success')",
        ).bind(crypto.randomUUID(), auth.organizationId, auth.userId, id),
      ]);
    } catch {
      return Response.json(
        { error: "That salary component code already exists." },
        { status: 409 },
      );
    }
    return Response.json({ ok: true, id });
  }
  if (action === "assign_salary") {
    const auth = await authorize("payroll.configure");
    if (!auth)
      return Response.json({ error: "Permission denied." }, { status: 403 });
    const staffId = clean(b?.staffId, 80),
      base = Number(b?.baseSalary),
      effective = clean(b?.effectiveFrom, 10),
      method = clean(b?.paymentMethod, 30),
      components = Array.isArray(b?.components)
        ? (b.components as Record<string, unknown>[])
        : [];
    const staff = await env.DB.prepare(
      "SELECT id,campus_id FROM staff WHERE id=?1 AND organization_id=?2 AND status='active'",
    )
      .bind(staffId, auth.organizationId)
      .first<{ id: string; campus_id: string }>();
    if (
      !staff ||
      !Number.isFinite(base) ||
      base <= 0 ||
      !date.test(effective) ||
      !["bank_transfer", "cash", "cheque"].includes(method)
    )
      return Response.json(
        { error: "Choose valid staff and salary details." },
        { status: 400 },
      );
    const id = crypto.randomUUID(),
      statements = [
        env.DB.prepare(
          "UPDATE staff_salary_assignments SET status='superseded',effective_to=date(?1,'-1 day'),updated_at=unixepoch()*1000 WHERE organization_id=?2 AND staff_id=?3 AND status='active'",
        ).bind(effective, auth.organizationId, staffId),
        env.DB.prepare(
          "INSERT INTO staff_salary_assignments (id,organization_id,campus_id,staff_id,base_salary,effective_from,payment_method,notes,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        ).bind(
          id,
          auth.organizationId,
          staff.campus_id,
          staffId,
          base,
          effective,
          method,
          clean(b?.notes) || null,
          auth.userId,
        ),
      ];
    for (const c of components) {
      const componentId = clean(c.componentId, 80),
        value = Number(c.value);
      if (componentId && Number.isFinite(value) && value >= 0)
        statements.push(
          env.DB.prepare(
            "INSERT INTO staff_salary_components (id,organization_id,salary_assignment_id,component_id,value) SELECT ?1,?2,?3,id,?4 FROM salary_components WHERE id=?5 AND organization_id=?2",
          ).bind(
            crypto.randomUUID(),
            auth.organizationId,
            id,
            value,
            componentId,
          ),
        );
    }
    statements.push(
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'payroll.salary.assign','staff_salary_assignment',?5,'success')",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        staff.campus_id,
        auth.userId,
        id,
      ),
    );
    await env.DB.batch(statements);
    return Response.json({ ok: true, id });
  }
  if (action === "create_period") {
    const auth = await authorize("payroll.generate");
    if (!auth)
      return Response.json({ error: "Permission denied." }, { status: 403 });
    const m = clean(b?.periodMonth, 7),
      starts = clean(b?.startsOn, 10),
      ends = clean(b?.endsOn, 10),
      pay = clean(b?.payDate, 10);
    if (
      !month.test(m) ||
      !date.test(starts) ||
      !date.test(ends) ||
      starts > ends ||
      (pay && !date.test(pay))
    )
      return Response.json(
        { error: "Enter a valid payroll period." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO payroll_periods (id,organization_id,name,period_month,starts_on,ends_on,pay_date,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        ).bind(
          id,
          auth.organizationId,
          new Date(`${m}-01T00:00:00Z`).toLocaleString("en", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }),
          m,
          starts,
          ends,
          pay || null,
          auth.userId,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'payroll.period.create','payroll_period',?4,'success')",
        ).bind(crypto.randomUUID(), auth.organizationId, auth.userId, id),
      ]);
    } catch {
      return Response.json(
        { error: "A payroll period already exists for that month." },
        { status: 409 },
      );
    }
    return Response.json({ ok: true, id });
  }
  if (action === "generate") {
    const auth = await authorize("payroll.generate");
    if (!auth)
      return Response.json({ error: "Permission denied." }, { status: 403 });
    const periodId = clean(b?.periodId, 80),
      period = await env.DB.prepare(
        "SELECT * FROM payroll_periods WHERE id=?1 AND organization_id=?2 AND status='draft'",
      )
        .bind(periodId, auth.organizationId)
        .first<Record<string, unknown>>();
    if (!period)
      return Response.json(
        { error: "Draft payroll period not found." },
        { status: 404 },
      );
    const salaries = (
      await env.DB.prepare(
        `SELECT a.*,coalesce(sum(CASE WHEN c.component_type='earning' THEN CASE WHEN c.calculation_type='percentage' THEN a.base_salary*x.value/100 ELSE x.value END ELSE 0 END),0) earnings,coalesce(sum(CASE WHEN c.component_type='deduction' THEN CASE WHEN c.calculation_type='percentage' THEN a.base_salary*x.value/100 ELSE x.value END ELSE 0 END),0) deductions FROM staff_salary_assignments a JOIN staff s ON s.id=a.staff_id AND s.status='active' LEFT JOIN staff_salary_components x ON x.salary_assignment_id=a.id LEFT JOIN salary_components c ON c.id=x.component_id WHERE a.organization_id=?1 AND a.status='active' AND a.effective_from<=?2 GROUP BY a.id`,
      )
        .bind(auth.organizationId, period.ends_on)
        .all<Record<string, unknown>>()
    ).results;
    const statements = [];
    for (const a of salaries) {
      const absent = await env.DB.prepare(
          "SELECT count(*) value FROM staff_attendance WHERE organization_id=?1 AND staff_id=?2 AND attendance_date BETWEEN ?3 AND ?4 AND status='absent'",
        )
          .bind(
            auth.organizationId,
            a.staff_id,
            period.starts_on,
            period.ends_on,
          )
          .first<{ value: number }>(),
        base = Number(a.base_salary),
        absence = Number(((base / 30) * (absent?.value ?? 0)).toFixed(2)),
        earnings = Number(a.earnings),
        deductions = Number(a.deductions),
        net = Number((base + earnings - deductions - absence).toFixed(2));
      statements.push(
        env.DB.prepare(
          "INSERT INTO payroll_items (id,organization_id,payroll_period_id,campus_id,staff_id,salary_assignment_id,base_salary,earnings,deductions,absence_deduction,net_salary,details_json) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12) ON CONFLICT(organization_id,payroll_period_id,staff_id) DO UPDATE SET base_salary=excluded.base_salary,earnings=excluded.earnings,deductions=excluded.deductions,absence_deduction=excluded.absence_deduction,net_salary=excluded.net_salary,details_json=excluded.details_json,updated_at=unixepoch()*1000",
        ).bind(
          crypto.randomUUID(),
          auth.organizationId,
          periodId,
          a.campus_id,
          a.staff_id,
          a.id,
          base,
          earnings,
          deductions,
          absence,
          net,
          JSON.stringify({ absentDays: absent?.value ?? 0 }),
        ),
      );
    }
    statements.push(
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'payroll.generate','payroll_period',?4,'success',?5)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        auth.userId,
        periodId,
        JSON.stringify({ staffCount: salaries.length }),
      ),
    );
    await env.DB.batch(statements);
    return Response.json({ ok: true, count: salaries.length });
  }
  return Response.json(
    { error: "Select a valid payroll action." },
    { status: 400 },
  );
}
export async function PATCH(request: Request) {
  const same = requireSameOrigin(request);
  if (same) return same;
  const auth = await authorize("payroll.approve");
  if (!auth)
    return Response.json({ error: "Permission denied." }, { status: 403 });
  const b = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null,
    id = clean(b?.id, 80),
    decision = clean(b?.decision, 20);
  if (!["approved", "reopened"].includes(decision))
    return Response.json(
      { error: "Choose approve or reopen." },
      { status: 400 },
    );
  const status = decision === "approved" ? "approved" : "draft";
  const result = await env.DB.prepare(
    "UPDATE payroll_periods SET status=?1,approved_by=?2,approved_at=?3,updated_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5 AND status!=?1",
  )
    .bind(
      status,
      decision === "approved" ? auth.userId : null,
      decision === "approved" ? Date.now() : null,
      id,
      auth.organizationId,
    )
    .run();
  if (!result.meta.changes)
    return Response.json(
      { error: "Payroll period was not found or is already in that state." },
      { status: 409 },
    );
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE payroll_items SET status=?1,updated_at=unixepoch()*1000 WHERE payroll_period_id=?2 AND organization_id=?3",
    ).bind(status, id, auth.organizationId),
    env.DB.prepare(
      "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'payroll_period',?5,'success')",
    ).bind(
      crypto.randomUUID(),
      auth.organizationId,
      auth.userId,
      `payroll.${decision}`,
      id,
    ),
  ]);
  return Response.json({ ok: true, status });
}
