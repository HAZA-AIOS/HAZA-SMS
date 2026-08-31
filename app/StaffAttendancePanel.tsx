"use client";
import { FormEvent, useMemo, useState } from "react";
type Row = {
  staff_id: string;
  employee_number: string;
  first_name: string;
  last_name: string | null;
  designation: string;
  department: string | null;
  campus_id: string;
  campus_name: string;
  attendance_id: string | null;
  status: string | null;
  check_in: string | null;
  check_out: string | null;
  late_minutes: number | null;
  worked_minutes: number | null;
  notes: string | null;
};
export type StaffAttendanceData = {
  date: string;
  month: string;
  campusId: string;
  roster: Row[];
  summary: {
    total: number;
    present: number | null;
    absent: number | null;
    late: number | null;
    on_leave: number | null;
  };
  monthly: Array<Record<string, unknown>>;
  corrections: Array<Record<string, unknown>>;
  campuses: { id: string; name: string }[];
  canManage: boolean;
  canCorrect: boolean;
};
type LeaveData = {
  types: Array<Record<string, unknown>>;
  requests: Array<Record<string, unknown>>;
  balances: Array<Record<string, unknown>>;
  staff: Array<Record<string, unknown>>;
  academicYears: Array<Record<string, unknown>>;
  canApprove: boolean;
  canManageTypes: boolean;
};
const s = (v: unknown) => String(v ?? "");
const today = () => new Date().toISOString().slice(0, 10);
export default function StaffAttendancePanel({
  data: initial,
}: {
  data: StaffAttendanceData;
}) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState<"daily" | "leave" | "monthly" | "corrections">(
      "daily",
    ),
    [date, setDate] = useState(initial.date),
    [month, setMonth] = useState(initial.month),
    [campus, setCampus] = useState(initial.campusId),
    [rows, setRows] = useState(() =>
      initial.roster.map((v) => ({
        ...v,
        status: v.status || "present",
        check_in: v.check_in || "09:00",
        check_out: v.check_out || "13:00",
        notes: v.notes || "",
      })),
    ),
    [leave, setLeave] = useState<LeaveData | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load(d = date, c = campus, m = month) {
    const q = new URLSearchParams({ date: d, campusId: c, month: m }),
      r = await fetch(`/api/staff-attendance?${q}`, { cache: "no-store" }),
      b = await r.json();
    if (r.ok) {
      setData(b);
      setRows(
        b.roster.map((v: Row) => ({
          ...v,
          status: v.status || "present",
          check_in: v.check_in || "09:00",
          check_out: v.check_out || "13:00",
          notes: v.notes || "",
        })),
      );
    }
  }
  async function loadLeave() {
    const r = await fetch("/api/staff-leave", { cache: "no-store" }),
      b = await r.json();
    if (r.ok) setLeave(b);
  }
  async function save() {
    setBusy(true);
    const r = await fetch("/api/staff-attendance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          entries: rows.map((v) => ({
            staffId: v.staff_id,
            status: v.status,
            checkIn: v.check_in,
            checkOut: v.check_out,
            notes: v.notes,
          })),
        }),
      }),
      b = await r.json();
    setBusy(false);
    setMessage(b.error ?? `${b.count} attendance records saved.`);
    if (r.ok) await load();
  }
  async function submit(e: FormEvent<HTMLFormElement>, endpoint: string) {
    e.preventDefault();
    setBusy(true);
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries()),
      r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      b = await r.json();
    setBusy(false);
    setMessage(b.error ?? "Saved successfully.");
    if (r.ok) {
      e.currentTarget.reset();
      await loadLeave();
      await load();
    }
  }
  async function decide(endpoint: string, id: unknown, decision: string) {
    setBusy(true);
    const r = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      }),
      b = await r.json();
    setBusy(false);
    setMessage(b.error ?? `Request ${decision}.`);
    if (r.ok) {
      await loadLeave();
      await load();
    }
  }
  const marked = useMemo(
    () => rows.filter((v) => v.attendance_id).length,
    [rows],
  );
  return (
    <div className="attendance-page">
      <div className="phase-heading">
        <div>
          <span className="eyebrow">PHASE 3C · WORKFORCE OPERATIONS</span>
          <h1>Staff attendance & leave</h1>
          <p>
            Track daily presence, working time, corrections, leave balances and
            approvals across every campus.
          </p>
        </div>
        <span className="phase-badge complete">Live register</span>
      </div>
      <section className="attendance-stats">
        <article>
          <span>👥</span>
          <b>{data.summary.total}</b>
          <small>ACTIVE STAFF</small>
        </article>
        <article>
          <span>✅</span>
          <b>{data.summary.present ?? 0}</b>
          <small>PRESENT TODAY</small>
        </article>
        <article>
          <span>⏰</span>
          <b>{data.summary.late ?? 0}</b>
          <small>LATE ARRIVALS</small>
        </article>
        <article>
          <span>🌿</span>
          <b>{data.summary.on_leave ?? 0}</b>
          <small>ON LEAVE</small>
        </article>
        <article>
          <span>📝</span>
          <b>{data.corrections.filter((v) => v.status === "pending").length}</b>
          <small>CORRECTIONS DUE</small>
        </article>
      </section>
      <section className="attendance-workspace">
        <header>
          <nav>
            {[
              ["daily", "📋 Daily register"],
              ["leave", "🌿 Leave management"],
              ["monthly", "📊 Monthly summary"],
              ["corrections", "✏️ Corrections"],
            ].map(([k, l]) => (
              <button
                key={k}
                className={tab === k ? "active" : ""}
                onClick={() => {
                  setTab(k as typeof tab);
                  if (k === "leave") void loadLeave();
                }}
              >
                {l}
              </button>
            ))}
          </nav>
          <div className="attendance-filters">
            <select
              value={campus}
              onChange={(e) => {
                setCampus(e.target.value);
                void load(date, e.target.value, month);
              }}
            >
              <option value="">All campuses</option>
              {data.campuses.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            {tab === "monthly" ? (
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  void load(date, campus, e.target.value);
                }}
              />
            ) : (
              <input
                type="date"
                value={date}
                max={today()}
                onChange={(e) => {
                  setDate(e.target.value);
                  void load(e.target.value, campus, month);
                }}
              />
            )}
          </div>
        </header>
        {message && <p className="attendance-message">{message}</p>}
        {tab === "daily" && (
          <>
            <div className="register-toolbar">
              <div>
                <b>
                  {marked} of {rows.length} marked
                </b>
                <small>Default working hours 9:00 AM–1:00 PM</small>
              </div>
              <div>
                <button
                  onClick={() =>
                    setRows((v) => v.map((x) => ({ ...x, status: "present" })))
                  }
                >
                  Mark all present
                </button>
                {data.canManage && (
                  <button className="primary" disabled={busy} onClick={save}>
                    {busy ? "Saving…" : "Save attendance"}
                  </button>
                )}
              </div>
            </div>
            <div className="attendance-table">
              <div className="attendance-row head">
                <span>Staff member</span>
                <span>Status</span>
                <span>Check in</span>
                <span>Check out</span>
                <span>Notes</span>
              </div>
              {rows.map((v, i) => (
                <div className="attendance-row" key={v.staff_id}>
                  <span className="attendance-person">
                    <i>
                      {v.first_name[0]}
                      {v.last_name?.[0] || ""}
                    </i>
                    <b>
                      {v.first_name} {v.last_name}
                      <small>
                        {v.employee_number} · {v.designation}
                        <br />
                        {v.campus_name}
                      </small>
                    </b>
                  </span>
                  <select
                    disabled={!data.canManage}
                    value={v.status}
                    onChange={(e) =>
                      setRows((x) =>
                        x.map((r, n) =>
                          n === i ? { ...r, status: e.target.value } : r,
                        ),
                      )
                    }
                  >
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="leave">Leave</option>
                    <option value="half_day">Half day</option>
                    <option value="official_duty">Official duty</option>
                  </select>
                  <input
                    disabled={!data.canManage}
                    type="time"
                    value={v.check_in}
                    onChange={(e) =>
                      setRows((x) =>
                        x.map((r, n) =>
                          n === i ? { ...r, check_in: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <input
                    disabled={!data.canManage}
                    type="time"
                    value={v.check_out}
                    onChange={(e) =>
                      setRows((x) =>
                        x.map((r, n) =>
                          n === i ? { ...r, check_out: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <input
                    disabled={!data.canManage}
                    value={v.notes}
                    placeholder="Optional note"
                    onChange={(e) =>
                      setRows((x) =>
                        x.map((r, n) =>
                          n === i ? { ...r, notes: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "monthly" && (
          <div className="monthly-table">
            <div className="monthly-row head">
              <span>Staff member</span>
              <span>Marked</span>
              <span>Present</span>
              <span>Late</span>
              <span>Absent</span>
              <span>Leave</span>
            </div>
            {data.monthly.map((v, i) => (
              <div className="monthly-row" key={s(v.staff_id) || i}>
                <span>
                  <b>
                    {s(v.first_name)} {s(v.last_name)}
                  </b>
                  <small>
                    {s(v.employee_number)} · {s(v.designation)}
                  </small>
                </span>
                <b>{s(v.marked) || "0"}</b>
                <b className="good">{s(v.present) || "0"}</b>
                <b className="warn">{s(v.late) || "0"}</b>
                <b className="bad">{s(v.absent) || "0"}</b>
                <b>{s(v.on_leave) || "0"}</b>
              </div>
            ))}
          </div>
        )}
        {tab === "corrections" && (
          <div className="correction-grid">
            <form onSubmit={(e) => submit(e, "/api/staff-attendance")}>
              <h3>Request a correction</h3>
              <input type="hidden" name="action" value="request_correction" />
              <label>
                Attendance record
                <select name="attendanceId" required>
                  <option value="">Select marked record</option>
                  {rows
                    .filter((v) => v.attendance_id)
                    .map((v) => (
                      <option value={v.attendance_id!} key={v.attendance_id!}>
                        {v.first_name} {v.last_name} · {date}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Correct status
                <select name="status">
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="leave">Leave</option>
                  <option value="half_day">Half day</option>
                </select>
              </label>
              <div>
                <label>
                  Check in
                  <input name="checkIn" type="time" />
                </label>
                <label>
                  Check out
                  <input name="checkOut" type="time" />
                </label>
              </div>
              <label>
                Reason
                <textarea name="reason" required />
              </label>
              <button disabled={busy}>Submit correction</button>
            </form>
            <section>
              <h3>Correction queue</h3>
              {data.corrections.map((v, i) => (
                <article key={s(v.id) || i}>
                  <div>
                    <b>
                      {s(v.first_name)} {s(v.last_name)}
                    </b>
                    <small>
                      {s(v.employee_number)} · {s(v.attendance_date)}
                    </small>
                    <p>{s(v.reason)}</p>
                  </div>
                  <span className={`request-status ${s(v.status)}`}>
                    {s(v.status)}
                  </span>
                  {v.status === "pending" && data.canManage && (
                    <footer>
                      <button
                        onClick={() =>
                          decide("/api/staff-attendance", v.id, "rejected")
                        }
                      >
                        Reject
                      </button>
                      <button
                        onClick={() =>
                          decide("/api/staff-attendance", v.id, "approved")
                        }
                      >
                        Approve
                      </button>
                    </footer>
                  )}
                </article>
              ))}
            </section>
          </div>
        )}
        {tab === "leave" && leave && (
          <div className="leave-layout">
            <aside>
              <form onSubmit={(e) => submit(e, "/api/staff-leave")}>
                <h3>New leave request</h3>
                <input type="hidden" name="action" value="request" />
                <label>
                  Staff member
                  <select name="staffId" required>
                    <option value="">Select staff</option>
                    {leave.staff.map((v) => (
                      <option key={s(v.id)} value={s(v.id)}>
                        {s(v.first_name)} {s(v.last_name)} ·{" "}
                        {s(v.employee_number)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Leave type
                  <select name="leaveTypeId" required>
                    <option value="">Select leave type</option>
                    {leave.types.map((v) => (
                      <option key={s(v.id)} value={s(v.id)}>
                        {s(v.name)} · {s(v.annual_allowance)} days
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Academic year
                  <select name="academicYearId" required>
                    {leave.academicYears.map((v) => (
                      <option key={s(v.id)} value={s(v.id)}>
                        {s(v.name)}
                        {v.is_current ? " · Current" : ""}
                      </option>
                    ))}
                  </select>
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
                  Reason
                  <textarea name="reason" required />
                </label>
                <button disabled={busy}>Submit request</button>
              </form>
              {leave.canManageTypes && (
                <form onSubmit={(e) => submit(e, "/api/staff-leave")}>
                  <h3>Create leave policy</h3>
                  <input type="hidden" name="action" value="create_type" />
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
                  <label>
                    Annual allowance
                    <input
                      name="annualAllowance"
                      type="number"
                      min="0"
                      step=".5"
                      required
                    />
                  </label>
                  <label className="check">
                    <input name="carryForward" type="checkbox" /> Allow
                    carry-forward
                  </label>
                  <button disabled={busy}>Create leave type</button>
                </form>
              )}
            </aside>
            <main>
              <h3>Leave requests</h3>
              <div className="leave-requests">
                {leave.requests.map((v, i) => (
                  <article key={s(v.id) || i}>
                    <header>
                      <div>
                        <b>
                          {s(v.first_name)} {s(v.last_name)}
                        </b>
                        <small>
                          {s(v.employee_number)} · {s(v.campus_name)}
                        </small>
                      </div>
                      <span className={`request-status ${s(v.status)}`}>
                        {s(v.status)}
                      </span>
                    </header>
                    <dl>
                      <div>
                        <dt>Leave</dt>
                        <dd>{s(v.leave_type_name)}</dd>
                      </div>
                      <div>
                        <dt>Dates</dt>
                        <dd>
                          {s(v.starts_on)} → {s(v.ends_on)}
                        </dd>
                      </div>
                      <div>
                        <dt>Duration</dt>
                        <dd>{s(v.total_days)} days</dd>
                      </div>
                    </dl>
                    <p>{s(v.reason)}</p>
                    {v.status === "pending" && leave.canApprove && (
                      <footer>
                        <button
                          onClick={() =>
                            decide("/api/staff-leave", v.id, "rejected")
                          }
                        >
                          Reject
                        </button>
                        <button
                          onClick={() =>
                            decide("/api/staff-leave", v.id, "approved")
                          }
                        >
                          Approve
                        </button>
                      </footer>
                    )}
                  </article>
                ))}
              </div>
              <h3>Leave balances</h3>
              <div className="balance-grid">
                {leave.balances.map((v, i) => (
                  <article key={s(v.id) || i}>
                    <span>🌱</span>
                    <div>
                      <b>
                        {s(v.first_name)} {s(v.last_name)}
                      </b>
                      <small>{s(v.leave_type_name)}</small>
                    </div>
                    <strong>
                      {s(v.remaining_days)}
                      <small>days left</small>
                    </strong>
                  </article>
                ))}
              </div>
            </main>
          </div>
        )}
      </section>
    </div>
  );
}
