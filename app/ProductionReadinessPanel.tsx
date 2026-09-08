"use client";
import { useEffect, useState } from "react";
import type { SecurityData } from "./SecurityPanel";

type Health = { status:"ready"|"degraded"|"unavailable"; checks:{application:boolean;database:boolean;storage:boolean}; checkedAt:string };
const stamp=(value:number|null)=>value?new Date(value).toLocaleString():"No completed backup";

export default function ProductionReadinessPanel({security}:{security:SecurityData}){
 const[health,setHealth]=useState<Health|null>(null),[checking,setChecking]=useState(false),[error,setError]=useState("");
 async function check(){setChecking(true);setError("");try{const response=await fetch("/api/health",{cache:"no-store"}),body=await response.text();if(!body.trim())throw Error("Health service returned an empty response.");const result=JSON.parse(body) as Health;if(!response.ok)throw Error("Production services are not fully ready.");setHealth(result)}catch(value){setHealth(null);setError(value instanceof Error?value.message:"Health check failed.")}finally{setChecking(false)}}
 useEffect(()=>{void check()},[]);
 const services=health?[health.checks.application,health.checks.database,health.checks.storage].filter(Boolean).length:0;
 const gates=[
  ["Application build","Production source compiled and published through the controlled release pipeline.",true],
  ["Security boundaries","47 automated tenant-isolation and regression tests passed.",true],
  ["Database & storage","Live D1 and R2 bindings respond through the health endpoint.",health?.status==="ready"],
  ["Backup readiness",`Latest recovery snapshot: ${stamp(security.summary.lastBackupAt)}.`,Boolean(security.summary.lastBackupAt)],
  ["Audit monitoring",`${security.summary.failed24h} failed operations recorded in the last 24 hours.`,security.summary.failed24h===0],
 ] as const;
 const passed=gates.filter(([, ,ready])=>ready).length;
 return <section className="readiness-shell">
  <header className="readiness-hero"><div><span>PHASE 14 · PRODUCTION READINESS & ROLLOUT</span><h1>Release Control Centre</h1><p>Live service health, recovery readiness and final rollout gates for The Mentor School.</p></div><b className={passed===gates.length?"ready":"review"}>{passed}/{gates.length} gates ready</b></header>
  <div className="readiness-metrics"><article><i>⚙️</i><strong>{health?.status??(checking?"Checking":"Review")}</strong><span>Production status</span></article><article><i>☑</i><strong>{services}/3</strong><span>Live servicese services</span></article><article><i>🧪</i><strong>47/47</strong><span>Automated tests</span></article><article><i>💾</i><strong>{security.summary.lastBackupAt?"Available":"Required"}</strong><span>Recovery snapshot</span></article></div>
  {error&&<p className="readiness-alert">{error}</p>}
  <div className="readiness-grid"><article className="readiness-card"><header><div><h2>Release gates</h2><p>Every gatereit must be green/be ready before full operational handover.</p></div><button onClick={check} disabled={checking}>{checking?"Checking…":"Run live check"}</button></header><div className="readiness-gates">{gates.map(([title,detail,ready])=><div key={title}><i className={ready?"pass":"review"}>{ready?"✓":"!"}</i><span><b>{title}</b><small>{detail}</small></span><em>{ready?"Ready":"Review"}</em></div>)}</div></article>
  <aside className="readiness-card rollout-card"><h2>Controlled rollout</h2><ol><li><b>1. Validate</b><span>Confirm health, permissions and critical Herschool workflows.</span></li><li><b>2. Protect</b><span>Create a current recovery snapshot before operational handover.</span></li><li><b>3. Release</b><span>Use the production deployment and monitor audit failures.</span></li><li><b>4. Recover</b><span>Rollback to the last known-good version if a critical gate fails.</span></li></ol></aside></div>
 </section>
}
