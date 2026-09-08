"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown>;
type Analytics = {
  options: { academicYears: Row[]; terms: Row[]; classes: Row[]; sections: Row[]; subjects: Row[] };
  summary: Row; subjects: Row[]; classes: Row[]; grades: Row[]; students: Row[];
};
const empty: Analytics = { options: { academicYears: [], terms: [], classes: [], sections: [], subjects: [] }, summary: {}, subjects: [], classes: [], grades: [], students: [] };
const pct = (value: unknown) => value == null ? "—" : `${Number(value).toFixed(1)}%`;

export default function ExaminationPerformancePanel() {
  const [data, setData] = useState<Analytics>(empty);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");

  const load = async (parameters = "") => {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/examination-performance${parameters ? `?${parameters}` : ""}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({ error: "The server returned an empty response." })) as Analytics & { error?: string };
    if (response.ok) { setData(body); setQuery(parameters); } else setMessage(body.error ?? "Performance analysis could not be loaded.");
    setBusy(false);
  };
  useEffect(() => { void load(); }, []);
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parameters = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget).entries()) if (String(value)) parameters.set(key, String(value));
    void load(parameters.toString());
  };
  const strongest = data.subjects[0];
  const support = useMemo(() => [...data.students].filter((row) => Number(row.average_percentage ?? 0) < 50 || Number(row.failed_count ?? 0) > 0).slice(0, 8), [data.students]);
  const maxGrade = Math.max(1, ...data.grades.map((row) => Number(row.student_count ?? 0)));

  if (busy && !data.students.length) return <div className="analytics-loading">Preparing performance analysis…</div>;
  return <div className="analytics-workspace">
    <header className="analytics-heading">
      <div><h2>Examination performance analysis</h2><p>Compare outcomes across classes and subjects, identify support needs, and prepare promotion decisions.</p></div>
      <a className="analytics-export" href={`/api/examination-performance?${query ? `${query}&` : ""}format=csv`}>Export CSV</a>
    </header>
    <form className="analytics-filters" onSubmit={applyFilters}>
      <label>Academic year<select name="academicYearId"><option value="">All years</option>{data.options.academicYears.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></label>
      <label>Term<select name="termId"><option value="">All terms</option>{data.options.terms.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></label>
      <label>Class<select name="classId"><option value="">All classes</option>{data.options.classes.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></label>
      <label>Section<select name="sectionId"><option value="">All sections</option>{data.options.sections.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></label>
      <label>Subject<select name="subjectId"><option value="">All subjects</option>{data.options.subjects.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.name)}</option>)}</select></label>
      <button disabled={busy}>{busy ? "Refreshing…" : "Apply filters"}</button>
    </form>
    {message && <p className="analytics-message">{message}</p>}
    <section className="analytics-kpis">
      <article><span>📊</span><div><small>Overall average</small><b>{pct(data.summary.average_percentage)}</b></div></article>
      <article><span>✅</span><div><small>Pass rate</small><b>{pct(data.summary.pass_rate)}</b></div></article>
      <article><span>👥</span><div><small>Students analyzed</small><b>{Number(data.summary.student_count ?? 0)}</b></div></article>
      <article><span>🧾</span><div><small>Assessments included</small><b>{Number(data.summary.assessment_count ?? 0)}</b></div></article>
    </section>
    {!data.students.length ? <div className="academic-empty"><span>📈</span><h3>No calculated results yet</h3><p>Enter marks for an assessment to populate this analysis.</p></div> : <>
      <section className="analytics-grid">
        <article className="analytics-card">
          <header><div><h3>Subject performance</h3><p>{strongest ? `${String(strongest.subject_name)} currently leads at ${pct(strongest.average_percentage)}.` : "No subject results."}</p></div><span>By average</span></header>
          <div className="performance-bars">{data.subjects.slice(0, 10).map((row) => <div key={String(row.subject_id)}><div><b>{String(row.subject_name)}</b><small>{Number(row.result_count ?? 0)} results · {pct(row.pass_rate)} pass</small></div><span><i style={{ width: `${Math.min(100, Number(row.average_percentage ?? 0))}%` }} /></span><strong>{pct(row.average_percentage)}</strong></div>)}</div>
        </article>
        <article className="analytics-card">
          <header><div><h3>Grade distribution</h3><p>Calculated grades across the selected assessment results.</p></div><span>{Number(data.summary.passed_count ?? 0)} passed</span></header>
          <div className="grade-distribution">{data.grades.map((row) => <div key={String(row.grade_label)}><b>{String(row.grade_label)}</b><span><i style={{ height: `${Math.max(8, Number(row.student_count ?? 0) / maxGrade * 100)}%` }} /></span><strong>{Number(row.student_count ?? 0)}</strong><small>{pct(row.percentage)}</small></div>)}</div>
        </article>
      </section>
      <section className="analytics-grid lower">
        <article className="analytics-card">
          <header><div><h3>Class and section comparison</h3><p>Average achievement and pass rate by teaching group.</p></div><span>{data.classes.length} groups</span></header>
          <div className="analytics-table"><div className="head"><span>Class / section</span><span>Assessments</span><span>Average</span><span>Pass rate</span></div>{data.classes.map((row) => <div key={`${row.class_id}-${row.section_id}`}><span><b>{String(row.class_name)}</b><small>{String(row.section_name ?? "All sections")}</small></span><span>{Number(row.assessment_count ?? 0)}</span><span>{pct(row.average_percentage)}</span><span>{pct(row.pass_rate)}</span></div>)}</div>
        </article>
        <article className="analytics-card support-card">
          <header><div><h3>Students needing support</h3><p>Below 50% average or with one or more failed assessments.</p></div><span>{support.length} shown</span></header>
          <div className="support-list">{support.length ? support.map((row) => <div key={String(row.student_id)}><span>{String(row.rank_position)}</span><div><b>{String(row.first_name)} {String(row.last_name ?? "")}</b><small>{String(row.admission_number)} · {Number(row.failed_count ?? 0)} failed</small></div><strong>{pct(row.average_percentage)}</strong></div>) : <p>Every analyzed student is currently above the support threshold.</p>}</div>
        </article>
      </section>
      <article className="analytics-card ranking-card">
        <header><div><h3>Student performance ranking</h3><p>Promotion-ready summary across the selected examinations.</p></div><span>Top {Math.min(250, data.students.length)}</span></header>
        <div className="analytics-table ranking"><div className="head"><span>Rank</span><span>Student</span><span>Assessments</span><span>Average</span><span>Passed</span><span>Failed</span><span>Absent</span></div>{data.students.map((row) => <div key={String(row.student_id)}><span><b>#{String(row.rank_position)}</b></span><span><b>{String(row.first_name)} {String(row.last_name ?? "")}</b><small>{String(row.admission_number)} · Roll {String(row.roll_number ?? "—")}</small></span><span>{Number(row.assessment_count ?? 0)}</span><span>{pct(row.average_percentage)}</span><span className="positive">{Number(row.passed_count ?? 0)}</span><span className="negative">{Number(row.failed_count ?? 0)}</span><span>{Number(row.absent_count ?? 0)}</span></div>)}</div>
      </article>
    </>}
  </div>;
}
