"use client";
import { FormEvent, useMemo, useState } from "react";
import { cn, moduleSurface } from "./ui/TailwindPrimitives";
type R = Record<string, unknown>;
export type PayrollData = {
  components: R[];
  assignments: R[];
  periods: R[];
  items: R[];
  staff: R[];
  campuses: R[];
  selectedPeriodId: string;
  canConfigure: boolean;
  canGenerate: boolean;
  canApprove: boolean;
};
const s = (v: unknown) => String(v ?? ""),
  money = (v: unknown) =>
    new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      maximumFractionDigits: 0,
    }).format(Number(v) || 0);
export default function PayrollPanel({ data: initial }: { data: PayrollData }) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState("overview"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(
      initial.selectedPeriodId || s(initial.periods[0]?.id),
    );
  async function load(id = selected) {
    const r = await fetch("/api/payroll?periodId=" + id, { cache: "no-store" }),
      b = await r.json();
    if (r.ok) setData(b);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget),
      payload = Object.fromEntries(f.entries()) as Record<string, unknown>,
      action = s(f.get("action"));
    if (action === "assign_salary")
      payload.components = data.components
        .map((v) => ({
          componentId: v.id,
          value: Number(f.get("component_" + s(v.id))) || 0,
        }))
        .filter((v) => v.value > 0);
    payload.isTaxable = f.get("isTaxable") === "on";
    const r = await fetch("/api/payroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      b = await r.json();
    setBusy(false);
    setMessage(
      b.error ??
        (action === "generate"
          ? "Payroll generated for " + b.count + " staff."
          : "Saved successfully."),
    );
    if (r.ok) {
      if (action === "create_period") setSelected(b.id);
      await load(action === "create_period" ? b.id : selected);
    }
  }
  async function decide(id: unknown, decision: string) {
    setBusy(true);
    const r = await fetch("/api/payroll", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      }),
      b = await r.json();
    setBusy(false);
    setMessage(b.error ?? "Payroll " + decision + ".");
    if (r.ok) await load();
  }
  const totals = useMemo(
      () =>
        data.items.reduce(
          (a, v) => ({
            gross: a.gross + Number(v.base_salary) + Number(v.earnings),
            deductions:
              a.deductions + Number(v.deductions) + Number(v.absence_deduction),
            net: a.net + Number(v.net_salary),
          }),
          { gross: 0, deductions: 0, net: 0 },
        ),
      [data.items],
    ),
    period = data.periods.find((v) => s(v.id) === selected);
  return (
    <div className={cn("payroll-page",moduleSurface)}>
      <div className="phase-heading">
        <div>
          <span className="eyebrow">PHASE 3D · FINANCIAL OPERATIONS</span>
          <h1>Salary configuration & payroll</h1>
          <p>
            Configure compensation, calculate monthly payroll and approve
            protected salary records.
          </p>
        </div>
        <span className="phase-badge complete">PKR payroll</span>
      </div>
      <section className="payroll-stats">
        {[
          ["👥", data.assignments.length, "SALARY PROFILES"],
          ["💼", data.periods.length, "PAYROLL PERIODS"],
          ["➕", money(totals.gross), "CURRENT GROSS"],
          ["➖", money(totals.deductions), "DEDUCTIONS"],
          ["💰", money(totals.net), "NET PAYROLL"],
        ].map((v) => (
          <article key={s(v[2])}>
            <span>{v[0]}</span>
            <b>{v[1]}</b>
            <small>{v[2]}</small>
          </article>
        ))}
      </section>
      <section className="payroll-workspace">
        <header>
          <nav>
            {[
              ["overview", "📊 Payroll runs"],
              ["salaries", "💳 Salary profiles"],
              ["components", "🧩 Components"],
              ["payslips", "🧾 Payslips"],
            ].map((v) => (
              <button
                key={v[0]}
                className={tab === v[0] ? "active" : ""}
                onClick={() => setTab(v[0])}
              >
                {v[1]}
              </button>
            ))}
          </nav>
          {data.periods.length > 0 && (
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                void load(e.target.value);
              }}
            >
              {data.periods.map((v) => (
                <option key={s(v.id)} value={s(v.id)}>
                  {s(v.name)} · {s(v.status)}
                </option>
              ))}
            </select>
          )}
        </header>
        {message && <p className="payroll-message">{message}</p>}
        {tab === "overview" && (
          <div className="payroll-overview">
            {data.canGenerate && (
              <form onSubmit={submit}>
                <h3>Create payroll period</h3>
                <input type="hidden" name="action" value="create_period" />
                <label>
                  Payroll month
                  <input name="periodMonth" type="month" required />
                </label>
                <div>
                  <label>
                    Starts
                    <input name="startsOn" type="date" required />
                  </label>
                  <label>
                    Ends
                    <input name="endsOn" type="date" required />
                  </label>
                </div>
                <label>
                  Pay date
                  <input name="payDate" type="date" />
                </label>
                <button disabled={busy}>Create period</button>
              </form>
            )}
            <main>
              <div className="payroll-run-head">
                <div>
                  <small>SELECTED PAYROLL</small>
                  <h3>{s(period?.name) || "No payroll period yet"}</h3>
                  <p>
                    {period
                      ? s(period.starts_on) + " → " + s(period.ends_on)
                      : "Create a monthly period to begin."}
                  </p>
                </div>
                {period && (
                  <div>
                    {data.canGenerate && period.status === "draft" && (
                      <form onSubmit={submit}>
                        <input type="hidden" name="action" value="generate" />
                        <input type="hidden" name="periodId" value={selected} />
                        <button disabled={busy}>
                          ⚡ Generate / recalculate
                        </button>
                      </form>
                    )}
                    {data.canApprove && (
                      <button
                        className="approve"
                        disabled={busy}
                        onClick={() =>
                          decide(
                            period.id,
                            period.status === "approved"
                              ? "reopened"
                              : "approved",
                          )
                        }
                      >
                        {period.status === "approved"
                          ? "Reopen payroll"
                          : "Approve payroll"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="payroll-run-list">
                {data.periods.map((v) => (
                  <article
                    key={s(v.id)}
                    className={s(v.id) === selected ? "selected" : ""}
                    onClick={() => {
                      setSelected(s(v.id));
                      void load(s(v.id));
                    }}
                  >
                    <span>📅</span>
                    <div>
                      <b>{s(v.name)}</b>
                      <small>
                        {s(v.staff_count)} staff · Pay{" "}
                        {s(v.pay_date) || "not set"}
                      </small>
                    </div>
                    <strong>
                      {money(v.net_total)}
                      <small className={"payroll-status " + s(v.status)}>
                        {s(v.status)}
                      </small>
                    </strong>
                  </article>
                ))}
              </div>
            </main>
          </div>
        )}
        {tab === "salaries" && (
          <div className="salary-layout">
            {data.canConfigure && (
              <form onSubmit={submit}>
                <h3>Assign salary</h3>
                <input type="hidden" name="action" value="assign_salary" />
                <label>
                  Staff member
                  <select name="staffId" required>
                    <option value="">Select staff</option>
                    {data.staff.map((v) => (
                      <option key={s(v.id)} value={s(v.id)}>
                        {s(v.first_name)} {s(v.last_name)} ·{" "}
                        {s(v.employee_number)}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <label>
                    Base salary
                    <input name="baseSalary" type="number" min="1" required />
                  </label>
                  <label>
                    Effective from
                    <input name="effectiveFrom" type="date" required />
                  </label>
                </div>
                <label>
                  Payment method
                  <select name="paymentMethod">
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </label>
                {data.components.map((v) => (
                  <label key={s(v.id)}>
                    {s(v.name)} · {s(v.component_type)}
                    <input
                      name={"component_" + s(v.id)}
                      type="number"
                      min="0"
                      step=".01"
                      placeholder={s(v.default_value)}
                    />
                  </label>
                ))}
                <label>
                  Notes
                  <textarea name="notes" />
                </label>
                <button disabled={busy}>Save salary profile</button>
              </form>
            )}
            <div className="salary-cards">
              {data.assignments.map((v) => (
                <article key={s(v.id)}>
                  <header>
                    <span>
                      {s(v.first_name)[0]}
                      {s(v.last_name)[0]}
                    </span>
                    <div>
                      <b>
                        {s(v.first_name)} {s(v.last_name)}
                      </b>
                      <small>
                        {s(v.employee_number)} · {s(v.designation)}
                      </small>
                    </div>
                    <i>{s(v.campus_name)}</i>
                  </header>
                  <dl>
                    <div>
                      <dt>Base salary</dt>
                      <dd>{money(v.base_salary)}</dd>
                    </div>
                    <div>
                      <dt>Allowances</dt>
                      <dd className="good">+ {money(v.earnings)}</dd>
                    </div>
                    <div>
                      <dt>Deductions</dt>
                      <dd className="bad">− {money(v.deductions)}</dd>
                    </div>
                    <div>
                      <dt>Method</dt>
                      <dd>{s(v.payment_method).replace("_", " ")}</dd>
                    </div>
                  </dl>
                  <footer>Effective {s(v.effective_from)}</footer>
                </article>
              ))}
            </div>
          </div>
        )}
        {tab === "components" && (
          <div className="component-layout">
            {data.canConfigure && (
              <form onSubmit={submit}>
                <h3>Create salary component</h3>
                <input type="hidden" name="action" value="create_component" />
                <div>
                  <label>
                    Name
                    <input name="name" required />
                  </label>
                  <label>
                    Code
                    <input name="code" required />
                  </label>
                </div>
                <div>
                  <label>
                    Type
                    <select name="componentType">
                      <option value="earning">Earning / allowance</option>
                      <option value="deduction">Deduction</option>
                    </select>
                  </label>
                  <label>
                    Calculation
                    <select name="calculationType">
                      <option value="fixed">Fixed amount</option>
                      <option value="percentage">Percentage of base</option>
                    </select>
                  </label>
                </div>
                <label>
                  Default value
                  <input
                    name="defaultValue"
                    type="number"
                    min="0"
                    step=".01"
                    required
                  />
                </label>
                <label className="payroll-check">
                  <input name="isTaxable" type="checkbox" /> Taxable component
                </label>
                <button disabled={busy}>Create component</button>
              </form>
            )}
            <div className="component-grid">
              {data.components.map((v) => (
                <article key={s(v.id)} className={s(v.component_type)}>
                  <span>{v.component_type === "earning" ? "➕" : "➖"}</span>
                  <div>
                    <b>{s(v.name)}</b>
                    <small>
                      {s(v.code)} · {s(v.calculation_type)}
                    </small>
                  </div>
                  <strong>
                    {v.calculation_type === "percentage"
                      ? s(v.default_value) + "%"
                      : money(v.default_value)}
                  </strong>
                </article>
              ))}
            </div>
          </div>
        )}
        {tab === "payslips" && (
          <div className="payslip-table">
            <div className="payslip-row head">
              <span>Staff member</span>
              <span>Base</span>
              <span>Earnings</span>
              <span>Deductions</span>
              <span>Absence</span>
              <span>Net salary</span>
              <span>Status</span>
            </div>
            {data.items.map((v) => (
              <div className="payslip-row" key={s(v.id)}>
                <span>
                  <b>
                    {s(v.first_name)} {s(v.last_name)}
                  </b>
                  <small>
                    {s(v.employee_number)} · {s(v.campus_name)}
                  </small>
                </span>
                <b>{money(v.base_salary)}</b>
                <b className="good">+{money(v.earnings)}</b>
                <b className="bad">−{money(v.deductions)}</b>
                <b className="bad">−{money(v.absence_deduction)}</b>
                <strong>{money(v.net_salary)}</strong>
                <i className={"payroll-status " + s(v.status)}>{s(v.status)}</i>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
