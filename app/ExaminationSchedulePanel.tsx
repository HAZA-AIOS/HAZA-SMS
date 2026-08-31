"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
type Row = Record<string, unknown> & { id: string; name?: string };
type Data = {
  campusId: string;
  entries: Row[];
  events: Row[];
  academicYears: Row[];
  terms: Row[];
  classes: Row[];
  sections: Row[];
  subjects: Row[];
  staff: Row[];
  canManage: boolean;
  canManageEvents: boolean;
};
const empty: Data = {
  campusId: "",
  entries: [],
  events: [],
  academicYears: [],
  terms: [],
  classes: [],
  sections: [],
  subjects: [],
  staff: [],
  canManage: false,
  canManageEvents: false,
};
const nice = (v: unknown) =>
  new Date(`${String(v)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const clock = (v: unknown) => {
  const [h, m] = String(v).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
export default function ExaminationSchedulePanel() {
  const [data, setData] = useState<Data>(empty),
    [tab, setTab] = useState("exams"),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  const load = async () => {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/examination-schedule", { cache: "no-store" }),
        j = (await r.json()) as Data & { error?: string };
      if (!r.ok) throw new Error(j.error || "Unable to load schedules.");
      setData(j);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load schedules.");
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
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/examination-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, campusId: data.campusId, ...body }),
      }),
      j = (await r.json()) as { error?: string };
    if (!r.ok) {
      setMessage(j.error || "Unable to save.");
      return;
    }
    e.currentTarget.reset();
    await load();
  };
  const cancel = async (action: string, id: string) => {
    const r = await fetch("/api/examination-schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, id, campusId: data.campusId }),
    });
    if (r.ok) await load();
    else {
      const j = (await r.json()) as { error?: string };
      setMessage(j.error || "Unable to cancel.");
    }
  };
  const upcoming = useMemo(
    () =>
      [...data.entries].filter(
        (v) => String(v.exam_date) >= new Date().toISOString().slice(0, 10),
      ),
    [data.entries],
  );
  if (busy)
    return (
      <div className="foundation-page">
        <div className="timetable-loading">Loading examination calendar…</div>
      </div>
    );
  const year =
    data.academicYears.find((v) => v.is_current) || data.academicYears[0];
  return (
    <div className="foundation-page exam-schedule-page">
      <div className="phase-heading">
        <div>
          <span className="eyebrow">
            PHASE 6C · EXAMINATION TIMETABLE & EVENTS
          </span>
          <h1>Examination schedule and events calendar</h1>
          <p>
            Plan assessments, invigilation, rooms and school events for the
            selected campus.
          </p>
        </div>
        <span className="phase-badge complete">
          {upcoming.length} upcoming exams
        </span>
      </div>
      <section className="exam-summary">
        <article>
          <span>📝</span>
          <b>{data.entries.length}</b>
          <small>Scheduled examinations</small>
        </article>
        <article>
          <span>📅</span>
          <b>{data.events.length}</b>
          <small>Calendar events</small>
        </article>
        <article>
          <span>🏫</span>
          <b>
            {new Set(data.entries.map((v) => v.room_name).filter(Boolean)).size}
          </b>
          <small>Examination rooms</small>
        </article>
        <article>
          <span>👩‍🏫</span>
          <b>
            {
              new Set(
                data.entries.map((v) => v.invigilator_staff_id).filter(Boolean),
              ).size
            }
          </b>
          <small>Invigilators assigned</small>
        </article>
      </section>
      {message && <p className="timetable-message">{message}</p>}
      <section className="exam-workspace">
        <nav>
          {[
            ["exams", "Examination timetable"],
            ["calendar", "Events calendar"],
            ["add-exam", "Schedule examination"],
            ["add-event", "Add event"],
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
        {tab === "exams" &&
          (data.entries.length ? (
            <div className="exam-list">
              {data.entries.map((v) => (
                <article key={v.id}>
                  <time>
                    <b>{String(v.exam_date).slice(8, 10)}</b>
                    <small>
                      {new Date(
                        `${String(v.exam_date)}T00:00:00`,
                      ).toLocaleDateString("en", { month: "short" })}
                    </small>
                  </time>
                  <div>
                    <small>
                      {String(v.exam_type).toUpperCase()} ·{" "}
                      {v.class_name as string}
                      {v.section_name ? ` / ${v.section_name}` : ""}
                    </small>
                    <h3>
                      {v.exam_name as string} — {v.subject_name as string}
                    </h3>
                    <p>
                      {clock(v.starts_at)}–{clock(v.ends_at)} ·{" "}
                      {v.room_name || "Room not assigned"} ·{" "}
                      {v.maximum_marks as number} marks
                    </p>
                  </div>
                  <aside>
                    <span>
                      {v.invigilator_name
                        ? `👩‍🏫 ${v.invigilator_name}`
                        : "Invigilator pending"}
                    </span>
                    {data.canManage && (
                      <button onClick={() => cancel("cancel_exam", v.id)}>
                        Cancel
                      </button>
                    )}
                  </aside>
                </article>
              ))}
            </div>
          ) : (
            <div className="academic-empty">
              <span>📝</span>
              <h3>No examinations scheduled</h3>
              <p>
                Create the first examination timetable entry for this campus.
              </p>
              {data.canManage && (
                <button onClick={() => setTab("add-exam")}>
                  ＋ Schedule examination
                </button>
              )}
            </div>
          ))}
        {tab === "calendar" &&
          (data.events.length ? (
            <div className="event-grid">
              {data.events.map((v) => (
                <article key={v.id}>
                  <span>
                    {v.event_type === "holiday"
                      ? "🌴"
                      : v.event_type === "meeting"
                        ? "🤝"
                        : "📌"}
                  </span>
                  <small>
                    {nice(v.starts_on)}
                    {v.ends_on !== v.starts_on ? ` — ${nice(v.ends_on)}` : ""}
                  </small>
                  <h3>{v.title as string}</h3>
                  <p>
                    {v.location || "School campus"} · {v.audience as string}
                  </p>
                  {v.description && <p>{v.description as string}</p>}
                  {data.canManageEvents && (
                    <button onClick={() => cancel("cancel_event", v.id)}>
                      Cancel event
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="academic-empty">
              <span>📅</span>
              <h3>No events in the calendar</h3>
              <p>Add holidays, meetings, examinations and school activities.</p>
              {data.canManageEvents && (
                <button onClick={() => setTab("add-event")}>
                  ＋ Add event
                </button>
              )}
            </div>
          ))}
        {tab === "add-exam" && (
          <form className="exam-form" onSubmit={(e) => send(e, "create_exam")}>
            <header>
              <span>📝</span>
              <div>
                <h2>Schedule an examination</h2>
                <p>Room and invigilator conflicts are checked before saving.</p>
              </div>
            </header>
            <input type="hidden" name="academicYearId" value={year?.id || ""} />
            <label>
              Examination name
              <input
                name="examName"
                placeholder="Mid-term Examination"
                required
              />
            </label>
            <div>
              <label>
                Type
                <select name="examType">
                  <option value="monthly">Monthly assessment</option>
                  <option value="term">Term examination</option>
                  <option value="final">Final examination</option>
                  <option value="practical">Practical</option>
                  <option value="oral">Oral assessment</option>
                </select>
              </label>
              <label>
                Term
                <select name="termId">
                  <option value="">No term</option>
                  {data.terms
                    .filter((v) => !year || v.academic_year_id === year.id)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div>
              <label>
                Class
                <select name="classId" required>
                  <option value="">Select class</option>
                  {data.classes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select name="sectionId">
                  <option value="">All sections</option>
                  {data.sections.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Subject
                <select name="subjectId" required>
                  <option value="">Select subject</option>
                  {data.subjects.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <label>
                Date
                <input type="date" name="examDate" required />
              </label>
              <label>
                Starts
                <input type="time" name="startsAt" required />
              </label>
              <label>
                Ends
                <input type="time" name="endsAt" required />
              </label>
            </div>
            <div>
              <label>
                Room
                <input name="roomName" placeholder="Hall A" />
              </label>
              <label>
                Invigilator
                <select name="invigilatorId">
                  <option value="">Assign later</option>
                  {data.staff.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Maximum marks
                <input
                  type="number"
                  name="maximumMarks"
                  min="1"
                  max="1000"
                  defaultValue="100"
                />
              </label>
            </div>
            <label>
              Instructions / notes
              <textarea name="notes" rows={3} />
            </label>
            <button disabled={!data.canManage}>Save examination</button>
          </form>
        )}
        {tab === "add-event" && (
          <form className="exam-form" onSubmit={(e) => send(e, "create_event")}>
            <header>
              <span>📅</span>
              <div>
                <h2>Add a school event</h2>
                <p>Publish a campus event for the selected audience.</p>
              </div>
            </header>
            <input type="hidden" name="academicYearId" value={year?.id || ""} />
            <label>
              Event title
              <input
                name="title"
                placeholder="Parent-teacher meeting"
                required
              />
            </label>
            <div>
              <label>
                Event type
                <select name="eventType">
                  <option value="school">School activity</option>
                  <option value="holiday">Holiday</option>
                  <option value="meeting">Meeting</option>
                  <option value="examination">Examination</option>
                  <option value="sports">Sports</option>
                </select>
              </label>
              <label>
                Audience
                <select name="audience">
                  <option value="all">Everyone</option>
                  <option value="students">Students</option>
                  <option value="parents">Parents</option>
                  <option value="staff">Staff</option>
                </select>
              </label>
              <label>
                Location
                <input name="location" placeholder="Main hall" />
              </label>
            </div>
            <div>
              <label>
                Starts on
                <input type="date" name="startsOn" required />
              </label>
              <label>
                Ends on
                <input type="date" name="endsOn" required />
              </label>
              <label>
                Starts at
                <input type="time" name="startsAt" />
              </label>
              <label>
                Ends at
                <input type="time" name="endsAt" />
              </label>
            </div>
            <label>
              Description
              <textarea name="description" rows={3} />
            </label>
            <button disabled={!data.canManageEvents}>Add to calendar</button>
          </form>
        )}
      </section>
    </div>
  );
}
