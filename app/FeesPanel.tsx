"use client";
import { FormEvent, useEffect, useState } from "react";
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
  canManage: boolean;
  canAssign: boolean;
  canInvoice: boolean;
  canCollect: boolean;
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
  canManage: false,
  canAssign: false,
  canInvoice: false,
  canCollect: false,
  canViewFinancial: false,
};
const money = (v: unknown) => `PKR ${Number(v || 0).toLocaleString()}`;
export default function FeesPanel() {
  const [data, setData] = useState<Data>(empty),
    [tab, setTab] = useState("invoices"),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  const load = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/fees", { cache: "no-store" }),
        j = (await r.json()) as Data & { error?: string };
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
    const r = await fetch("/api/fees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, campusId: data.campusId, ...values }),
      }),
      j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setMessage(j.error || "Unable to save.");
      return;
    }
    e.currentTarget.reset();
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
    <div className="foundation-page fees-page">
      <div className="phase-heading">
        <div>
          <span className="eyebrow">
            PHASE 7B · INVOICES, PAYMENTS & RECEIPTS
          </span>
          <h1>Invoices, payments and printable receipts</h1>
          <p>
            Generate monthly invoices, collect payments, track balances and
            print school-branded receipts.
          </p>
        </div>
        <span className="phase-badge complete">
          {currentYear?.name || "Academic year"}
        </span>
      </div>
      <section className="fee-summary">
        <article>
          <span>🧩</span>
          <b>{data.invoices.length}</b>
          <small>Total invoices</small>
        </article>
        <article>
          <span>📋</span>
          <b>{data.invoices.filter((v) => v.status === "paid").length}</b>
          <small>Paid invoices</small>
        </article>
        <article>
          <span>🎓</span>
          <b>
            {
              data.invoices.filter(
                (v) => v.status === "unpaid" || v.status === "partial",
              ).length
            }
          </b>
          <small>Outstanding invoices</small>
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
                      {v.name} · {v.admission_number} · {v.class_name}
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
