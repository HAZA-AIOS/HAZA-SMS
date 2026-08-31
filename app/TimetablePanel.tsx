"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown> & { id: string; name: string };
type Data = {
  campusId: string;
  schedules: Row[];
  periods: Row[];
  entries: Row[];
  academicYears: Row[];
  classes: Row[];
  sections: Row[];
  subjects: Row[];
  teachers: Row[];
  canManage: boolean;
};
const days = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
] as const;
const empty: Data = {
  campusId: "",
  schedules: [],
  periods: [],
  entries: [],
  academicYears: [],
  classes: [],
  sections: [],
  subjects: [],
  teachers: [],
  canManage: false,
};
const fmt = (v: unknown) => {
  const [h, m] = String(v).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export default function TimetablePanel() {
  const [data, setData] = useState<Data>(empty),
    [tab, setTab] = useState("schedules"),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const load = async () => {
    setBusy(true);
    const r = await fetch("/api/timetable", { cache: "no-store" }),
      j = (await r.json()) as Data & { error?: string };
    if (r.ok) {
      setData(j);
      setScheduleId((v) => v || j.schedules[0]?.id || "");
    } else setMessage(j.error || "Unable to load timetable.");
    setBusy(false);
  };
  useEffect(() => {
    void load();
  }, []);
  const submit = async (e: FormEvent<HTMLFormElement>, action: string) => {
    e.preventDefault();
    setMessage("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    if ("isBreak" in values) values.isBreak = true;
    const r = await fetch("/api/timetable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, campusId: data.campusId, ...values }),
      }),
      j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setMessage(j.error || "Unable to save.");
      return;
    }
    await load();
  };
  const selectedSchedule = data.schedules.find((v) => v.id === scheduleId),
    periods = data.periods.filter((v) => v.schedule_id === scheduleId),
    entries = data.entries.filter((v) => v.schedule_id === scheduleId);
  const activeSeason = useMemo(() => {
    const now = new Date(),
      md = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return md >= "10-15" || md <= "04-15" ? "winter" : "summer";
  }, []);
  if (busy)
    return (
      <div className="foundation-page">
        <div className="timetable-loading">Loading timetable foundation…</div>
      </div>
    );
  return (
    <div className="foundation-page timetable-page">
      <div className="phase-heading">
        <div>
          <span className="eyebrow">PHASE 6A · TIMETABLE FOUNDATION</span>
          <h1>School timings and timetable</h1>
          <p>
            Configure seasonal hours, teaching periods and the class timetable
            for the selected campus.
          </p>
        </div>
        <span className="phase-badge complete">
          {activeSeason} schedule active
        </span>
      </div>
      <section className="timetable-season-cards">
        {data.schedules.map((s) => (
          <article
            className={String(s.season) === activeSeason ? "active" : ""}
            key={s.id}
          >
            <span>{s.season === "winter" ? "❄️" : "☀️"}</span>
            <div>
              <small>
                {String(s.season).toUpperCase()} · {String(s.starts_on)} TO{" "}
                {String(s.ends_on)}
              </small>
              <h2>{s.name}</h2>
              <p>
                {fmt(s.school_starts_at)}–{fmt(s.school_ends_at)}
              </p>
              <b>
                Break {fmt(s.break_starts_at)}–{fmt(s.break_ends_at)}
              </b>
            </div>
            {String(s.season) === activeSeason && <i>Current</i>}
          </article>
        ))}
      </section>
      {message && <p className="timetable-message">{message}</p>}
      <section className="timetable-workspace">
        <nav>
          {[
            ["schedules", "Seasonal schedules"],
            ["periods", "Period definitions"],
            ["grid", "Class timetable"],
          ].map(([id, label]) => (
            <button
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              key={id}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === "schedules" && (
          <div className="schedule-grid">
            {data.schedules.map((s) => (
              <form key={s.id} onSubmit={(e) => submit(e, "save_schedule")}>
                <header>
                  <span>{s.season === "winter" ? "❄️" : "☀️"}</span>
                  <div>
                    <h3>{s.name}</h3>
                    <small>Campus schedule</small>
                  </div>
                </header>
                <input type="hidden" name="season" value={String(s.season)} />
                <label>
                  Schedule name
                  <input name="name" defaultValue={String(s.name)} required />
                </label>
                <div>
                  <label>
                    Begins
                    <input
                      type="text"
                      name="startsOn"
                      defaultValue={String(s.starts_on)}
                      pattern="\d{2}-\d{2}"
                      required
                    />
                  </label>
                  <label>
                    Ends
                    <input
                      type="text"
                      name="endsOn"
                      defaultValue={String(s.ends_on)}
                      pattern="\d{2}-\d{2}"
                      required
                    />
                  </label>
                </div>
                <div>
                  <label>
                    School starts
                    <input
                      type="time"
                      name="schoolStartsAt"
                      defaultValue={String(s.school_starts_at)}
                      required
                    />
                  </label>
                  <label>
                    School ends
                    <input
                      type="time"
                      name="schoolEndsAt"
                      defaultValue={String(s.school_ends_at)}
                      required
                    />
                  </label>
                </div>
                <div>
                  <label>
                    Break starts
                    <input
                      type="time"
                      name="breakStartsAt"
                      defaultValue={String(s.break_starts_at)}
                      required
                    />
                  </label>
                  <label>
                    Break ends
                    <input
                      type="time"
                      name="breakEndsAt"
                      defaultValue={String(s.break_ends_at)}
                      required
                    />
                  </label>
                </div>
                <input
                  type="hidden"
                  name="workingDays"
                  value={String(s.working_days)}
                />
                {data.canManage && (
                  <button>Save {String(s.season)} schedule</button>
                )}
              </form>
            ))}
          </div>
        )}
        {tab === "periods" && (
          <div className="period-layout">
            <aside>
              <label>
                Schedule
                <select
                  value={scheduleId}
                  onChange={(e) => setScheduleId(e.target.value)}
                >
                  {data.schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {data.canManage && selectedSchedule && (
                <form onSubmit={(e) => submit(e, "create_period")}>
                  <input type="hidden" name="scheduleId" value={scheduleId} />
                  <h3>Add period</h3>
                  <label>
                    Period number
                    <input
                      name="periodNumber"
                      type="number"
                      min="1"
                      defaultValue={periods.length + 1}
                      required
                    />
                  </label>
                  <label>
                    Name
                    <input name="name" placeholder="Period 1" required />
                  </label>
                  <div>
                    <label>
                      Starts
                      <input name="startsAt" type="time" required />
                    </label>
                    <label>
                      Ends
                      <input name="endsAt" type="time" required />
                    </label>
                  </div>
                  <label className="timetable-check">
                    <input name="isBreak" type="checkbox" /> This is a break
                  </label>
                  <button>Add period</button>
                </form>
              )}
            </aside>
            <div className="period-list">
              {periods.length ? (
                periods.map((p) => (
                  <article className={p.is_break ? "break" : ""} key={p.id}>
                    <b>{String(p.period_number).padStart(2, "0")}</b>
                    <div>
                      <h3>{p.name}</h3>
                      <p>
                        {fmt(p.starts_at)}–{fmt(p.ends_at)}
                      </p>
                    </div>
                    {p.is_break ? <span>Break</span> : <span>Teaching</span>}
                  </article>
                ))
              ) : (
                <div className="timetable-empty">
                  <span>🕘</span>
                  <h3>No periods defined</h3>
                  <p>
                    Add teaching periods and the break for this seasonal
                    schedule.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === "grid" && (
          <div className="timetable-grid-space">
            <div className="timetable-grid-toolbar">
              <label>
                Schedule
                <select
                  value={scheduleId}
                  onChange={(e) => setScheduleId(e.target.value)}
                >
                  {data.schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {data.canManage && (
              <form
                className="timetable-entry-form"
                onSubmit={(e) => submit(e, "create_entry")}
              >
                <input type="hidden" name="scheduleId" value={scheduleId} />
                <label>
                  Academic year
                  <select name="academicYearId" required>
                    {data.academicYears.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Class / batch
                  <select name="classId" required>
                    {data.classes.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Section
                  <select name="sectionId">
                    <option value="">Whole class</option>
                    {data.sections.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Day
                  <select name="weekday">
                    {days.map(([id, name]) => (
                      <option value={id} key={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Period
                  <select name="periodId" required>
                    {periods
                      .filter((v) => !v.is_break)
                      .map((v) => (
                        <option value={v.id} key={v.id}>
                          {v.name} · {fmt(v.starts_at)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Subject
                  <select name="subjectId">
                    <option value="">Activity / unassigned</option>
                    {data.subjects.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Teacher
                  <select name="staffId">
                    <option value="">Assign later</option>
                    {data.teachers.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Room
                  <input name="roomName" placeholder="Room 2" />
                </label>
                <button disabled={!periods.some((v) => !v.is_break)}>
                  Add timetable entry
                </button>
              </form>
            )}
            {entries.length ? (
              <div className="weekly-timetable">
                {days.map(([id, name]) => (
                  <section key={id}>
                    <header>{name}</header>
                    {periods.map((p) => (
                      <div className={p.is_break ? "break" : ""} key={p.id}>
                        <time>{fmt(p.starts_at)}</time>
                        {p.is_break ? (
                          <b>{p.name}</b>
                        ) : entries.filter(
                            (e) => e.weekday === id && e.period_id === p.id,
                          ).length ? (
                          entries
                            .filter(
                              (e) => e.weekday === id && e.period_id === p.id,
                            )
                            .map((e) => (
                              <article
                                key={e.id}
                                style={{
                                  borderLeftColor: String(e.color || "#7456de"),
                                }}
                              >
                                <b>{String(e.subject_name || "Activity")}</b>
                                <small>
                                  {String(e.class_name)}
                                  {e.section_name
                                    ? ` · ${String(e.section_name)}`
                                    : ""}
                                </small>
                                <small>
                                  {String(
                                    e.teacher_name || "Teacher not assigned",
                                  )}
                                  {e.room_name
                                    ? ` · ${String(e.room_name)}`
                                    : ""}
                                </small>
                              </article>
                            ))
                        ) : (
                          <span className="free-slot">Available</span>
                        )}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            ) : (
              <div className="timetable-empty">
                <span>📅</span>
                <h3>No timetable entries yet</h3>
                <p>
                  Define periods, then assign classes, subjects, teachers and
                  rooms.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
