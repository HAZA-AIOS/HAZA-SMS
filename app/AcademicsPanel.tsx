"use client";
import { FormEvent, useMemo, useState } from "react";

type Row = Record<string, unknown> & {
  id: string;
  name: string;
  status: string;
};
export type AcademicsData = {
  academicYears: (Row & {
    starts_on: string;
    ends_on: string;
    is_current: number;
  })[];
  terms: Row[];
  grades: Row[];
  classes: Row[];
  sections: Row[];
  campuses: (Row & { code: string; is_main: number })[];
  subjects: Row[];
  curriculumMappings: Row[];
  canManage: boolean;
  canManageCurriculum: boolean;
};
const post = async (body: Record<string, unknown>, method = "POST") => {
  const r = await fetch("/api/academics", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { error?: string };
  if (!r.ok) throw new Error(j.error || "Unable to save.");
  location.reload();
};

function AcademicEmpty({
  icon,
  title,
  description,
  action,
  canManage = false,
  onAdd,
}: {
  icon: string;
  title: string;
  description: string;
  action?: string;
  canManage?: boolean;
  onAdd?: () => void;
}) {
  return (
    <div className="academic-empty">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && canManage && onAdd && (
        <button type="button" onClick={onAdd}>
          ＋ {action}
        </button>
      )}
    </div>
  );
}

