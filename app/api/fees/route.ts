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
const iso = /^\d{4}-\d{2}-\d{2}$/;
export async function GET(request: Request) {
  const auth = await authorize("fees.view");
  if (!auth)
    return Response.json(
      { error: "You do not have permission to view fees." },
      { status: 403 },
    );
  const campusId = auth.activeCampusId ?? auth.campuses[0]?.id;
  if (!campusId)
    return Response.json(
      { error: "Select an active campus." },
      { status: 400 },
    );
  const denied = await requireCampusAccess(auth, campusId, "fees.view");
  if (denied) return denied;
  const url = new URL(request.url),
    today = new Date().toISOString().slice(0, 10),
    from = iso.test(url.searchParams.get("from") || "")
      ? url.searchParams.get("from")!
      : `${today.slice(0, 4)}-01-01`,
    to = iso.test(url.searchParams.get("to") || "")
      ? url.searchParams.get("to")!
      : today;
  const [
    categories,
    structures,
    items,
    assignments,
    students,
    years,
    classes,
    invoices,
    payments,
    lateFeeRules,
    lateFeeApplications,
    expenseCategories,
    expenses,
    invoiceReport,
    paymentReport,
    expenseReport,
    financialAccounts,
    approvalRequests,
    accountSummaries,
  ] = await Promise.all([
    env.DB.prepare(
      "SELECT * FROM fee_categories WHERE organization_id=?1 AND status='active' ORDER BY name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT f.*,y.name academic_year_name,c.name campus_name,cl.name class_name,coalesce(sum(i.amount),0) total_amount FROM fee_structures f JOIN academic_years y ON y.id=f.academic_year_id LEFT JOIN campuses c ON c.id=f.campus_id LEFT JOIN classes cl ON cl.id=f.class_id LEFT JOIN fee_structure_items i ON i.fee_structure_id=f.id WHERE f.organization_id=?1 AND (f.campus_id IS NULL OR f.campus_id=?2) AND f.status='active' GROUP BY f.id ORDER BY y.is_current DESC,f.name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT i.*,c.name category_name,c.frequency FROM fee_structure_items i JOIN fee_categories c ON c.id=i.fee_category_id WHERE i.organization_id=?1 ORDER BY c.name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT a.*,s.admission_number,s.first_name||' '||coalesce(s.last_name,'') student_name,f.name structure_name,coalesce(sum(i.amount),0) gross_amount FROM student_fee_assignments a JOIN students s ON s.id=a.student_id JOIN fee_structures f ON f.id=a.fee_structure_id LEFT JOIN fee_structure_items i ON i.fee_structure_id=f.id WHERE a.organization_id=?1 AND a.campus_id=?2 AND a.status='active' GROUP BY a.id ORDER BY student_name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT DISTINCT s.id,s.admission_number,s.first_name||' '||coalesce(s.last_name,'') student_name,e.class_id,c.name class_name,e.academic_year_id FROM students s JOIN enrollments e ON e.student_id=s.id AND e.status='active' LEFT JOIN classes c ON c.id=e.class_id WHERE s.organization_id=?1 AND e.campus_id=?2 AND s.status='active' ORDER BY s.first_name,s.last_name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT id,name,is_current,starts_on,ends_on FROM academic_years WHERE organization_id=?1 AND status!='archived' ORDER BY is_current DESC,starts_on DESC",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT id,name FROM classes WHERE organization_id=?1 AND status='active' AND (campus_id IS NULL OR campus_id=?2) ORDER BY sort_order,name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT i.*,s.admission_number,s.first_name||' '||coalesce(s.last_name,'') student_name,c.name class_name FROM fee_invoices i JOIN students s ON s.id=i.student_id LEFT JOIN enrollments e ON e.student_id=s.id AND e.academic_year_id=i.academic_year_id AND e.status='active' LEFT JOIN classes c ON c.id=e.class_id WHERE i.organization_id=?1 AND i.campus_id=?2 ORDER BY i.billing_month DESC,i.created_at DESC LIMIT 500",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT p.*,i.invoice_number,s.first_name||' '||coalesce(s.last_name,'') student_name FROM fee_payments p JOIN fee_invoices i ON i.id=p.invoice_id JOIN students s ON s.id=p.student_id WHERE p.organization_id=?1 AND p.campus_id=?2 AND p.status='posted' ORDER BY p.payment_date DESC,p.created_at DESC LIMIT 300",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT * FROM late_fee_rules WHERE organization_id=?1 AND (campus_id IS NULL OR campus_id=?2) AND status='active' ORDER BY created_at DESC",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT a.*,i.invoice_number,s.first_name||' '||coalesce(s.last_name,'') student_name,r.name rule_name FROM fee_late_fee_applications a JOIN fee_invoices i ON i.id=a.invoice_id JOIN students s ON s.id=i.student_id JOIN late_fee_rules r ON r.id=a.rule_id WHERE a.organization_id=?1 AND a.campus_id=?2 ORDER BY a.applied_on DESC LIMIT 300",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT * FROM expense_categories WHERE organization_id=?1 AND status='active' ORDER BY name",
    )
      .bind(auth.organizationId)
      .all(),
    env.DB.prepare(
      "SELECT e.*,c.name category_name,u.display_name created_by_name FROM expenses e JOIN expense_categories c ON c.id=e.category_id LEFT JOIN users u ON u.id=e.created_by WHERE e.organization_id=?1 AND e.campus_id=?2 AND e.status='posted' ORDER BY e.expense_date DESC,e.created_at DESC LIMIT 500",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT substr(issued_on,1,7) period,sum(total_amount) billed,sum(balance_amount) outstanding FROM fee_invoices WHERE organization_id=?1 AND campus_id=?2 AND issued_on BETWEEN ?3 AND ?4 GROUP BY period ORDER BY period",
    )
      .bind(auth.organizationId, campusId, from, to)
      .all(),
    env.DB.prepare(
      "SELECT substr(payment_date,1,7) period,sum(amount) collected FROM fee_payments WHERE organization_id=?1 AND campus_id=?2 AND status='posted' AND payment_date BETWEEN ?3 AND ?4 GROUP BY period ORDER BY period",
    )
      .bind(auth.organizationId, campusId, from, to)
      .all(),
    env.DB.prepare(
      "SELECT substr(expense_date,1,7) period,sum(amount) expenses FROM expenses WHERE organization_id=?1 AND campus_id=?2 AND status='posted' AND expense_date BETWEEN ?3 AND ?4 GROUP BY period ORDER BY period",
    )
      .bind(auth.organizationId, campusId, from, to)
      .all(),
    env.DB.prepare(
      "SELECT * FROM financial_accounts WHERE organization_id=?1 AND (campus_id IS NULL OR campus_id=?2) AND status='active' ORDER BY account_type,name",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT r.*,e.expense_date,e.payee,e.description,c.name category_name,requester.display_name requested_by_name,decider.display_name decided_by_name FROM financial_approval_requests r JOIN expenses e ON e.id=r.entity_id AND r.entity_type='expense' JOIN expense_categories c ON c.id=e.category_id LEFT JOIN users requester ON requester.id=r.requested_by LEFT JOIN users decider ON decider.id=r.decided_by WHERE r.organization_id=?1 AND r.campus_id=?2 ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 300",
    )
      .bind(auth.organizationId, campusId)
      .all(),
    env.DB.prepare(
      "SELECT a.*,coalesce((SELECT sum(p.amount) FROM fee_payments p WHERE p.organization_id=a.organization_id AND p.campus_id=?2 AND p.financial_account_id=a.id AND p.status='posted' AND p.payment_date BETWEEN ?3 AND ?4),0) period_inflow,coalesce((SELECT sum(e.amount) FROM expenses e WHERE e.organization_id=a.organization_id AND e.campus_id=?2 AND e.financial_account_id=a.id AND e.status='posted' AND e.expense_date BETWEEN ?3 AND ?4),0) period_outflow,a.opening_balance+coalesce((SELECT sum(p.amount) FROM fee_payments p WHERE p.organization_id=a.organization_id AND p.campus_id=?2 AND p.financial_account_id=a.id AND p.status='posted' AND p.payment_date<=?4),0)-coalesce((SELECT sum(e.amount) FROM expenses e WHERE e.organization_id=a.organization_id AND e.campus_id=?2 AND e.financial_account_id=a.id AND e.status='posted' AND e.expense_date<=?4),0) current_balance FROM financial_accounts a WHERE a.organization_id=?1 AND (a.campus_id IS NULL OR a.campus_id=?2) AND a.status='active' ORDER BY a.account_type,a.name",
    )
      .bind(auth.organizationId, campusId, from, to)
      .all(),
  ]);
  const periods = new Map<string, Record<string, unknown>>();
  for (const row of [
    ...invoiceReport.results,
    ...paymentReport.results,
    ...expenseReport.results,
  ]) {
    const period = String((row as Record<string, unknown>).period);
    periods.set(period, {
      ...(periods.get(period) || {
        period,
        billed: 0,
        collected: 0,
        expenses: 0,
        outstanding: 0,
      }),
      ...row,
    });
  }
  const report = [...periods.values()]
    .sort((a, b) => String(a.period).localeCompare(String(b.period)))
    .map((row) => ({
      ...row,
      net: Number(row.collected || 0) - Number(row.expenses || 0),
    }));
  const canViewFinancial = auth.permissions.has("fees.financial"),
    redact = (rows: unknown[]) =>
      canViewFinancial
        ? rows
        : rows.map((value) => {
            const row = { ...(value as Record<string, unknown>) };
            for (const key of [
              "amount",
              "gross_amount",
              "subtotal",
              "discount_amount",
              "late_fee",
              "total_amount",
              "paid_amount",
              "balance_amount",
              "billed",
              "collected",
              "expenses",
              "outstanding",
              "net",
              "value",
              "maximum_amount",
              "opening_balance",
              "period_inflow",
              "period_outflow",
              "current_balance",
            ])
              if (key in row) row[key] = null;
            return row;
          });
  return Response.json(
    {
      campusId,
      categories: categories.results,
      structures: redact(structures.results),
      items: redact(items.results),
      assignments: redact(assignments.results),
      students: students.results,
      academicYears: years.results,
      classes: classes.results,
      invoices: redact(invoices.results),
      payments: redact(payments.results),
      lateFeeRules: redact(lateFeeRules.results),
      lateFeeApplications: redact(lateFeeApplications.results),
      expenseCategories: expenseCategories.results,
      expenses: redact(expenses.results),
      report: auth.permissions.has("finance.reports") ? redact(report) : [],
      reportFrom: from,
      reportTo: to,
      financialAccounts: redact(financialAccounts.results),
      approvalRequests: redact(approvalRequests.results),
      accountSummaries: redact(accountSummaries.results),
      canManage: auth.permissions.has("fees.manage"),
      canAssign: auth.permissions.has("fees.assign"),
      canInvoice: auth.permissions.has("fees.invoice"),
      canCollect: auth.permissions.has("fees.collect"),
      canLateFees: auth.permissions.has("fees.late_fees"),
      canManageExpenses: auth.permissions.has("expenses.manage"),
      canViewReports: auth.permissions.has("finance.reports"),
      canManageAccounts: auth.permissions.has("finance.accounts"),
      canApproveFinance: auth.permissions.has("finance.approve"),
      canExportFinance: auth.permissions.has("finance.export"),
      canViewFinancial,
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
  if (!(await enforceRateLimit(auth, "fees.change", 80, 300)))
    return Response.json(
      { error: "Too many fee changes. Try again later." },
      { status: 429 },
    );
  const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null,
    action = clean(body?.action, 30),
    campusId = clean(body?.campusId),
    permission =
      action === "assign_student"
        ? "fees.assign"
        : action === "generate_invoices"
          ? "fees.invoice"
          : action === "collect_payment"
            ? "fees.collect"
            : action === "create_late_fee_rule" || action === "apply_late_fees"
              ? "fees.late_fees"
              : action === "create_expense_category" ||
                  action === "record_expense"
                ? "expenses.manage"
                : action === "create_financial_account"
                  ? "finance.accounts"
                  : action === "approve_expense" || action === "reject_expense"
                    ? "finance.approve"
                    : "fees.manage";
  if (!auth.permissions.has(permission))
    return Response.json(
      { error: "You do not have permission for this action." },
      { status: 403 },
    );
  const denied = await requireCampusAccess(auth, campusId, permission);
  if (denied) return denied;
  if (action === "create_category") {
    const name = clean(body?.name),
      code = clean(body?.code, 30).toUpperCase(),
      frequency = clean(body?.frequency, 20),
      refundable = body?.refundable === true;
    if (
      !name ||
      !code ||
      !["once", "monthly", "quarterly", "annual"].includes(frequency)
    )
      return Response.json(
        { error: "Enter a valid category name, code and frequency." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO fee_categories (id,organization_id,name,code,frequency,refundable,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7)",
        ).bind(
          id,
          auth.organizationId,
          name,
          code,
          frequency,
          refundable ? 1 : 0,
          auth.userId,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'fee.category.create','fee_category',?5,'success')",
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
        { error: "That fee category code already exists." },
        { status: 409 },
      );
    }
  }
  if (action === "create_structure") {
    const name = clean(body?.name),
      code = clean(body?.code, 30).toUpperCase(),
      academicYearId = clean(body?.academicYearId),
      classId = clean(body?.classId) || null,
      effectiveFrom = clean(body?.effectiveFrom, 10),
      dueDay = Math.max(1, Math.min(28, Number(body?.dueDay) || 10));
    if (!name || !code || !academicYearId || !iso.test(effectiveFrom))
      return Response.json(
        { error: "Complete the fee structure details." },
        { status: 400 },
      );
    const [year, klass] = await Promise.all([
      env.DB.prepare(
        "SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2",
      )
        .bind(academicYearId, auth.organizationId)
        .first(),
      classId
        ? env.DB.prepare(
            "SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3)",
          )
            .bind(classId, auth.organizationId, campusId)
            .first()
        : Promise.resolve({ id: null }),
    ]);
    if (!year || (classId && !klass))
      return Response.json(
        { error: "Invalid academic year or class." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO fee_structures (id,organization_id,campus_id,academic_year_id,class_id,name,code,effective_from,due_day,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        ).bind(
          id,
          auth.organizationId,
          campusId,
          academicYearId,
          classId,
          name,
          code,
          effectiveFrom,
          dueDay,
          auth.userId,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'fee.structure.create','fee_structure',?5,'success')",
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
        { error: "That fee structure code already exists." },
        { status: 409 },
      );
    }
  }
  if (action === "add_item") {
    const structureId = clean(body?.structureId),
      categoryId = clean(body?.categoryId),
      amount = Math.max(0, Math.round(Number(body?.amount) || 0)),
      mandatory = body?.mandatory === true;
    const [structure, category] = await Promise.all([
      env.DB.prepare(
        "SELECT id FROM fee_structures WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3)",
      )
        .bind(structureId, auth.organizationId, campusId)
        .first(),
      env.DB.prepare(
        "SELECT id FROM fee_categories WHERE id=?1 AND organization_id=?2 AND status='active'",
      )
        .bind(categoryId, auth.organizationId)
        .first(),
    ]);
    if (!structure || !category)
      return Response.json(
        { error: "Invalid fee structure or category." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO fee_structure_items (id,organization_id,fee_structure_id,fee_category_id,amount,mandatory) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(fee_structure_id,fee_category_id) DO UPDATE SET amount=excluded.amount,mandatory=excluded.mandatory,updated_at=unixepoch()*1000",
      ).bind(
        id,
        auth.organizationId,
        structureId,
        categoryId,
        amount,
        mandatory ? 1 : 0,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'fee.structure.item.save','fee_structure',?5,'success',?6)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        structureId,
        safeMetadata({ categoryId, amount }),
      ),
    ]);
    return Response.json({ ok: true });
  }
  if (action === "assign_student") {
    const studentId = clean(body?.studentId),
      structureId = clean(body?.structureId),
      discountType = clean(body?.discountType, 20) || "none",
      discountValue = Math.max(0, Math.round(Number(body?.discountValue) || 0)),
      discountReason = clean(body?.discountReason, 300) || null,
      startsOn = clean(body?.startsOn, 10);
    if (
      !studentId ||
      !structureId ||
      !iso.test(startsOn) ||
      !["none", "fixed", "percentage"].includes(discountType) ||
      (discountType === "percentage" && discountValue > 100)
    )
      return Response.json(
        { error: "Enter a valid student fee assignment." },
        { status: 400 },
      );
    const [student, structure] = await Promise.all([
      env.DB.prepare(
        "SELECT s.id,e.academic_year_id,e.class_id FROM students s JOIN enrollments e ON e.student_id=s.id AND e.status='active' WHERE s.id=?1 AND s.organization_id=?2 AND e.campus_id=?3",
      )
        .bind(studentId, auth.organizationId, campusId)
        .first<{ id: string; academic_year_id: string; class_id: string }>(),
      env.DB.prepare(
        "SELECT id,academic_year_id,class_id FROM fee_structures WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'",
      )
        .bind(structureId, auth.organizationId, campusId)
        .first<{
          id: string;
          academic_year_id: string;
          class_id: string | null;
        }>(),
    ]);
    if (
      !student ||
      !structure ||
      student.academic_year_id !== structure.academic_year_id ||
      (structure.class_id && structure.class_id !== student.class_id)
    )
      return Response.json(
        {
          error:
            "The selected structure does not match this student's enrollment.",
        },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO student_fee_assignments (id,organization_id,campus_id,academic_year_id,student_id,fee_structure_id,discount_type,discount_value,discount_reason,starts_on,assigned_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11) ON CONFLICT(academic_year_id,student_id) DO UPDATE SET fee_structure_id=excluded.fee_structure_id,discount_type=excluded.discount_type,discount_value=excluded.discount_value,discount_reason=excluded.discount_reason,starts_on=excluded.starts_on,assigned_by=excluded.assigned_by,updated_at=unixepoch()*1000",
      ).bind(
        id,
        auth.organizationId,
        campusId,
        student.academic_year_id,
        studentId,
        structureId,
        discountType,
        discountValue,
        discountReason,
        startsOn,
        auth.userId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'student.fee.assign','student',?5,'success',?6)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        studentId,
        safeMetadata({ structureId, discountType, discountValue }),
      ),
    ]);
    return Response.json({ ok: true });
  }
  if (action === "generate_invoices") {
    const billingMonth = clean(body?.billingMonth, 7),
      issuedOn = clean(body?.issuedOn, 10),
      dueOn = clean(body?.dueOn, 10);
    if (
      !/^\d{4}-\d{2}$/.test(billingMonth) ||
      !iso.test(issuedOn) ||
      !iso.test(dueOn) ||
      dueOn < issuedOn
    )
      return Response.json(
        { error: "Enter a valid billing month, issue date and due date." },
        { status: 400 },
      );
    const assignments = await env.DB.prepare(
      "SELECT a.*,s.admission_number,f.due_day FROM student_fee_assignments a JOIN students s ON s.id=a.student_id JOIN fee_structures f ON f.id=a.fee_structure_id WHERE a.organization_id=?1 AND a.campus_id=?2 AND a.status='active' AND a.starts_on<=?3 AND (a.ends_on IS NULL OR a.ends_on>=?3)",
    )
      .bind(auth.organizationId, campusId, `${billingMonth}-28`)
      .all<Record<string, unknown>>();
    let created = 0,
      skipped = 0;
    for (const assignment of assignments.results) {
      const existing = await env.DB.prepare(
        "SELECT id FROM fee_invoices WHERE academic_year_id=?1 AND student_id=?2 AND billing_month=?3",
      )
        .bind(assignment.academic_year_id, assignment.student_id, billingMonth)
        .first();
      if (existing) {
        skipped++;
        continue;
      }
      const rows = await env.DB.prepare(
        "SELECT i.fee_category_id,i.amount,c.name,c.frequency FROM fee_structure_items i JOIN fee_categories c ON c.id=i.fee_category_id WHERE i.organization_id=?1 AND i.fee_structure_id=?2 AND i.mandatory=1 AND c.status='active'",
      )
        .bind(auth.organizationId, assignment.fee_structure_id)
        .all<Record<string, unknown>>();
      const month = billingMonth.slice(5),
        startMonth = String(assignment.starts_on).slice(5, 7),
        applicable = rows.results.filter(
          (v) =>
            v.frequency === "monthly" ||
            (v.frequency === "quarterly" &&
              ["01", "04", "07", "10"].includes(month)) ||
            (["annual", "once"].includes(String(v.frequency)) &&
              month === startMonth),
        );
      const subtotal = applicable.reduce((n, v) => n + Number(v.amount), 0),
        discount =
          assignment.discount_type === "percentage"
            ? Math.round((subtotal * Number(assignment.discount_value)) / 100)
            : assignment.discount_type === "fixed"
              ? Math.min(subtotal, Number(assignment.discount_value))
              : 0,
        total = Math.max(0, subtotal - discount),
        invoiceId = crypto.randomUUID(),
        invoiceNumber = `INV-${billingMonth.replace("-", "")}-${String(
          assignment.admission_number,
        )
          .replace(/[^A-Za-z0-9]/g, "")
          .slice(-12)}`;
      const statements = [
        env.DB.prepare(
          "INSERT INTO fee_invoices (id,organization_id,campus_id,academic_year_id,student_id,fee_assignment_id,invoice_number,billing_month,issued_on,due_on,subtotal,discount_amount,total_amount,balance_amount,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?13,?14)",
        ).bind(
          invoiceId,
          auth.organizationId,
          campusId,
          assignment.academic_year_id,
          assignment.student_id,
          assignment.id,
          invoiceNumber,
          billingMonth,
          issuedOn,
          dueOn,
          subtotal,
          discount,
          total,
          auth.userId,
        ),
        ...applicable.map((v) =>
          env.DB.prepare(
            "INSERT INTO fee_invoice_items (id,organization_id,invoice_id,fee_category_id,description,amount) VALUES (?1,?2,?3,?4,?5,?6)",
          ).bind(
            crypto.randomUUID(),
            auth.organizationId,
            invoiceId,
            v.fee_category_id,
            v.name,
            v.amount,
          ),
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'fee.invoice.generate','fee_invoice',?5,'success',?6)",
        ).bind(
          crypto.randomUUID(),
          auth.organizationId,
          campusId,
          auth.userId,
          invoiceId,
          safeMetadata({ billingMonth, total }),
        ),
      ];
      await env.DB.batch(statements);
      created++;
    }
    return Response.json({ ok: true, created, skipped });
  }
  if (action === "collect_payment") {
    const invoiceId = clean(body?.invoiceId),
      financialAccountId = clean(body?.financialAccountId),
      amount = Math.max(1, Math.round(Number(body?.amount) || 0)),
      paymentDate = clean(body?.paymentDate, 10),
      paymentMethod = clean(body?.paymentMethod, 20),
      referenceNumber = clean(body?.referenceNumber, 80) || null,
      notes = clean(body?.notes, 300) || null;
    if (
      !invoiceId ||
      !financialAccountId ||
      !iso.test(paymentDate) ||
      !["cash", "bank", "card", "online", "cheque"].includes(paymentMethod)
    )
      return Response.json(
        { error: "Enter valid payment details." },
        { status: 400 },
      );
    const invoice = await env.DB.prepare(
      "SELECT id,student_id,balance_amount FROM fee_invoices WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND status IN ('unpaid','partial')",
    )
      .bind(invoiceId, auth.organizationId, campusId)
      .first<{ id: string; student_id: string; balance_amount: number }>();
    const account = await env.DB.prepare(
      "SELECT id FROM financial_accounts WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'",
    )
      .bind(financialAccountId, auth.organizationId, campusId)
      .first();
    if (!invoice || !account)
      return Response.json(
        {
          error:
            "Select an outstanding invoice and financial account from this campus.",
        },
        { status: 400 },
      );
    if (amount > invoice.balance_amount)
      return Response.json(
        { error: "Payment cannot exceed the outstanding balance." },
        { status: 400 },
      );
    const id = crypto.randomUUID(),
      receiptNumber = `RCP-${paymentDate.replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      balance = invoice.balance_amount - amount,
      status = balance === 0 ? "paid" : "partial";
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO fee_payments (id,organization_id,campus_id,invoice_id,student_id,receipt_number,amount,payment_date,payment_method,reference_number,notes,received_by,financial_account_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
      ).bind(
        id,
        auth.organizationId,
        campusId,
        invoiceId,
        invoice.student_id,
        receiptNumber,
        amount,
        paymentDate,
        paymentMethod,
        referenceNumber,
        notes,
        auth.userId,
        financialAccountId,
      ),
      env.DB.prepare(
        "UPDATE fee_invoices SET paid_amount=paid_amount+?1,balance_amount=?2,status=?3,updated_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5 AND campus_id=?6",
      ).bind(amount, balance, status, invoiceId, auth.organizationId, campusId),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'fee.payment.collect','fee_payment',?5,'success',?6)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        id,
        safeMetadata({ invoiceId, amount, receiptNumber }),
      ),
    ]);
    return Response.json({ ok: true, id, receiptNumber });
  }
  if (action === "create_late_fee_rule") {
    const name = clean(body?.name),
      academicYearId = clean(body?.academicYearId) || null,
      calculationType = clean(body?.calculationType, 20),
      value = Math.max(0, Math.round(Number(body?.value) || 0)),
      graceDays = Math.max(
        0,
        Math.min(90, Math.round(Number(body?.graceDays) || 0)),
      ),
      maximumAmount = body?.maximumAmount
        ? Math.max(0, Math.round(Number(body.maximumAmount)))
        : null;
    if (
      !name ||
      !["fixed", "percentage"].includes(calculationType) ||
      value < 1 ||
      (calculationType === "percentage" && value > 100)
    )
      return Response.json(
        { error: "Enter a valid late-fee rule." },
        { status: 400 },
      );
    if (academicYearId) {
      const year = await env.DB.prepare(
        "SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2",
      )
        .bind(academicYearId, auth.organizationId)
        .first();
      if (!year)
        return Response.json(
          { error: "Invalid academic year." },
          { status: 400 },
        );
    }
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO late_fee_rules (id,organization_id,campus_id,academic_year_id,name,calculation_type,value,grace_days,maximum_amount,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
      ).bind(
        id,
        auth.organizationId,
        campusId,
        academicYearId,
        name,
        calculationType,
        value,
        graceDays,
        maximumAmount,
        auth.userId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'fee.late_rule.create','late_fee_rule',?5,'success')",
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
  if (action === "apply_late_fees") {
    const ruleId = clean(body?.ruleId),
      appliedOn = clean(body?.appliedOn, 10);
    if (!ruleId || !iso.test(appliedOn))
      return Response.json(
        { error: "Select a rule and valid application date." },
        { status: 400 },
      );
    const rule = await env.DB.prepare(
      "SELECT * FROM late_fee_rules WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'",
    )
      .bind(ruleId, auth.organizationId, campusId)
      .first<Record<string, unknown>>();
    if (!rule)
      return Response.json(
        { error: "Late-fee rule not found for this campus." },
        { status: 404 },
      );
    const overdue = await env.DB.prepare(
      "SELECT i.id,i.balance_amount FROM fee_invoices i WHERE i.organization_id=?1 AND i.campus_id=?2 AND i.status IN ('unpaid','partial') AND date(i.due_on,'+'||?3||' days')<?4 AND (?5 IS NULL OR i.academic_year_id=?5) AND NOT EXISTS (SELECT 1 FROM fee_late_fee_applications a WHERE a.invoice_id=i.id AND a.rule_id=?6)",
    )
      .bind(
        auth.organizationId,
        campusId,
        Number(rule.grace_days),
        appliedOn,
        rule.academic_year_id || null,
        ruleId,
      )
      .all<{ id: string; balance_amount: number }>();
    let applied = 0,
      total = 0;
    for (const invoice of overdue.results) {
      let amount =
        rule.calculation_type === "percentage"
          ? Math.round((invoice.balance_amount * Number(rule.value)) / 100)
          : Number(rule.value);
      if (rule.maximum_amount)
        amount = Math.min(amount, Number(rule.maximum_amount));
      if (amount < 1) continue;
      const applicationId = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO fee_late_fee_applications (id,organization_id,campus_id,invoice_id,rule_id,amount,applied_on,applied_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
        ).bind(
          applicationId,
          auth.organizationId,
          campusId,
          invoice.id,
          ruleId,
          amount,
          appliedOn,
          auth.userId,
        ),
        env.DB.prepare(
          "UPDATE fee_invoices SET late_fee=late_fee+?1,total_amount=total_amount+?1,balance_amount=balance_amount+?1,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3 AND campus_id=?4",
        ).bind(amount, invoice.id, auth.organizationId, campusId),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'fee.late_fee.apply','fee_invoice',?5,'success',?6)",
        ).bind(
          crypto.randomUUID(),
          auth.organizationId,
          campusId,
          auth.userId,
          invoice.id,
          safeMetadata({ ruleId, amount, appliedOn }),
        ),
      ]);
      applied++;
      total += amount;
    }
    return Response.json({ ok: true, applied, total });
  }
  if (action === "create_expense_category") {
    const name = clean(body?.name),
      code = clean(body?.code, 30).toUpperCase();
    if (!name || !code)
      return Response.json(
        { error: "Enter an expense category name and code." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO expense_categories (id,organization_id,name,code,created_by) VALUES (?1,?2,?3,?4,?5)",
        ).bind(id, auth.organizationId, name, code, auth.userId),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'expense.category.create','expense_category',?5,'success')",
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
        { error: "That expense category code already exists." },
        { status: 409 },
      );
    }
  }
  if (action === "record_expense") {
    const categoryId = clean(body?.categoryId),
      financialAccountId = clean(body?.financialAccountId),
      expenseDate = clean(body?.expenseDate, 10),
      amount = Math.max(1, Math.round(Number(body?.amount) || 0)),
      payee = clean(body?.payee),
      description = clean(body?.description, 500),
      paymentMethod = clean(body?.paymentMethod, 20),
      referenceNumber = clean(body?.referenceNumber, 80) || null;
    if (
      !categoryId ||
      !financialAccountId ||
      !iso.test(expenseDate) ||
      !payee ||
      !description ||
      !["cash", "bank", "card", "online", "cheque"].includes(paymentMethod)
    )
      return Response.json(
        { error: "Complete all required expense details." },
        { status: 400 },
      );
    const [category, account] = await Promise.all([
      env.DB.prepare(
        "SELECT id FROM expense_categories WHERE id=?1 AND organization_id=?2 AND status='active'",
      )
        .bind(categoryId, auth.organizationId)
        .first(),
      env.DB.prepare(
        "SELECT id FROM financial_accounts WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'",
      )
        .bind(financialAccountId, auth.organizationId, campusId)
        .first(),
    ]);
    if (!category || !account)
      return Response.json(
        { error: "Invalid expense category or financial account." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO expenses (id,organization_id,campus_id,category_id,expense_date,amount,payee,description,payment_method,reference_number,created_by,status,financial_account_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'pending',?12)",
      ).bind(
        id,
        auth.organizationId,
        campusId,
        categoryId,
        expenseDate,
        amount,
        payee,
        description,
        paymentMethod,
        referenceNumber,
        auth.userId,
        financialAccountId,
      ),
      env.DB.prepare(
        "INSERT INTO financial_approval_requests (id,organization_id,campus_id,entity_type,entity_id,amount,requested_by) VALUES (?1,?2,?3,'expense',?4,?5,?6)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        id,
        amount,
        auth.userId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'expense.create','expense',?5,'success',?6)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        id,
        safeMetadata({ amount, categoryId, expenseDate }),
      ),
    ]);
    return Response.json({ ok: true, id });
  }
  if (action === "create_financial_account") {
    const name = clean(body?.name),
      code = clean(body?.code, 30).toUpperCase(),
      accountType = clean(body?.accountType, 20),
      bankName = clean(body?.bankName) || null,
      accountNumberMasked = clean(body?.accountNumberMasked, 40) || null,
      openingBalance = Math.round(Number(body?.openingBalance) || 0),
      campusScope = body?.schoolWide === true ? null : campusId;
    if (!name || !code || !["cash", "bank"].includes(accountType))
      return Response.json(
        { error: "Enter a valid cash or bank account." },
        { status: 400 },
      );
    if (accountType === "bank" && !bankName)
      return Response.json(
        { error: "Bank name is required for bank accounts." },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO financial_accounts (id,organization_id,campus_id,name,code,account_type,bank_name,account_number_masked,opening_balance,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        ).bind(
          id,
          auth.organizationId,
          campusScope,
          name,
          code,
          accountType,
          bankName,
          accountNumberMasked,
          openingBalance,
          auth.userId,
        ),
        env.DB.prepare(
          "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'finance.account.create','financial_account',?5,'success')",
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
        { error: "That financial account code already exists." },
        { status: 409 },
      );
    }
  }
  if (action === "approve_expense" || action === "reject_expense") {
    const approvalId = clean(body?.approvalId),
      decisionNotes = clean(body?.decisionNotes, 300) || null,
      decision = action === "approve_expense" ? "approved" : "rejected";
    const approval = await env.DB.prepare(
      "SELECT id,entity_id,requested_by FROM financial_approval_requests WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND entity_type='expense' AND status='pending'",
    )
      .bind(approvalId, auth.organizationId, campusId)
      .first<{ id: string; entity_id: string; requested_by: string }>();
    if (!approval)
      return Response.json(
        { error: "Pending approval not found for this campus." },
        { status: 404 },
      );
    if (approval.requested_by === auth.userId)
      return Response.json(
        { error: "You cannot approve or reject your own expense request." },
        { status: 403 },
      );
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE financial_approval_requests SET status=?1,decided_by=?2,decision_notes=?3,decided_at=unixepoch()*1000,updated_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5 AND campus_id=?6 AND status='pending'",
      ).bind(
        decision,
        auth.userId,
        decisionNotes,
        approvalId,
        auth.organizationId,
        campusId,
      ),
      env.DB.prepare(
        "UPDATE expenses SET status=?1,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3 AND campus_id=?4 AND status='pending'",
      ).bind(
        decision === "approved" ? "posted" : "rejected",
        approval.entity_id,
        auth.organizationId,
        campusId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,?5,'expense',?6,'success',?7)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        campusId,
        auth.userId,
        `expense.${decision}`,
        approval.entity_id,
        safeMetadata({ approvalId, decisionNotes }),
      ),
    ]);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unsupported action." }, { status: 400 });
}
