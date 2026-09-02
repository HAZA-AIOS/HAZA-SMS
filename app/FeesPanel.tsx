"use client";
import { FormEvent, useEffect, useState } from "react";
import { cn, moduleSurface } from "./ui/TailwindPrimitives";
type Row = Record<string, unknown> & { id: string; name?: string };
type Data = {
  campusId: string;
  categories: Row[];
  structures: Row[];
  items: Row[];
  assignments: Row[];
  students: Row[];
  academicYears: Row[];
  classes: Row[];
  invoices: Row[];
  payments: Row[];
  lateFeeRules: Row[];
  lateFeeApplications: Row[];
  expenseCategories: Row[];
  expenses: Row[];
  report: Row[];
  financialAccounts: Row[];
  approvalRequests: Row[];
  accountSummaries: Row[];
  reportFrom: string;
  reportTo: string;
  canManage: boolean;
  canAssign: boolean;
  canInvoice: boolean;
  canCollect: boolean;
  canLateFees: boolean;
  canManageExpenses: boolean;
  canViewReports: boolean;
  canManageAccounts: boolean;
  canApproveFinance: boolean;
  canExportFinance: boolean;
  canViewFinancial: boolean;
};
const empty: Data = {
  campusId: "",
  categories: [],
  structures: [],
  items: [],
  assignments: [],
  students: [],
  academicYears: [],
  classes: [],
  invoices: [],
  payments: [],
  lateFeeRules: [],
  lateFeeApplications: [],
  expenseCategories: [],
  expenses: [],
  report: [],
  financialAccounts: [],
  approvalRequests: [],
  accountSummaries: [],
  reportFrom: "",
  reportTo: "",
  canManage: false,
  canAssign: false,
  canInvoice: false,
  canCollect: false,
  canLateFees: false,
  canManageExpenses: false,
  canViewReports: false,
  canManageAccounts: false,
  canApproveFinance: false,
  canExportFinance: false,
  canViewFinancial: false,
};
const money = (v: unknown) => `PKR ${Number(v || 0).toLocaleString()}`;
async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body)
    throw new Error(
      "The fees service returned an empty response. Please refresh and try again.",
    );
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(
      "The fees service returned an invalid response. Please refresh and try again.",
    );
  }
}
export default function FeesPanel() {
  const [data, setData] = useState<Data>(empty),
    [tab, setTab] = useState("invoices"),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState(""),
    [reportFrom, setReportFrom] = useState(""),
    [reportTo, setReportTo] = useState("");
  const load = async (from = reportFrom, to = reportTo) => {
    setBusy(true);
    try {
      const query = from && to ? `?from=${from}&to=${to}` : "",
        r = await fetch(`/api/fees${query}`, { cache: "no-store" }),
        j = await readJson<Data & { error?: string }>(r);
      if (!r.ok) throw new Error(j.error || "Unable to load fees.");
      setData(j);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load fees.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const send = async (e: FormEvent<HTMLFormElement>, action: string) => {
    e.preventDefault();
    setMessage("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if ("refundable" in values) values.refundable = true;
    if ("mandatory" in values) values.mandatory = true;
    if ("schoolWide" in values) values.schoolWide = true;
    const r = await fetch("/api/fees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, campusId: data.campusId, ...values }),
      }),
      j = await readJson<{ error?: string }>(r);
    if (!r.ok) {
      setMessage(j.error || "Unable to save.");
      return;
    }
    e.currentTarget.reset();
    await load();
  };
  const decide = async (
    approvalId: string,
    action: "approve_expense" | "reject_expense",
  ) => {
    const decisionNotes = window.prompt("Decision notes (optional)") || "";
    const r = await fetch("/api/fees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          campusId: data.campusId,
          approvalId,
          decisionNotes,
        }),
      }),
      j = await readJson<{ error?: string }>(r);
    if (!r.ok) return setMessage(j.error || "Unable to save decision.");
    await load();
  };
  const currentYear =
      data.academicYears.find((v) => v.is_current) || data.academicYears[0],
    assignedStudents = new Set(data.assignments.map((v) => v.student_id)),
    unassigned = data.students.filter((v) => !assignedStudents.has(v.id));
  if (busy)
    return (
      <div className="foundation-page">
        <div className="timetable-loading">Loading fee foundation…</div>
      </div>
    );
  return (
    <div className={cn("foundation-page fees-page",moduleSurface)}>
      <div className="phase-heading">
        <div>
          <span className="eyebrow">
            PHASE 7D · CASH, BANK, APPROVALS & EXPORTS
          </span>
          <h1>Cash, bank and financial governance</h1>
          <p>
            Track account balances, approve expenses independently and export
            secure financial reports.
          </p>
        </div>
        <span className="phase-badge complete">
          {currentYear?.name || "Academic year"}
        </span>
      </div>
      <section className="fee-summary">
        <article>
          <span>💳</span>
          <b>
            {data.canViewFinancial
              ? money(
                  data.payments.reduce((n, v) => n + Number(v.amount || 0), 0),
                )
              : "Protected"}
          </b>
          <small>Total collected</small>
        </article>
        <article>
          <span>🧾</span>
          <b>
            {data.canViewFinancial
              ? money(
                  data.expenses.reduce((n, v) => n + Number(v.amount || 0), 0),
                )
              : "Protected"}
          </b>
          <small>Total expenses</small>
        </article>
        <article>
          <span>📈</span>
          <b>
            {data.canViewFinancial
              ? money(
                  data.payments.reduce((n, v) => n + Number(v.amount || 0), 0) -
                    data.expenses.reduce(
                      (n, v) => n + Number(v.amount || 0),
                      0,
                    ),
                )
              : "Protected"}
          </b>
          <small>Net cash position</small>
        </article>
        <article>
          <span>💰</span>
          <b>
            {data.canViewFinancial
              ? money(
                  data.invoices.reduce(
                    (n, v) => n + Number(v.balance_amount || 0),
                    0,
                  ),
                )
              : "Protected"}
          </b>
          <small>Outstanding balance</small>
        </article>
      </section>
      {message && <p className="timetable-message">{message}</p>}
      <section className="fee-workspace">
        <nav>
          {[
            ["invoices", "Monthly invoices"],
            ["payments", "Payments & receipts"],
            ["generate", "Generate invoices"],
            ["collect", "Collect payment"],
            ["late-fees", "Late fees"],
            ["expenses", "Expenses"],
            ["reports", "Financial reports"],
            ["accounts", "Cash & bank"],
            ["approvals", "Approvals"],
            ["structures", "Fee structures"],
            ["categories", "Categories"],
            ["assignments", "Student assignments"],
            ["setup", "Create structure"],
            ["assign", "Assign student"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === "invoices" &&
          (data.invoices.length ? (
            <div className="invoice-table">
              <div className="head">
                <span>Invoice</span>
                <span>Student</span>
                <span>Month / due</span>
                <span>Total</span>
                <span>Paid</span>
                <span>Balance</span>
                <span>Status</span>
              </div>
              {data.invoices.map((v) => (
                <div key={v.id}>
                  <span>
                    <b>{v.invoice_number as string}</b>
                    <small>{v.class_name as string}</small>
                  </span>
                  <span>
                    <b>{v.student_name as string}</b>
                    <small>{v.admission_number as string}</small>
                  </span>
                  <span>
                    {v.billing_month as string}
                    <small>Due {v.due_on as string}</small>
                  </span>
                  <span>
                    {data.canViewFinancial
                      ? money(v.total_amount)
                      : "Protected"}
                  </span>
                  <span>
                    {data.canViewFinancial ? money(v.paid_amount) : "—"}
                  </span>
                  <span>
                    {data.canViewFinancial ? money(v.balance_amount) : "—"}
                  </span>
                  <span>
                    <i className={String(v.status)}>{String(v.status)}</i>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="academic-empty">
              <span>🧾</span>
              <h3>No monthly invoices yet</h3>
              <p>Generate invoices from active student fee assignments.</p>
              {data.canInvoice && (
                <button onClick={() => setTab("generate")}>
                  ＋ Generate invoices
                </button>
              )}
            </div>
          ))}
        {tab === "payments" &&
          (data.payments.length ? (
            <div className="payment-grid">
              {data.payments.map((v) => (
                <article key={v.id}>
                  <span>✅</span>
                  <div>
                    <small>{v.receipt_number as string}</small>
                    <h3>{v.student_name as string}</h3>
                    <p>
                      {v.invoice_number as string} ·{" "}
                      {String(v.payment_method).toUpperCase()} ·{" "}
                      {v.payment_date as string}
                    </p>
                  </div>
                  <b>{data.canViewFinancial ? money(v.amount) : "Protected"}</b>
                  <a
                    href={`/api/fees/receipts/${v.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🖨 Print receipt
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="academic-empty">
              <span>💳</span>
              <h3>No payments collected</h3>
              <p>
                Collected payments and their printable receipts will appear
                here.
              </p>
              {data.canCollect && (
                <button onClick={() => setTab("collect")}>
                  ＋ Collect payment
                </button>
              )}
            </div>
          ))}
        {tab === "generate" && (
          <div className="fee-forms">
            <form onSubmit={(e) => send(e, "generate_invoices")}>
              <header>
                <span>🧾</span>
                <div>
                  <h2>Generate monthly invoices</h2>
                  <p>
                    Creates one invoice per active student assignment and skips
                    duplicates.
                  </p>
                </div>
              </header>
              <label>
                Billing month
                <input type="month" name="billingMonth" required />
              </label>
              <div>
                <label>
                  Issue date
                  <input type="date" name="issuedOn" required />
                </label>
                <label>
                  Due date
                  <input type="date" name="dueOn" required />
                </label>
              </div>
              <button disabled={!data.canInvoice}>Generate invoices</button>
            </form>
          </div>
        )}
        {tab === "collect" && (
          <div className="fee-forms">
            <form onSubmit={(e) => send(e, "collect_payment")}>
              <header>
                <span>💳</span>
                <div>
                  <h2>Collect fee payment</h2>
                  <p>
                    Post a full or partial payment against an outstanding
                    invoice.
                  </p>
                </div>
              </header>
              <label>
                Outstanding invoice
                <select name="invoiceId" required>
                  <option value="">Select invoice</option>
                  {data.invoices
                    .filter((v) => Number(v.balance_amount) > 0)
                    .map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.invoice_number} · {v.student_name} · Balance{" "}
                        {money(v.balance_amount)}
                      </option>
                    ))}
                </select>
              </label>
              <div>
                <label>
                  Amount received
                  <input type="number" min="1" name="amount" required />
                </label>
                <label>
                  Payment date
                  <input type="date" name="paymentDate" required />
                </label>
                <label>
                  Payment method
                  <select name="paymentMethod">
                    <option value="cash">Cash</option>
                    <option value="bank">Bank transfer</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </label>
                <label>
                  Deposit account
                  <select name="financialAccountId" required>
                    <option value="">Select cash or bank account</option>
                    {data.financialAccounts.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} · {v.account_type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Reference number
                <input
                  name="referenceNumber"
                  placeholder="Bank, cheque or transaction reference"
                />
              </label>
              <label>
                Notes
                <input name="notes" />
              </label>
              <button disabled={!data.canCollect}>
                Post payment and create receipt
              </button>
            </form>
          </div>
        )}
        {tab === "late-fees" && (
          <div className="finance-split">
            <section>
              <h2>Late-fee rules</h2>
              {data.lateFeeRules.map((v) => (
                <article className="finance-list-card" key={v.id}>
                  <span>⏱️</span>
                  <div>
                    <b>{v.name as string}</b>
                    <small>
                      {v.grace_days as number} grace days ·{" "}
                      {v.calculation_type === "percentage"
                        ? `${v.value}%`
                        : money(v.value)}
                    </small>
                  </div>
                </article>
              ))}
              {!data.lateFeeRules.length && (
                <p className="finance-empty">No late-fee rules created.</p>
              )}
            </section>
            <div className="fee-forms compact">
              <form onSubmit={(e) => send(e, "create_late_fee_rule")}>
                <h2>Create late-fee rule</h2>
                <label>
                  Rule name
                  <input
                    name="name"
                    placeholder="Monthly overdue charge"
                    required
                  />
                </label>
                <div>
                  <label>
                    Calculation
                    <select name="calculationType">
                      <option value="fixed">Fixed amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </label>
                  <label>
                    Value
                    <input name="value" type="number" min="1" required />
                  </label>
                </div>
                <div>
                  <label>
                    Grace days
                    <input
                      name="graceDays"
                      type="number"
                      min="0"
                      max="90"
                      defaultValue="5"
                    />
                  </label>
                  <label>
                    Maximum amount
                    <input name="maximumAmount" type="number" min="0" />
                  </label>
                </div>
                <label>
                  Academic year
                  <select name="academicYearId">
                    <option value="">All years</option>
                    {data.academicYears.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={!data.canLateFees}>Save rule</button>
              </form>
              <form onSubmit={(e) => send(e, "apply_late_fees")}>
                <h2>Apply late fees</h2>
                <label>
                  Rule
                  <select name="ruleId" required>
                    <option value="">Select rule</option>
                    {data.lateFeeRules.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Apply as of
                  <input name="appliedOn" type="date" required />
                </label>
                <button disabled={!data.canLateFees}>
                  Apply to eligible invoices
                </button>
              </form>
            </div>
          </div>
        )}
        {tab === "expenses" && (
          <div className="finance-split">
            <section>
              <h2>Expense register</h2>
              {data.expenses.map((v) => (
                <article className="finance-list-card" key={v.id}>
                  <span>💸</span>
                  <div>
                    <b>{v.payee as string}</b>
                    <small>
                      {v.expense_date as string} · {v.category_name as string} ·{" "}
                      {v.description as string}
                    </small>
                  </div>
                  <strong>
                    {data.canViewFinancial ? money(v.amount) : "Protected"}
                  </strong>
                </article>
              ))}
              {!data.expenses.length && (
                <p className="finance-empty">
                  No expenses recorded for this campus.
                </p>
              )}
            </section>
            <div className="fee-forms compact">
              <form onSubmit={(e) => send(e, "record_expense")}>
                <h2>Record expense</h2>
                <label>
                  Category
                  <select name="categoryId" required>
                    <option value="">Select category</option>
                    {data.expenseCategories.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <label>
                    Date
                    <input name="expenseDate" type="date" required />
                  </label>
                  <label>
                    Amount
                    <input name="amount" type="number" min="1" required />
                  </label>
                </div>
                <label>
                  Paid to
                  <input name="payee" required />
                </label>
                <label>
                  Description
                  <input name="description" required />
                </label>
                <div>
                  <label>
                    Method
                    <select name="paymentMethod">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank transfer</option>
                      <option value="card">Card</option>
                      <option value="online">Online</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </label>
                  <label>
                    Reference
                    <input name="referenceNumber" />
                  </label>
                </div>
                <button disabled={!data.canManageExpenses}>
                  Record expense
                </button>
              </form>
              <form onSubmit={(e) => send(e, "create_expense_category")}>
                <h2>Add expense category</h2>
                <label>
                  Name
                  <input name="name" placeholder="Utilities" required />
                </label>
                <label>
                  Code
                  <input name="code" placeholder="UTILITIES" required />
                </label>
                <button disabled={!data.canManageExpenses}>Add category</button>
              </form>
            </div>
          </div>
        )}
        {tab === "reports" && (
          <div className="financial-report">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void load(reportFrom, reportTo);
              }}
            >
              <label>
                From
                <input
                  type="date"
                  value={reportFrom}
                  onChange={(e) => setReportFrom(e.target.value)}
                  required
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={reportTo}
                  onChange={(e) => setReportTo(e.target.value)}
                  required
                />
              </label>
              <button disabled={!data.canViewReports}>Run report</button>
            </form>
            <div className="invoice-table finance-report-table">
              <div className="head">
                <span>Month</span>
                <span>Billed</span>
                <span>Collected</span>
                <span>Expenses</span>
                <span>Outstanding</span>
                <span>Net cash</span>
              </div>
              {data.report.map((v) => (
                <div key={v.period as string}>
                  <span>
                    <b>{v.period as string}</b>
                  </span>
                  <span>{money(v.billed)}</span>
                  <span>{money(v.collected)}</span>
                  <span>{money(v.expenses)}</span>
                  <span>{money(v.outstanding)}</span>
                  <span>
                    <b>{money(v.net)}</b>
                  </span>
                </div>
              ))}
            </div>
            <div className="report-actions">
              <a
                className={!data.canExportFinance ? "disabled" : ""}
                href={`/api/fees/reports/export?format=csv&from=${reportFrom || data.reportFrom}&to=${reportTo || data.reportTo}`}
              >
                ⬇ Export CSV
              </a>
              <a
                className={!data.canExportFinance ? "disabled" : ""}
                target="_blank"
                rel="noreferrer"
                href={`/api/fees/reports/export?format=print&from=${reportFrom || data.reportFrom}&to=${reportTo || data.reportTo}`}
              >
                🖨 Printable report
              </a>
            </div>
            {!data.report.length && (
              <p className="finance-empty">
                No financial activity in the selected period.
              </p>
            )}
          </div>
        )}
        {tab === "accounts" && (
          <div className="finance-split">
            <section>
              <h2>Cash and bank summary</h2>
              {data.accountSummaries.map((v) => (
                <article className="account-summary-card" key={v.id}>
                  <span>{v.account_type === "cash" ? "💵" : "🏦"}</span>
                  <div>
                    <small>
                      {v.code as string} · {v.bank_name || "Cash account"}
                    </small>
                    <h3>{v.name as string}</h3>
                  </div>
                  <dl>
                    <div>
                      <dt>Inflow</dt>
                      <dd>
                        {data.canViewFinancial
                          ? money(v.period_inflow)
                          : "Protected"}
                      </dd>
                    </div>
                    <div>
                      <dt>Outflow</dt>
                      <dd>
                        {data.canViewFinancial
                          ? money(v.period_outflow)
                          : "Protected"}
                      </dd>
                    </div>
                    <div>
                      <dt>Balance</dt>
                      <dd>
                        {data.canViewFinancial
                          ? money(v.current_balance)
                          : "Protected"}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
              {!data.accountSummaries.length && (
                <p className="finance-empty">
                  Create the first cash or bank account.
                </p>
              )}
            </section>
            <div className="fee-forms compact">
              <form onSubmit={(e) => send(e, "create_financial_account")}>
                <h2>Create financial account</h2>
                <label>
                  Account name
                  <input name="name" placeholder="Main cash counter" required />
                </label>
                <div>
                  <label>
                    Code
                    <input name="code" placeholder="CASH-MAIN" required />
                  </label>
                  <label>
                    Type
                    <select name="accountType">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank</option>
                    </select>
                  </label>
                </div>
                <label>
                  Bank name
                  <input
                    name="bankName"
                    placeholder="Required only for bank accounts"
                  />
                </label>
                <label>
                  Masked account number
                  <input name="accountNumberMasked" placeholder="•••• 1234" />
                </label>
                <label>
                  Opening balance
                  <input name="openingBalance" type="number" defaultValue="0" />
                </label>
                <label className="check-line">
                  <input type="checkbox" name="schoolWide" /> Available to all
                  campuses
                </label>
                <button disabled={!data.canManageAccounts}>
                  Create account
                </button>
              </form>
            </div>
          </div>
        )}
        {tab === "approvals" && (
          <div className="approval-list">
            <header>
              <div>
                <h2>Financial approvals</h2>
                <p>Expense requesters cannot approve their own entries.</p>
              </div>
              <span>
                {
                  data.approvalRequests.filter((v) => v.status === "pending")
                    .length
                }{" "}
                pending
              </span>
            </header>
            {data.approvalRequests.map((v) => (
              <article key={v.id}>
                <span>
                  {v.status === "pending"
                    ? "⏳"
                    : v.status === "approved"
                      ? "✅"
                      : "⛔"}
                </span>
                <div>
                  <b>{v.payee as string}</b>
                  <small>
                    {v.expense_date as string} · {v.category_name as string} ·
                    Requested by {v.requested_by_name as string}
                  </small>
                  <p>{v.description as string}</p>
                </div>
                <strong>
                  {data.canViewFinancial ? money(v.amount) : "Protected"}
                </strong>
                {v.status === "pending" && data.canApproveFinance && (
                  <div className="approval-actions">
                    <button
                      onClick={() => void decide(v.id, "approve_expense")}
                    >
                      Approve
                    </button>
                    <button
                      className="reject"
                      onClick={() => void decide(v.id, "reject_expense")}
                    >
                      Reject
                    </button>
                  </div>
                )}
                {v.status !== "pending" && (
                  <i className={String(v.status)}>{String(v.status)}</i>
                )}
              </article>
            ))}
            {!data.approvalRequests.length && (
              <p className="finance-empty">No financial approval requests.</p>
            )}
          </div>
        )}
        {tab === "structures" &&
          (data.structures.length ? (
            <div className="fee-structure-grid">
              {data.structures.map((v) => (
                <article key={v.id}>
                  <header>
                    <span>📋</span>
                    <div>
                      <small>{v.code as string}</small>
                      <h3>{v.name as string}</h3>
                    </div>
                    <b>
                      {data.canViewFinancial
                        ? money(v.total_amount)
                        : "Protected"}
                    </b>
                  </header>
                  <p>
                    {v.class_name || "All classes"} ·{" "}
                    {v.campus_name || "School-wide"}
                  </p>
                  <small>
                    {v.academic_year_name as string} · Due by day{" "}
                    {v.due_day as number}
                  </small>
                  <div>
                    {data.items
                      .filter((i) => i.fee_structure_id === v.id)
                      .map((i) => (
                        <span key={i.id}>
                          {i.category_name as string}
                          <b>{data.canViewFinancial ? money(i.amount) : "—"}</b>
                        </span>
                      ))}
                  </div>
                  {data.canManage && (
                    <form onSubmit={(e) => send(e, "add_item")}>
                      <input type="hidden" name="structureId" value={v.id} />
                      <select name="categoryId" required>
                        <option value="">Add category</option>
                        {data.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        name="amount"
                        type="number"
                        min="0"
                        placeholder="Amount"
                        required
                      />
                      <label>
                        <input
                          type="checkbox"
                          name="mandatory"
                          defaultChecked
                        />{" "}
                        Mandatory
                      </label>
                      <button>Save item</button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="academic-empty">
              <span>📋</span>
              <h3>No fee structures yet</h3>
              <p>Create the first academic-year fee structure.</p>
              {data.canManage && (
                <button onClick={() => setTab("setup")}>
                  ＋ Create fee structure
                </button>
              )}
            </div>
          ))}
        {tab === "categories" &&
          (data.categories.length ? (
            <div className="fee-category-list">
              {data.categories.map((v) => (
                <article key={v.id}>
                  <span>
                    {v.frequency === "monthly"
                      ? "🗓️"
                      : v.refundable
                        ? "🔐"
                        : "🏷️"}
                  </span>
                  <div>
                    <h3>{v.name as string}</h3>
                    <p>
                      {v.code as string} · {String(v.frequency)}
                    </p>
                  </div>
                  <b>{v.refundable ? "Refundable" : "Non-refundable"}</b>
                </article>
              ))}
            </div>
          ) : (
            <div className="academic-empty">
              <span>🧩</span>
              <h3>No fee categories</h3>
              <p>Add tuition, admission, transport or other fee categories.</p>
            </div>
          ))}
        {tab === "categories" && data.canManage && (
          <form
            className="fee-inline-form"
            onSubmit={(e) => send(e, "create_category")}
          >
            <h3>Add fee category</h3>
            <input name="name" placeholder="Monthly tuition" required />
            <input name="code" placeholder="TUITION" required />
            <select name="frequency">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="once">One time</option>
            </select>
            <label>
              <input type="checkbox" name="refundable" /> Refundable
            </label>
            <button>Add category</button>
          </form>
        )}
        {tab === "assignments" &&
          (data.assignments.length ? (
            <div className="fee-assignment-table">
              <div className="head">
                <span>Student</span>
                <span>Fee structure</span>
                <span>Base fee</span>
                <span>Concession</span>
                <span>Effective from</span>
              </div>
              {data.assignments.map((v) => (
                <div key={v.id}>
                  <span>
                    <b>{v.student_name as string}</b>
                    <small>{v.admission_number as string}</small>
                  </span>
                  <span>{v.structure_name as string}</span>
                  <span>
                    {data.canViewFinancial
                      ? money(v.gross_amount)
                      : "Protected"}
                  </span>
                  <span>
                    {v.discount_type === "none"
                      ? "None"
                      : `${v.discount_value} ${v.discount_type === "percentage" ? "%" : "PKR"}`}
                    <small>{v.discount_reason as string}</small>
                  </span>
                  <span>{v.starts_on as string}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="academic-empty">
              <span>🎓</span>
              <h3>No student fee assignments</h3>
              <p>Assign a suitable structure to each enrolled student.</p>
              {data.canAssign && (
                <button onClick={() => setTab("assign")}>
                  ＋ Assign student fee
                </button>
              )}
            </div>
          ))}
        {tab === "setup" && (
          <div className="fee-forms">
            <form onSubmit={(e) => send(e, "create_structure")}>
              <header>
                <span>📋</span>
                <div>
                  <h2>Create fee structure</h2>
                  <p>Set the scope and collection rules.</p>
                </div>
              </header>
              <label>
                Structure name
                <input
                  name="name"
                  placeholder="Grade 1 Standard Fee"
                  required
                />
              </label>
              <div>
                <label>
                  Code
                  <input name="code" placeholder="G1-2026" required />
                </label>
                <label>
                  Academic year
                  <select name="academicYearId" required>
                    <option value="">Select year</option>
                    {data.academicYears.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Paid from account
                  <select name="financialAccountId" required>
                    <option value="">Select cash or bank account</option>
                    {data.financialAccounts.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} · {v.account_type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label>
                  Class scope
                  <select name="classId">
                    <option value="">All classes</option>
                    {data.classes.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Effective from
                  <input name="effectiveFrom" type="date" required />
                </label>
                <label>
                  Monthly due day
                  <input
                    name="dueDay"
                    type="number"
                    min="1"
                    max="28"
                    defaultValue="10"
                  />
                </label>
              </div>
              <button disabled={!data.canManage}>Create structure</button>
            </form>
          </div>
        )}
        {tab === "assign" && (
          <div className="fee-forms">
            <form onSubmit={(e) => send(e, "assign_student")}>
              <header>
                <span>🎓</span>
                <div>
                  <h2>Assign student fee</h2>
                  <p>
                    The structure must match the student's academic year and
                    class.
                  </p>
                </div>
              </header>
              <label>
                Student
                <select name="studentId" required>
                  <option value="">Select enrolled student</option>
                  {data.students.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.student_name} · {v.admission_number} · {v.class_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fee structure
                <select name="structureId" required>
                  <option value="">Select structure</option>
                  {data.structures.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.class_name || "All classes"}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <label>
                  Discount type
                  <select name="discountType">
                    <option value="none">No discount</option>
                    <option value="fixed">Fixed amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </label>
                <label>
                  Discount value
                  <input
                    name="discountValue"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                </label>
                <label>
                  Effective from
                  <input name="startsOn" type="date" required />
                </label>
              </div>
              <label>
                Discount reason
                <input
                  name="discountReason"
                  placeholder="Sibling concession, scholarship, staff child…"
                />
              </label>
              <button disabled={!data.canAssign}>Assign fee structure</button>
              {!unassigned.length && (
                <small>
                  All currently enrolled students already have an assignment;
                  saving updates an existing assignment.
                </small>
              )}
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