export default function AcademicsPanel({ data }: { data: AcademicsData }) {
  const [tab, setTab] = useState("years"),
    [form, setForm] = useState<string | null>(null),
    [message, setMessage] = useState("");
  const current = data.academicYears.find((v) => v.is_current),
    activeClasses = data.classes.filter((v) => v.status === "active"),
    activeSections = data.sections.filter((v) => v.status === "active");
  const submit = async (e: FormEvent<HTMLFormElement>, action: string) => {
    e.preventDefault();
    setMessage("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await post({ action, ...values });
    } catch (x) {
      setMessage(x instanceof Error ? x.message : "Unable to save.");
    }
  };
  const hierarchy = useMemo(
    () =>
      data.grades.map((g) => ({
        ...g,
        classes: activeClasses.filter((c) => c.grade_level_id === g.id),
      })),
    [data.grades, activeClasses],
  );
  const tabSetup: Record<
    string,
    {
      icon: string;
      title: string;
      description: string;
      form?: string;
      action?: string;
    }
  > = {
    years: {
      icon: "🗓️",
      title: "Academic years",
      description: "School sessions are managed from Configuration.",
    },
    terms: {
      icon: "📆",
      title: "Terms",
      description: "Define term dates within an academic year.",
      form: "term",
      action: "Add term",
    },
    grades: {
      icon: "🎓",
      title: "Grade levels",
      description:
        "Define school-wide learning levels used for curriculum and promotion.",
      form: "grade",
      action: "Add grade level",
    },
    classes: {
      icon: "🏫",
      title: "Classes / batches",
      description:
        "Create the class offered for a grade level, campus and academic year.",
      form: "class",
      action: "Add class / batch",
    },
    sections: {
      icon: "👥",
      title: "Sections",
      description: "Create sections inside a class and campus.",
      form: "section",
      action: "Add section",
    },
  };
  const activeTab = tabSetup[tab];
  return (
    <div className="academics-page foundation-page">
      <div className="phase-heading">
        <div>
          <span className="eyebrow">PHASE 4B · ACADEMIC STRUCTURE</span>
          <h1>Academic structure and curriculum</h1>
          <p>
            Manage years, grades, official class names, subjects and curriculum
            coverage across every campus.
          </p>
        </div>
      </div>
      <section className="academic-stats">
        <article>
          <span>🗓️</span>
          <b>{current?.name || "Not set"}</b>
          <small>Current academic year</small>
        </article>
        <article>
          <span>📆</span>
          <b>{data.terms.filter((v) => v.status === "active").length}</b>
          <small>Active terms</small>
        </article>
        <article>
          <span>🎓</span>
          <b>{data.grades.filter((v) => v.status === "active").length}</b>
          <small>Grade levels</small>
        </article>
        <article>
          <span>🏫</span>
          <b>{activeClasses.length}</b>
          <small>Classes across campuses</small>
        </article>
        <article>
          <span>👥</span>
          <b>{activeSections.length}</b>
          <small>Active sections</small>
        </article>
      </section>
      {message && <p className="academic-message">{message}</p>}
      <section className="academic-workspace">
        <header>
          <nav>
            {[
              ["years", "Academic years"],
              ["terms", "Terms"],
              ["grades", "Grade levels"],
              ["classes", "Classes / batches"],
              ["sections", "Sections"],
              ["subjects", "Subjects"],
              ["curriculum", "Curriculum map"],
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
        </header>
        {activeTab && (
          <div className="academic-tab-toolbar">
            <div>
              <span>{activeTab.icon}</span>
              <div>
                <h2>{activeTab.title}</h2>
                <p>{activeTab.description}</p>
              </div>
            </div>
            {activeTab.form && data.canManage ? (
              <button
                className="primary-action"
                type="button"
                onClick={() => setForm(activeTab.form!)}
                disabled={activeTab.form === "section" && !activeClasses.length}
              >
                ＋ {activeTab.action}
              </button>
            ) : activeTab.form ? (
              <small>View-only access</small>
            ) : null}
          </div>
        )}
        {tab === "years" &&
          (data.academicYears.length ? (
            <div className="academic-card-grid">
              {data.academicYears.map((y) => (
                <article key={y.id}>
                  <span>🗓️</span>
                  <div>
                    <small>
                      {y.is_current ? "CURRENT SESSION" : "ACADEMIC YEAR"}
                    </small>
                    <h3>{y.name}</h3>
                    <p>
                      {y.starts_on} — {y.ends_on}
                    </p>
                  </div>
                  <i className={y.status}>{y.status}</i>
                </article>
              ))}
            </div>
          ) : (
            <AcademicEmpty
              icon="🗓️"
              title="No academic years configured"
              description="Create an academic year from Configuration before adding terms, classes or curriculum mappings."
            />
          ))}
        {tab === "terms" &&
          (data.terms.length ? (
            <div className="academic-table">
              <div className="academic-row head">
                <span>Term</span>
                <span>Academic year</span>
                <span>Dates</span>
                <span>Status</span>
              </div>
              {data.terms.map((t) => (
                <div className="academic-row" key={t.id}>
                  <span>
                    <b>{t.name}</b>
                    <small>{String(t.code)}</small>
                  </span>
                  <span>{String(t.academic_year_name)}</span>
                  <span>
                    {String(t.starts_on)} — {String(t.ends_on)}
                  </span>
                  <span>
                    <i className={String(t.status)}>{String(t.status)}</i>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <AcademicEmpty
              icon="📆"
              title="No terms added yet"
              description="Add the first term and keep its dates inside the selected academic year."
              action="Add first term"
              canManage={data.canManage}
              onAdd={() => setForm("term")}
            />
          ))}
        {tab === "grades" &&
          (hierarchy.length ? (
            <div className="grade-grid">
              {hierarchy.map((g) => (
                <article key={g.id}>
                  <header>
                    <span>🎓</span>
                    <div>
                      <small>{String(g.stage).replace("_", " ")}</small>
                      <h3>{g.name}</h3>
                      <p>
                        {String(g.code)} · Order {String(g.sort_order)}
                      </p>
                    </div>
                  </header>
                  <div>
                    {g.classes.length ? (
                      <>
                        {g.classes.map((c) => (
                          <span key={c.id}>{c.name}</span>
                        ))}
                      </>
                    ) : (
                      <small>No classes linked yet</small>
                    )}
                  </div>
                  <footer>
                    Promotes to:{" "}
                    <b>
                      {String(g.promotion_to_name || "Final level / not set")}
                    </b>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <AcademicEmpty
              icon="🎓"
              title="No grade levels added yet"
              description="Create the school’s grade levels before linking classes and curriculum."
              action="Add first grade level"
              canManage={data.canManage}
              onAdd={() => setForm("grade")}
            />
          ))}
        {tab === "classes" &&
          (data.classes.length ? (
            <div className="academic-table">
              <div className="class-row head">
                <span>Class / batch name</span>
                <span>Grade level</span>
                <span>Campus</span>
                <span>Year</span>
                <span>Students / capacity</span>
                <span>Sections</span>
              </div>
              {data.classes.map((c) => (
                <div className="class-row" key={c.id}>
                  <span>
                    <b>{c.name}</b>
                    <small>{String(c.code)}</small>
                  </span>
                  <span>{String(c.grade_name || "Unmapped")}</span>
                  <span>{String(c.campus_name || "School-wide")}</span>
                  <span>{String(c.academic_year_name || "All years")}</span>
                  <span>
                    {String(c.student_count || 0)} / {String(c.capacity || "—")}
                  </span>
                  <span>{String(c.section_count || 0)}</span>
                </div>
              ))}
            </div>
          ) : (
            <AcademicEmpty
              icon="🏫"
              title="No classes / batches added yet"
              description="Add an official class name and optionally connect it to a grade, year and campus."
              action="Add first class / batch"
              canManage={data.canManage}
              onAdd={() => setForm("class")}
            />
          ))}
        {tab === "sections" &&
          (data.sections.length ? (
            <div className="academic-card-grid">
              {data.sections.map((s) => (
                <article key={s.id}>
                  <span>👥</span>
                  <div>
                    <small>
                      {String(s.class_name)} · {String(s.campus_name)}
                    </small>
                    <h3>{s.name}</h3>
                    <p>
                      {String(s.student_count || 0)} students · Capacity{" "}
                      {String(s.capacity || "not set")}
                    </p>
                  </div>
                  <i className={s.status}>{s.status}</i>
                </article>
              ))}
            </div>
          ) : (
            <AcademicEmpty
              icon="👥"
              title="No sections added yet"
              description={
                activeClasses.length
                  ? "Create the first section and assign it to a class and campus."
                  : "Add a class first, then create sections inside it."
              }
              action={activeClasses.length ? "Add first section" : undefined}
              canManage={data.canManage}
              onAdd={() => setForm("section")}
            />
          ))}
        {tab === "subjects" && (
          <div className="academic-tab-content">
            <div className="academic-tab-toolbar">
              <div>
                <span>📚</span>
                <div>
                  <h2>Subject catalog</h2>
                  <p>
                    Add and organize subjects before mapping them to grades and
                    classes.
                  </p>
                </div>
              </div>
              {data.canManageCurriculum ? (
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => setForm("subject")}
                >
                  ＋ Add subject
                </button>
              ) : (
                <small>View-only access</small>
              )}
            </div>
            {data.subjects.length ? (
              <div className="subject-catalog">
                {data.subjects.map((s) => (
                  <article
                    key={s.id}
                    style={{ borderTopColor: String(s.color) }}
                  >
                    <header>
                      <span style={{ background: String(s.color) }}>
                        {String(s.code).slice(0, 2)}
                      </span>
                      <div>
                        <small>
                          {String(s.subject_type)} ·{" "}
                          {String(s.department || "General")}
                        </small>
                        <h3>{s.name}</h3>
                      </div>
                    </header>
                    <p>
                      {String(s.description || "No subject description added.")}
                    </p>
                    <footer>
                      <b>
                        {String(s.default_weekly_periods || 5)} periods/week
                      </b>
                      <span>
                        {String(s.mapping_count || 0)} curriculum maps
                      </span>
                      <span>{String(s.teacher_count || 0)} teachers</span>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <div className="academic-empty">
                <span>📘</span>
                <h3>No subjects added yet</h3>
                <p>
                  Create the first subject with its code, type, department,
                  campus scope and weekly periods.
                </p>
                {data.canManageCurriculum && (
                  <button type="button" onClick={() => setForm("subject")}>
                    ＋ Add first subject
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {tab === "curriculum" && (
          <div className="academic-tab-content">
            <div className="academic-tab-toolbar">
              <div>
                <span>🗺️</span>
                <div>
                  <h2>Curriculum mapping</h2>
                  <p>
                    Connect subjects with an academic year, grade, class and
                    campus.
                  </p>
                </div>
              </div>
              {data.canManageCurriculum ? (
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => setForm("mapping")}
                  disabled={!data.subjects.length || !data.grades.length}
                >
                  ＋ Add curriculum mapping
                </button>
              ) : (
                <small>View-only access</small>
              )}
            </div>
            {data.curriculumMappings.length ? (
              <div className="academic-table">
                <div className="curriculum-row head">
                  <span>Grade / class</span>
                  <span>Subject</span>
                  <span>Year / campus</span>
                  <span>Curriculum source</span>
                  <span>Periods</span>
                </div>
                {data.curriculumMappings.map((m) => (
                  <div className="curriculum-row" key={m.id}>
                    <span>
                      <b>{String(m.grade_name)}</b>
                      <small>
                        {String(m.class_name || "All classes in grade")}
                      </small>
                    </span>
                    <span>
                      <b style={{ color: String(m.color) }}>
                        {String(m.subject_name)}
                      </b>
                      <small>{String(m.subject_code)}</small>
                    </span>
                    <span>
                      <b>{String(m.academic_year_name)}</b>
                      <small>{String(m.campus_name || "All campuses")}</small>
                    </span>
                    <span>
                      <b>
                        {String(m.curriculum_source || "School curriculum")}
                      </b>
                      <small>
                        {String(m.curriculum_reference || "No reference")}
                      </small>
                    </span>
                    <span>
                      <b>{String(m.weekly_periods)}</b>
                      <small>
                        {m.is_compulsory ? "Compulsory" : "Optional"}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="academic-empty">
                <span>🗺️</span>
                <h3>No curriculum mappings yet</h3>
                <p>
                  {!data.subjects.length
                    ? "Add at least one subject first, then connect it to a grade or class."
                    : !data.grades.length
                      ? "Add at least one grade level before creating a curriculum mapping."
                      : "Map your subjects to grades, classes, campuses and the current academic year."}
                </p>
                {data.canManageCurriculum &&
                  data.subjects.length > 0 &&
                  data.grades.length > 0 && (
                    <button type="button" onClick={() => setForm("mapping")}>
                      ＋ Add first mapping
                    </button>
                  )}
              </div>
            )}
          </div>
        )}
      </section>
      {form && (
        <div className="academic-overlay">
          <div className="academic-form">
            <header>
              <div>
                <small>PHASE 4B</small>
                <h2>Add {form}</h2>
              </div>
              <button onClick={() => setForm(null)}>×</button>
            </header>
            {form === "subject" ? (
              <form onSubmit={(e) => submit(e, "create_subject")}>
                <label>
                  Subject name
                  <input name="name" required placeholder="English" />
                </label>
                <label>
                  Subject code
                  <input name="code" required placeholder="ENG" />
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
                  Department
                  <input name="department" placeholder="Languages" />
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
                  Weekly periods
                  <input
                    name="defaultWeeklyPeriods"
                    type="number"
                    min="1"
                    max="30"
                    defaultValue="5"
                  />
                </label>
                <label>
                  Display color
                  <input name="color" type="color" defaultValue="#7456de" />
                </label>
                <label>
                  Description
                  <input
                    name="description"
                    placeholder="Subject purpose or scope"
                  />
                </label>
                <button>Save subject</button>
              </form>
            ) : form === "mapping" ? (
              <form onSubmit={(e) => submit(e, "create_mapping")}>
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
                  Grade level
                  <select name="gradeLevelId" required>
                    <option value="">Select grade</option>
                    {data.grades.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Class scope
                  <select name="classId">
                    <option value="">All classes in grade</option>
                    {activeClasses.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
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
                  Subject
                  <select name="subjectId" required>
                    <option value="">Select subject</option>
                    {data.subjects
                      .filter((v) => v.status === "active")
                      .map((v) => (
                        <option value={v.id} key={v.id}>
                          {v.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Weekly periods
                  <input
                    name="weeklyPeriods"
                    type="number"
                    min="1"
                    max="30"
                    defaultValue="5"
                  />
                </label>
                <label>
                  Curriculum source
                  <input
                    name="curriculumSource"
                    placeholder="CGP KS2 / IXL UK"
                  />
                </label>
                <label>
                  Reference / textbook
                  <input
                    name="curriculumReference"
                    placeholder="Framework, book or syllabus reference"
                  />
                </label>
                <label className="academic-check">
                  <input name="isCompulsory" type="checkbox" defaultChecked />{" "}
                  Compulsory subject
                </label>
                <button>Save curriculum mapping</button>
              </form>
            ) : form === "term" ? (
              <form onSubmit={(e) => submit(e, "create_term")}>
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
                  Term name
                  <input name="name" required placeholder="Term 1" />
                </label>
                <label>
                  Code
                  <input name="code" required placeholder="T1" />
                </label>
                <label>
                  Display order
                  <input
                    name="sortOrder"
                    type="number"
                    min="0"
                    defaultValue="1"
                  />
                </label>
                <label>
                  Starts on
                  <input name="startsOn" type="date" required />
                </label>
                <label>
                  Ends on
                  <input name="endsOn" type="date" required />
                </label>
                <button>Save term</button>
              </form>
            ) : form === "grade" ? (
              <form onSubmit={(e) => submit(e, "create_grade")}>
                <label>
                  Grade-level name
                  <input name="name" required placeholder="Grade 1" />
                </label>
                <label>
                  Code
                  <input name="code" required placeholder="G1" />
                </label>
                <label>
                  Stage
                  <select name="stage">
                    <option value="early_years">Early years</option>
                    <option value="primary">Primary</option>
                    <option value="middle">Middle</option>
                    <option value="secondary">Secondary</option>
                  </select>
                </label>
                <label>
                  Promotion order
                  <input
                    name="sortOrder"
                    type="number"
                    min="0"
                    defaultValue="1"
                  />
                </label>
                <label>
                  Promotes to
                  <select name="promotionToGradeId">
                    <option value="">Final / decide later</option>
                    {data.grades.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button>Save grade</button>
              </form>
            ) : form === "section" ? (
              <form onSubmit={(e) => submit(e, "create_section")}>
                <label>
                  Class
                  <select name="classId" required>
                    {activeClasses.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Campus
                  <select name="campusId" required>
                    {data.campuses.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Section name
                  <input name="name" required placeholder="Section A" />
                </label>
                <label>
                  Code
                  <input name="code" required placeholder="A" />
                </label>
                <label>
                  Capacity
                  <input name="capacity" type="number" min="1" />
                </label>
                <button>Save section</button>
              </form>
            ) : (
              <form onSubmit={(e) => submit(e, "create_class")}>
                <label>
                  Class / batch name
                  <input name="name" required placeholder="Reception 1" />
                </label>
                <label>
                  Code
                  <input name="code" required placeholder="R1" />
                </label>
                <label>
                  Academic year
                  <select name="academicYearId">
                    <option value="">All years</option>
                    {data.academicYears.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Grade level
                  <select name="gradeLevelId">
                    <option value="">Map later</option>
                    {data.grades.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Campus
                  <select name="campusId">
                    <option value="">School-wide</option>
                    {data.campuses.map((v) => (
                      <option value={v.id} key={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Capacity
                  <input name="capacity" type="number" min="1" />
                </label>
                <label>
                  Display order
                  <input
                    name="sortOrder"
                    type="number"
                    min="0"
                    defaultValue="1"
                  />
                </label>
                <button>Save class</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
