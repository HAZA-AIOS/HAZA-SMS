"use client";
import { useEffect, useMemo, useState } from "react";

type RecordItem = { id:string; category:string; title:string; reference_code:string|null; person_name:string|null; assigned_to:string|null; status:string; priority:string; due_on:string|null; quantity:number|null; amount:number|null; notes:string|null; campus_name:string|null; created_by_name:string; updated_at:number };
type Data = { records:RecordItem[]; campuses:Array<{id:string;name:string}>; activeCampusId:string|null; canManage:boolean };
const modules = [
  ["library","📚","Library","Books, circulation and returns"], ["assets","🖥️","Inventory & Assets","Stock, equipment and maintenance"],
  ["transport","🚌","Transport","Vehicles, routes and servicing"], ["visitors","🪪","Visitors","Entry, purpose and checkout"],
  ["requests","🗂️","Complaints & Requests","Service cases and resolutions"], ["documents","📜","Certificates & Letters","Official document requests"],
  ["medical","🩺","Medical","Health incidents and follow-up"], ["discipline","⚖️","Discipline","Incidents and corrective actions"],
  ["events","🎪","School Events","Activities, venues and owners"],
] as const;
const terminal = new Set(["resolved","completed","returned","closed","cancelled"]);
const pretty = (v:string) => v.replaceAll("_"," ").replace(/\b\w/g, c=>c.toUpperCase());

export default function OperationsPanel(){
  const [data,setData]=useState<Data|null>(null),[tab,setTab]=useState("library"),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function load(){ const r=await fetch("/api/operations",{cache:"no-store"}); const j=await r.json(); if(!r.ok) throw new Error(j.error||"Operations are unavailable."); setData(j); }
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  const rows=useMemo(()=>data?.records.filter(r=>r.category===tab)??[],[data,tab]);
  async function create(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const f=new FormData(e.currentTarget),body=Object.fromEntries(f.entries());body.category=tab;try{const r=await fetch("/api/operations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),j=await r.json();if(!r.ok)throw new Error(j.error);e.currentTarget.reset();await load();}catch(e){setError(e instanceof Error?e.message:"Could not save record.");}finally{setBusy(false)}}
  async function status(id:string,value:string){setBusy(true);const r=await fetch("/api/operations",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id,status:value})}),j=await r.json();if(!r.ok)setError(j.error||"Could not update status.");else await load();setBusy(false)}
  if(!data)return <section className="operations-shell"><p className="operations-message">{error||"Loading operations…"}</p></section>;
  const current=modules.find(m=>m[0]===tab)!;
  const active=data.records.filter(r=>!terminal.has(r.status)).length, due=data.records.filter(r=>r.due_on&&r.due_on<=new Date().toISOString().slice(0,10)&&!terminal.has(r.status)).length;
  return <section className="operations-shell">
    <header className="operations-hero"><div><span>PHASE 12 · OPERATIONS & ASSET MANAGEMENT</span><h1>School Operations Centre</h1><p>Manage daily services, physical resources and student-support records across authorized campuses.</p></div><b>Campus protected</b></header>
    <div className="operations-metrics"><article><i>🧭</i><strong>{data.records.length}</strong><span>Total records</span></article><article><i>⏳</i><strong>{active}</strong><span>Active workflows</span></article><article><i>⚠️</i><strong>{due}</strong><span>Due or overdue</span></article><article><i>✅</i><strong>{data.records.length-active}</strong><span>Completed</span></article></div>
    <nav className="operations-tabs" aria-label="Operations modules">{modules.map(m=><button key={m[0]} className={tab===m[0]?"active":""} onClick={()=>setTab(m[0])}><span>{m[1]}</span>{m[2]}<small>{data.records.filter(r=>r.category===m[0]).length}</small></button>)}</nav>
    {error&&<p className="operations-error">{error}</p>}
    <div className="operations-grid">
      <div className="operations-register"><header><div><h2>{current[1]} {current[2]}</h2><p>{current[3]}</p></div><b>{rows.length} records</b></header>{rows.length?<div className="operations-table-wrap"><table><thead><tr><th>Record</th><th>Campus / Owner</th><th>Due</th><th>Priority</th><th>Status</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><strong>{r.title}</strong><small>{r.reference_code||"No reference"}{r.person_name?` · ${r.person_name}`:""}</small></td><td>{r.campus_name||"School-wide"}<small>{r.assigned_to||r.created_by_name}</small></td><td>{r.due_on||"—"}</td><td><span className={`operation-priority ${r.priority}`}>{r.priority}</span></td><td>{data.canManage?<select value={r.status} disabled={busy} onChange={e=>status(r.id,e.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="issued">Issued</option><option value="scheduled">Scheduled</option><option value="resolved">Resolved</option><option value="completed">Completed</option><option value="returned">Returned</option><option value="closed">Closed</option><option value="cancelled">Cancelled</option></select>:pretty(r.status)}</td></tr>)}</tbody></table></div>:<div className="operations-empty"><span>{current[1]}</span><h3>No {current[2].toLowerCase()} records</h3><p>Create the first campus-scoped record when it is needed.</p></div>}</div>
      {data.canManage&&<form className="operations-form" onSubmit={create}><header><h2>Add {current[2]} Record</h2><p>Required fields are marked.</p></header><label>Title / item name *<input name="title" required maxLength={180}/></label><div><label>Reference code<input name="referenceCode" maxLength={80}/></label><label>Campus<select name="campusId" defaultValue={data.activeCampusId||""}><option value="">School-wide</option>{data.campuses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><div><label>Person / contact<input name="personName"/></label><label>Assigned to<input name="assignedTo"/></label></div><div><label>Due / event date<input name="dueOn" type="date"/></label><label>Priority<select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></label></div><div><label>Quantity<input name="quantity" type="number" min="0"/></label><label>Amount<input name="amount" type="number" min="0" step="0.01"/></label></div><label>Notes<textarea name="notes" rows={4} maxLength={3000}/></label><button disabled={busy}>{busy?"Saving…":"+ Save record"}</button></form>}
    </div>
  </section>;
}
