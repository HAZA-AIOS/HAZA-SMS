"use client";
import { FormEvent, useState } from "react";
export type TeachersData = {
  assignments: Array<Record<string, unknown>>;
  classTeachers: Array<Record<string, unknown>>;
  curriculumCoverage?: Array<Record<string, unknown>>;
  workload: Array<{
    staff_id: string;
    employee_number: string;
    name: string;
    designation: string;
    classes: string[];
    subjects: string[];
    periods: number;
  }>;
  teachers: Array<{
    id: string;
    employee_number: string;
    first_name: string;
    last_name: string | null;
    campus_id: string;
    designation: string;
  }>;
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    campus_id: string | null;
    color: string;
    subject_type: string;
  }>;
  classes: Array<{
    id: string;
    name: string;
    code: string;
    campus_id: string | null;
  }>;
  sections: Array<{
    id: string;
    name: string;
    class_id: string;
    campus_id: string;
  }>;
  academicYears: Array<{ id: string; name: string; is_current: number }>;
  campuses: Array<{ id: string; name: string }>;
};
const str = (v: unknown) => String(v ?? "");
export default function TeachersPanel({
  data: initial,
}: {
  data: TeachersData;
}) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState<"workload" | "coverage" | "subjects" | "class_teachers">(
      "workload",
    ),
    [form, setForm] = useState<
      "subject" | "assignment" | "class_teacher" | null
    >(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [campus, setCampus] = useState(""),
    [year, setYear] = useState(
      initial.academicYears.find((v) => v.is_current)?.id ?? "",
    );
  async function reload(c = campus, y = year) {
    const q = new URLSearchParams({ campusId: c, academicYearId: y }),
      r = await fetch(`/api/teachers?${q}`, { cache: "no-store" }),
      b = await r.json();
    if (r.ok) setData(b);
  }
  async function submit(e: FormEvent<HTMLFormElement>, action: string) {
    e.preventDefault();
    setBusy(true);
    const payload = {
        ...Object.fromEntries(new FormData(e.currentTarget).entries()),
        action,
        isPrimary: new FormData(e.currentTarget).get("isPrimary") === "on",
      },
      r = await fetch("/api/teachers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
      b = await r.json();
    setBusy(false);
    setMessage(b.error ?? "Assignment saved.");
    if (r.ok) {
      e.currentTarget.reset();
      setForm(null);
      await reload();
    }
  }
  async function remove(id: unknown, type: string) {
    if (!confirm("Remove this teacher assignment?")) return;
    setBusy(true);
    const r = await fetch(`/api/teachers?id=${id}&type=${type}`, {
        method: "DELETE",
      }),
      b = await r.json();
    setBusy(false);
    setMessage(b.error ?? "Assignment removed.");
    if (r.ok) await reload();
  }
  const teachers = data.teachers.filter(
      (v) => !campus || v.campus_id === campus,
    ),
    classes = data.classes.filter(
      (v) => !campus || !v.campus_id || v.campus_id === campus,
    ),
    subjects = data.subjects.filter(
      (v) => !campus || !v.campus_id || v.campus_id === campus,
    );
  return (
    <div className="teachers-page">
      <div className="access-heading">
        <div>
          <span className="eyebrow">PHASE 3B · ACADEMIC STAFFING</span>
          <h1>Teacher Assignments</h1>
          <p>
            Connect teachers with subjects, classes and sections while keeping
            workload clear and conflict-free.
          </p>
        </div>
        <div className="teacher-actions">
          <button
            className="student-secondary"
            onClick={() => setForm("subject")}
          >
            ＋ Subject
          </button>
          <button className="student-add" onClick={() => setForm("assignment")}>
            ＋ Assign teacher
          </button>
        </div>
      </div>
      {message && <p className="access-message">{message}</p>}
      <div className="teacher-summary">
        <article>
          <span>🧑‍🏫</span>
          <b>{data.teachers.length}</b>
          <small>Available teachers</small>
        </article>
        <article>
          <span>📚</span>
          <b>{data.subjects.length}</b>
          <small>Active subjects</small>
        </article>
        <article>
          <span>🔗</span>
          <b>{data.assignments.length}</b>
          <small>Subject assignments</small>
        </article>
        <article>
          <span>🏫</span>
          <b>{data.classTeachers.length}</b>
          <small>Class teachers</small>
        </article>
        <article>
          <span>🎯</span>
          <b>{(data.curriculumCoverage ?? []).filter((v) => Number(v.teacher_count) > 0).length}/{(data.curriculumCoverage ?? []).length}</b>
          <small>Curriculum coverage</small>
        </article>
      </div>
      <section className="teacher-workspace">
        <header>
          <nav>
            <button
              className={tab === "workload" ? "active" : ""}
              onClick={() => setTab("workload")}
            >
              📊 Teacher workload
            </button>
            <button
              className={tab === "coverage" ? "active" : ""}
              onClick={() => setTab("coverage")}
            >
              🎯 Allocation coverage
            </button>
            <button
              className={tab === "subjects" ? "active" : ""}
              onClick={() => setTab("subjects")}
            >
              📘 Subject assignments
            </button>
            <button
              className={tab === "class_teachers" ? "active" : ""}
              onClick={() => setTab("class_teachers")}
            >
              ⭐ Class teachers
            </button>
          </nav>
          <div>
            <select
              value={campus}
              onChange={(e) => {
                setCampus(e.target.value);
                void reload(e.target.value, year);
              }}
            >
              <option value="">All campuses</option>
              {data.campuses.map((v) => (
                <option value={v.id} key={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                void reload(campus, e.target.value);
              }}
            >
              <option value="">All years</option>
              {data.academicYears.map((v) => (
                <option value={v.id} key={v.id}>
                  {v.name}
                  {v.is_current ? " · Current" : ""}
                </option>
              ))}
            </select>
          </div>
        </header>
        {tab === "workload" && (
          <div className="workload-grid">
            {data.workload.length ? (
              data.workload.map((v) => (
                <article key={v.staff_id}>
                  <header>
                    <span>
                      {v.name
                        .split(" ")
                        .map((x) => x[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div>
                      <small>{v.employee_number}</small>
                      <h3>{v.name}</h3>
                      <p>{v.designation}</p>
                    </div>
                    <b>
                      {v.periods}
                      <small>periods/week</small>
                    </b>
                  </header>
                  <div>
                    <label>Subjects</label>
                    <p>
                      {v.subjects.map((s) => (
                        <i key={s}>{s}</i>
                      ))}
                    </p>
                  </div>
                  <div>
                    <label>Classes</label>
                    <p>{v.classes.join(" · ")}</p>
                  </div>
                  <footer>
                    <progress max="30" value={Math.min(v.periods, 30)} />
                    <small>
                      {v.periods < 12
                        ? "Light workload"
                        : v.periods <= 24
                          ? "Balanced workload"
                          : "High workload"}
                    </small>
                  </footer>
                </article>
              ))
            ) : (
              <div className="teacher-empty">
                <span>🧑‍🏫</span>
                <h3>No subject assignments yet</h3>
                <p>
                  Assign a teacher to a class and subject to calculate workload.
                </p>
              </div>
            )}
          </div>
        )}
        {tab === "subjects" && (
          <div className="teacher-table">
            <div className="teacher-row teacher-head">
              <span>Teacher</span>
              <span>Subject</span>
              <span>Class / section</span>
              <span>Campus / year</span>
              <span>Periods</span>
              <span />
            </div>
            {data.assignments.map((v, i) => (
              <div className="teacher-row" key={str(v.id) || i}>
                <span>
                  <b>
                    {str(v.first_name)} {str(v.last_name)}
                  </b>
                  <small>{str(v.employee_number)}</small>
                </span>
                <span>
                  <b style={{ color: str(v.color) }}>{str(v.subject_name)}</b>
                  <small>{str(v.subject_code)}</small>
                </span>
                <span>
                  <b>{str(v.class_name)}</b>
                  <small>{str(v.section_name) || "All sections"}</small>
                </span>
                <span>
                  <b>{str(v.campus_name)}</b>
                  <small>{str(v.academic_year_name)}</small>
                </span>
                <span>
                  <b>{str(v.weekly_periods)}</b>
                  <small>per week</small>
                </span>
                <button disabled={busy} onClick={() => remove(v.id, "subject")}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {tab === "class_teachers" && (
          <div className="class-teacher-view">
            <div className="class-teacher-intro">
              <div>
                <span>⭐</span>
                <h3>Class-teacher appointments</h3>
                <p>
                  Only one class teacher can be assigned to each class or
                  section in an academic year.
                </p>
              </div>
              <button onClick={() => setForm("class_teacher")}>
                ＋ Assign class teacher
              </button>
            </div>
            <div className="class-teacher-grid">
              {data.classTeachers.map((v, i) => (
                <article key={str(v.id) || i}>
                  <span>🏫</span>
                  <div>
                    <small>
                      {str(v.campus_name)} · {str(v.academic_year_name)}
                    </small>
                    <h3>
                      {str(v.class_name)}{" "}
                      {v.section_name ? `· ${str(v.section_name)}` : ""}
                    </h3>
                    <p>
                      {str(v.first_name)} {str(v.last_name)} ·{" "}
                      {str(v.employee_number)}
                    </p>
                  </div>
                  <button onClick={() => remove(v.id, "class_teacher")}>
                    ×
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
        {tab === "coverage" && (
          <div className="coverage-grid">
            {(data.curriculumCoverage ?? []).map((v, i) => (
              <article className={Number(v.teacher_count) ? "covered" : "uncovered"} key={str(v.id) || i}>
                <span>{Number(v.teacher_count) ? "✓" : "!"}</span>
                <div><small>{str(v.academic_year_name)} · {str(v.campus_name) || "All campuses"}</small><h3>{str(v.grade_name)}{v.class_name ? ` · ${str(v.class_name)}` : ""}</h3><p>{str(v.subject_name)} · {str(v.weekly_periods)} periods/week</p></div>
                <b>{Number(v.teacher_count) ? `${str(v.teacher_count)} allocated` : "Teacher needed"}</b>
              </article>
            ))}
            {!(data.curriculumCoverage ?? []).length && <div className="teacher-empty"><span>🎯</span><h3>No curriculum mappings yet</h3><p>Create curriculum mappings in Academics to monitor teacher allocation coverage.</p></div>}
          </div>
        )}
      </section>
      {form && (
        <div className="teacher-overlay">
          <section className="teacher-form">
            <header>
              <div>
                <small>PHASE 3B</small>
                <h2>
                  {form === "subject"
                    ? "Create subject"
                    : form === "class_teacher"
                      ? "Assign class teacher"
                      : "Assign subject teacher"}
                </h2>
              </div>
              <button onClick={() => setForm(null)}>×</button>
            </header>
            {form === "subject" ? (
              <form onSubmit={(e) => submit(e, "create_subject")}>
                <label>
                  Subject name
                  <input name="name" required />
                </label>
                <label>
                  Subject code
                  <input name="code" placeholder="ENG" required />
                </label>
                <label>
                  Campus scope
                  <select name="campusId">
                    <option value="">All campuses</option>
                    {data.campuses.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Subject type
                  <select name="subjectType">
                    <option value="academic">Academic</option>
                    <option value="language">Language</option>
                    <option value="religious">Religious</option>
                    <option value="technology">Technology</option>
                    <option value="activity">Activity</option>
                  </select>
                </label>
                <label>
                  Display color
                  <input name="color" type="color" defaultValue="#7456de" />
                </label>
                <button disabled={busy}>Create subject</button>
              </form>
            ) : (
              <form
                onSubmit={(e) =>
                  submit(
                    e,
                    form === "class_teacher"
                      ? "assign_class_teacher"
                      : "assign_subject",
                  )
                }
              >
                <label>
                  Academic year
                  <select name="academicYearId" defaultValue={year} required>
                    <option value="">Select year</option>
                    {data.academicYears.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Campus
                  <select name="campusId" defaultValue={campus} required>
                    <option value="">Select campus</option>
                    {data.campuses.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Teacher
                  <select name="staffId" required>
                    <option value="">Select teacher</option>
                    {teachers.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.first_name} {v.last_name} · {v.employee_number}
                      </option>
                    ))}
                  </select>
                </label>
                {form === "assignment" && (
                  <label>
                    Subject
                    <select name="subjectId" required>
                      <option value="">Select subject</option>
                      {subjects.map((v) => (
                        <option value={v.id} key={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Class
                  <select name="classId" required>
                    <option value="">Select class</option>
                    {classes.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Section
                  <select name="sectionId">
                    <option value="">All sections / none</option>
                    {data.sections
                      .filter((v) => !campus || v.campus_id === campus)
                      .map((v) => (
                        <option value={v.id} key={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                </label>
                {form === "assignment" ? (
                  <>
                    <label>
                      Weekly periods
                      <input
                        name="weeklyPeriods"
                        type="number"
                        min="1"
                        max="30"
                        defaultValue="5"
                        required
                      />
                    </label>
                    <label className="teacher-check">
                      <input name="isPrimary" type="checkbox" /> Primary subject
                      teacher
                    </label>
                  </>
                ) : (
                  <label>
                    Notes
                    <textarea name="notes" />
                  </label>
                )}
                <button disabled={busy}>
                  {form === "class_teacher"
                    ? "Assign class teacher"
                    : "Save assignment"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
