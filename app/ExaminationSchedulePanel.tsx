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
  examTypes: Row[];
  gradingSchemes: Row[];
  gradeBoundaries: Row[];
  assessments: Row[];
  markRoster: Row[];
  canManage: boolean;
  canManageEvents: boolean;
  canManageTypes: boolean;
  canManageAssessments: boolean;
  canManageGrading: boolean;
  canEnterMarks: boolean;
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
  examTypes: [],
  gradingSchemes: [],
  gradeBoundaries: [],
  assessments: [],
  markRoster: [],
  canManage: false,
  canManageEvents: false,
  canManageTypes: false,
  canManageAssessments: false,
  canManageGrading: false,
  canEnterMarks: false,
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
    [tab, setTab] = useState("assessments"),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState(""),
    [selectedAssessment, setSelectedAssessment] = useState("");
  const load = async (assessmentId = selectedAssessment) => {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(
          `/api/examination-schedule${assessmentId ? `?assessmentId=${encodeURIComponent(assessmentId)}` : ""}`,
          { cache: "no-store" },
        ),
        j = (await r.json().catch(() => ({
          error: "The server returned an empty response. Please try again.",
        }))) as Data & { error?: string };
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
    // Initial campus load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const openMarks = async (id: string) => {
    setSelectedAssessment(id);
    setTab("marks");
    await load(id);
  };
  const editMark = (studentId: string, field: string, value: unknown) =>
    setData((current) => ({
      ...current,
      markRoster: current.markRoster.map((row) =>
        row.student_id === studentId ? { ...row, [field]: value } : row,
      ),
    }));
  const saveMarks = async () => {
    setMessage("");
    const r = await fetch("/api/examination-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save_marks",
          campusId: data.campusId,
          assessmentId: selectedAssessment,
          records: data.markRoster.map((v) => ({
            studentId: v.student_id,
            enrollmentId: v.enrollment_id,
            obtainedMarks: v.obtained_marks ?? "",
            isAbsent: Boolean(v.is_absent),
            teacherRemarks: v.teacher_remarks ?? "",
          })),
        }),
      }),
      j = (await r
        .json()
        .catch(() => ({
          error: "The server returned an empty response. Please try again.",
        }))) as { error?: string };
    if (!r.ok) {
      setMessage(j.error || "Unable to save marks.");
      return;
    }
    setMessage(`Saved marks for ${data.markRoster.length} students.`);
    await load(selectedAssessment);
  };
  const send = async (e: FormEvent<HTMLFormElement>, action: string) => {
    e.preventDefault();
    setMessage("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const r = await fetch("/api/examination-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, campusId: data.campusId, ...body }),
      }),
      j = (await r.json().catch(() => ({
        error: "The server returned an empty response. Please try again.",
      }))) as { error?: string };
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
      const j = (await r.json().catch(() => ({
        error: "The server returned an empty response. Please try again.",
      }))) as { error?: string };
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
            PHASE 8B · MARKS, RESULTS & TEACHER REMARKS
          </span>
          <h1>Examinations, marks and calculated results</h1>
          <p>
            Define examination types, assessment plans and transparent grading
            rules while retaining campus timetables and events.
          </p>
        </div>
        <span className="phase-badge complete">
          {data.assessments.length} assessments
        </span>
      </div>
      <section className="exam-summary">
        <article>
          <span>📝</span>
          <b>{data.examTypes.length}</b>
          <small>Examination types</small>
        </article>
        <article>
          <span>📅</span>
          <b>{data.assessments.length}</b>
          <small>Configured assessments</small>
        </article>
        <article>
          <span>🏫</span>
          <b>{data.gradingSchemes.length}</b>
          <small>Grading schemes</small>
        </article>
        <article>
          <span>👩‍🏫</span>
          <b>{upcoming.length}</b>
          <small>Upcoming timetable entries</small>
        </article>
      </section>
      {message && <p className="timetable-message">{message}</p>}
      <section className="exam-workspace">
        <nav>
          {[
            ["marks", "Marks entry"],
            ["assessments", "Assessments"],
            ["exam-types", "Exam types"],
            ["grading", "Grade configuration"],
            ["create-assessment", "Create assessment"],
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
        {tab === "marks" && (
          <div className="marks-workspace">
            <header>
              <div>
                <h2>Marks entry and teacher remarks</h2>
                <p>
                  Choose an assessment, enter each student’s marks, and let
                  HAZA-SMS calculate percentages, grades and pass status.
                </p>
              </div>
              <select
                value={selectedAssessment}
                onChange={(e) => void openMarks(e.target.value)}
              >
                <option value="">Select assessment</option>
                {data.assessments.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title as string} · {v.class_name as string} ·{" "}
                    {v.subject_name as string}
                  </option>
                ))}
              </select>
            </header>
            {!selectedAssessment ? (
              <div className="academic-empty">
                <span>✍️</span>
                <h3>Select an assessment to begin</h3>
                <p>
                  The correct enrolled students will be loaded automatically.
                </p>
              </div>
            ) : data.markRoster.length ? (
              <>
                <div className="marks-table-wrap">
                  <table className="marks-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Roll no.</th>
                        <th>Marks</th>
                        <th>Absent</th>
                        <th>Result</th>
                        <th>Teacher remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.markRoster.map((v) => {
                        const assessment = data.assessments.find(
                            (a) => a.id === selectedAssessment,
                          ),
                          max = Number(assessment?.maximum_marks || 100),
                          marks =
                            v.obtained_marks == null
                              ? ""
                              : String(v.obtained_marks),
                          percentage = Boolean(v.is_absent)
                            ? null
                            : marks === ""
                              ? null
                              : Math.round((Number(marks) / max) * 10000) / 100;
                        return (
                          <tr key={v.id || String(v.student_id)}>
                            <td>
                              <b>
                                {v.first_name as string} {v.last_name as string}
                              </b>
                              <small>{v.admission_number as string}</small>
                            </td>
                            <td>{(v.roll_number as string) || "—"}</td>
                            <td>
                              <div className="mark-input">
                                <input
                                  type="number"
                                  min="0"
                                  max={max}
                                  step="0.01"
                                  value={marks}
                                  disabled={Boolean(v.is_absent)}
                                  onChange={(e) =>
                                    editMark(
                                      String(v.student_id),
                                      "obtained_marks",
                                      e.target.value,
                                    )
                                  }
                                />
                                <span>/ {max}</span>
                              </div>
                            </td>
                            <td>
                              <input
                                className="marks-check"
                                type="checkbox"
                                checked={Boolean(v.is_absent)}
                                onChange={(e) =>
                                  editMark(
                                    String(v.student_id),
                                    "is_absent",
                                    e.target.checked ? 1 : 0,
                                  )
                                }
                              />
                            </td>
                            <td>
                              {Boolean(v.is_absent) ? (
                                <span className="result-pill absent">
                                  Absent
                                </span>
                              ) : v.grade_label ? (
                                <span
                                  className={`result-pill ${Boolean(v.is_passing) ? "pass" : "fail"}`}
                                >
                                  {v.grade_label as string} ·{" "}
                                  {v.percentage as number}%
                                </span>
                              ) : percentage == null ? (
                                <span className="result-pill">Pending</span>
                              ) : (
                                <span className="result-pill">
                                  {percentage}%
                                </span>
                              )}
                            </td>
                            <td>
                              <input
                                value={String(v.teacher_remarks || "")}
                                onChange={(e) =>
                                  editMark(
                                    String(v.student_id),
                                    "teacher_remarks",
                                    e.target.value,
                                  )
                                }
                                placeholder="Progress note or support needed"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <footer>
                  <span>{data.markRoster.length} enrolled students</span>
                  <button
                    disabled={!data.canEnterMarks}
                    onClick={() => void saveMarks()}
                  >
                    Save marks and calculate results
                  </button>
                </footer>
              </>
            ) : (
              <div className="academic-empty">
                <span>👥</span>
                <h3>No eligible students</h3>
                <p>
                  Students must have an active enrollment matching this
                  assessment’s year, campus, class and section.
                </p>
              </div>
            )}
          </div>
        )}
        {tab === "assessments" &&
          (data.assessments.length ? (
            <div className="assessment-grid">
              {data.assessments.map((v) => (
                <article key={v.id}>
                  <div className="assessment-card-top">
                    <span>🧾</span>
                    <small>{String(v.status).toUpperCase()}</small>
                  </div>
                  <h3>{v.title as string}</h3>
                  <p>
                    {v.examination_type_name as string} ·{" "}
                    {v.assessment_mode as string}
                  </p>
                  <dl>
                    <div>
                      <dt>Class</dt>
                      <dd>
                        {v.class_name as string}
                        {v.section_name ? ` / ${v.section_name}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Subject</dt>
                      <dd>{v.subject_name as string}</dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>{nice(v.assessment_date)}</dd>
                    </div>
                    <div>
                      <dt>Marks</dt>
                      <dd>
                        {v.passing_marks as number} /{" "}
                        {v.maximum_marks as number} pass
                      </dd>
                    </div>
                  </dl>
                  <footer>
                    <span>{v.weightage as number}% weightage</span>
                    <span>
                      {(v.grading_scheme_name as string) || "No grading scheme"}
                    </span>
                    {data.canEnterMarks && (
                      <button onClick={() => void openMarks(v.id)}>
                        Enter marks
                      </button>
                    )}
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <div className="academic-empty">
              <span>🧾</span>
              <h3>No assessments configured</h3>
              <p>
                Create a class and subject assessment with marks and grading
                rules.
              </p>
              {data.canManageAssessments && (
                <button onClick={() => setTab("create-assessment")}>
                  ＋ Create assessment
                </button>
              )}
            </div>
          ))}
        {tab === "exam-types" && (
          <div className="exam-config-grid">
            <section>
              <h2>Reusable examination types</h2>
              <p>
                Standardize how assessments are classified across the school.
              </p>
              <div className="exam-type-grid">
                {data.examTypes.map((v) => (
                  <article key={v.id}>
                    <span>📝</span>
                    <div>
                      <h3>{v.name}</h3>
                      <p>
                        {v.code as string} · {v.assessment_mode as string}
                      </p>
                    </div>
                    <b>{v.default_weightage as number}%</b>
                  </article>
                ))}
              </div>
            </section>
            {data.canManageTypes && (
              <form
                className="exam-form compact"
                onSubmit={(e) => send(e, "create_exam_type")}
              >
                <h2>Add examination type</h2>
                <label>
                  Name
                  <input name="name" placeholder="Term Examination" required />
                </label>
                <div>
                  <label>
                    Code
                    <input name="code" placeholder="TERM" required />
                  </label>
                  <label>
                    Mode
                    <select name="assessmentMode">
                      <option value="written">Written</option>
                      <option value="oral">Oral</option>
                      <option value="practical">Practical</option>
                      <option value="project">Project</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </label>
                </div>
                <label>
                  Default weightage
                  <input
                    type="number"
                    name="defaultWeightage"
                    min="1"
                    max="100"
                    defaultValue="100"
                  />
                </label>
                <label className="check-label">
                  <input type="checkbox" name="requiresApproval" /> Results
                  require approval
                </label>
                <button>Save type</button>
              </form>
            )}
          </div>
        )}
        {tab === "grading" && (
          <div className="grading-grid">
            <section>
              <h2>Grading schemes</h2>
              {data.gradingSchemes.map((s) => (
                <article key={s.id}>
                  <header>
                    <div>
                      <h3>{s.name}</h3>
                      <p>
                        {s.code as string} ·{" "}
                        {(s.academic_year_name as string) ||
                          "All academic years"}
                      </p>
                    </div>
                    {Boolean(s.is_default) && <span>Default</span>}
                  </header>
                  <div className="grade-bands">
                    {data.gradeBoundaries
                      .filter((b) => b.grading_scheme_id === s.id)
                      .map((b) => (
                        <div key={b.id}>
                          <b>{b.grade_label as string}</b>
                          <span>
                            {b.minimum_percentage as number}–
                            {b.maximum_percentage as number}%
                          </span>
                          <small>
                            {Boolean(b.is_passing) ? "Pass" : "Not passing"}
                          </small>
                        </div>
                      ))}
                  </div>
                </article>
              ))}
            </section>
            {data.canManageGrading && (
              <section className="grading-forms">
                <form
                  className="exam-form compact"
                  onSubmit={(e) => send(e, "create_grading_scheme")}
                >
                  <h2>New grading scheme</h2>
                  <div>
                    <label>
                      Name
                      <input
                        name="name"
                        placeholder="Standard grading"
                        required
                      />
                    </label>
                    <label>
                      Code
                      <input name="code" placeholder="STD" required />
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
                  <label className="check-label">
                    <input type="checkbox" name="isDefault" /> Set as default
                  </label>
                  <button>Save scheme</button>
                </form>
                <form
                  className="exam-form compact"
                  onSubmit={(e) => send(e, "add_grade_boundary")}
                >
                  <h2>Add grade band</h2>
                  <label>
                    Scheme
                    <select name="gradingSchemeId" required>
                      <option value="">Select scheme</option>
                      {data.gradingSchemes.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <label>
                      Grade
                      <input name="label" placeholder="A+" required />
                    </label>
                    <label>
                      Minimum %
                      <input
                        type="number"
                        name="minimumPercentage"
                        min="0"
                        max="100"
                        required
                      />
                    </label>
                    <label>
                      Maximum %
                      <input
                        type="number"
                        name="maximumPercentage"
                        min="0"
                        max="100"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Grade point
                    <input
                      type="number"
                      name="gradePoint"
                      min="0"
                      max="10"
                      step="0.01"
                    />
                  </label>
                  <label>
                    Remarks
                    <input name="remarks" placeholder="Outstanding" />
                  </label>
                  <label className="check-label">
                    <input type="checkbox" name="isPassing" /> Passing grade
                  </label>
                  <button>Add grade band</button>
                </form>
              </section>
            )}
          </div>
        )}
        {tab === "create-assessment" && (
          <form
            className="exam-form"
            onSubmit={(e) => send(e, "create_assessment")}
          >
            <header>
              <span>🧾</span>
              <div>
                <h2>Create assessment</h2>
                <p>
                  Connect the assessment to the selected campus, academic year,
                  class and subject.
                </p>
              </div>
            </header>
            <input type="hidden" name="academicYearId" value={year?.id || ""} />
            <label>
              Assessment title
              <input name="title" placeholder="Term 1 Mathematics" required />
            </label>
            <div>
              <label>
                Examination type
                <select name="examinationTypeId" required>
                  <option value="">Select type</option>
                  {data.examTypes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
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
              <label>
                Grading scheme
                <select name="gradingSchemeId">
                  <option value="">No scheme</option>
                  {data.gradingSchemes.map((v) => (
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
                Assessment date
                <input type="date" name="assessmentDate" required />
              </label>
              <label>
                Maximum marks
                <input
                  type="number"
                  name="maximumMarks"
                  min="1"
                  defaultValue="100"
                  required
                />
              </label>
              <label>
                Passing marks
                <input
                  type="number"
                  name="passingMarks"
                  min="0"
                  defaultValue="40"
                  required
                />
              </label>
              <label>
                Weightage %
                <input
                  type="number"
                  name="weightage"
                  min="1"
                  max="100"
                  defaultValue="100"
                  required
                />
              </label>
            </div>
            <button
              disabled={!data.canManageAssessments || !data.examTypes.length}
            >
              Save assessment
            </button>
            {!data.examTypes.length && <p>Create an examination type first.</p>}
          </form>
        )}
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
