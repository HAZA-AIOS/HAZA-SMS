"use client";
import { useEffect, useRef, useState } from "react";
import type { SecurityData } from "./SecurityPanel";

type Health = { status:"ready"|"degraded"|"unavailable"; checks:{application:boolean;database:boolean;storage:boolean}; checkedAt:string };
const stamp=(value:number|null)=>value?new Date(value).toLocaleString():"No completed backup";

export default function ProductionReadinessPanel({security}:{security:SecurityData}){
 const[health,setHealth]=useState<Health|null>(null),[checking,setChecking]=useState(false),[error,setError]=useState("");
 const activeCheck=useRef<AbortController|null>(null);
 async function check(){
  activeCheck.current?.abort();
  const controller=new AbortController();activeCheck.current=controller;
  const timer=setTimeout(()=>controller.abort(),10000);
  setChecking(true);setError("");
  try{
   const response=await fetch("/api/health",{cache:"no-store",signal:controller.signal});
   const body=await response.text();
   if(!body.trim())throw Error("Health service returned an empty response.");
   let result:Health;
   try{result=JSON.parse(body)}catch{throw Error("Health service returned an unreadable response. Please retry.")}
   if(!result||!["ready","degraded","unavailable"].includes(result.status)||!result.checks||
      [result.checks.application,result.checks.database,result.checks.storage].some(value=>typeof value!=="boolean")||typeof result.checkedAt!=="string")throw Error("Health service returned an invalid response.");
   if(!response.ok&&response.status!==503)throw Error("Health service could not be reached.");
   if(activeCheck.current===controller){setHealth(result);if(result.status!=="ready")setError("Some services need attention. Review the individual checks below.");}
  }catch(value){if(activeCheck.current===controller){setHealth(null);setError(controller.signal.aborted?"The health check timed out. Please retry.":value instanceof Error?value.message:"Health check failed.");}}
  finally{clearTimeout(timer);if(activeCheck.current===controller){setChecking(false);activeCheck.current=null;}}
 }
 useEffect(()=>{void check();return()=>{activeCheck.current?.abort();activeCheck.current=null}},[]);
 const services=health?[health.checks.application,health.checks.database,health.checks.storage].filter(Boolean).length:0;
 const gates=[
  ["Application build","Confirm the production build and deployment record before handover.",false],
  ["Security boundaries","Source checks passed; authenticated permission and workflow checks still require verification.",false],
  ["Database & storage","Live D1 and R2 bindings respond through the health endpoint.",health?.status==="ready"],
  ["Backup readiness",`Latest recovery snapshot: ${stamp(security.summary.lastBackupAt)}.`,Boolean(security.summary.lastBackupAt && Date.now()-security.summary.lastBackupAt < 86400000)],
  ["Recovery verification","Verify a restore from the current snapshot before handover.",false],
  ["Analytics verification","Confirm Analytics loads successfully for a signed-in school user.",false],
  ["Audit monitoring",`${security.summary.failed24h} failed operations recorded in the last 24 hours.`,security.summary.failed24h===0],
 ] as const;
 const passed=gates.filter(([, ,ready])=>ready).length;
 return <section className="readiness-shell">
  <header className="readiness-hero"><div><span>PHASE 14 · PRODUCTION READINESS & ROLLOUT</span><h1>Release Control Centre</h1><p>Live service health, recovery readiness and final rollout gates for The Mentor School.</p></div><b className={passed===gates.length?"ready":"review"}>{passed}/{gates.length} gates ready</b></header>
  <div className="readiness-metrics"><article><i>⚙️</i><strong>{health?.status??(checking?"Checking":"Review")}</strong><span>Production status</span></article><article><i>☁️</i><strong>{services}/3</strong><span>Live services</span></article><article><i>🧪</i><strong>Pending</strong><span>Workflow verification</span></article><article><i>💾</i><strong>{security.summary.lastBackupAt?"Available":"Required"}</strong><span>Recovery snapshot</span></article></div>
  {error&&<p role="alert" className="readiness-alert">{error}</p>}
  {health&&<p className="readiness-alert" role="status">Application: {health.checks.application?"Ready":"Unavailable"} · Database: {health.checks.database?"Ready":"Unavailable"} · File storage: {health.checks.storage?"Ready":"Unavailable"} · Checked {new Date(health.checkedAt).toLocaleString()}</p>}
  <div className="readiness-grid"><article className="readiness-card"><header><div><h2>Release gates</h2><p>Every gate must be green before full operational handover.</p></div><button onClick={check} disabled={checking}>{checking?"Checking…":"Run live check"}</button></header><div className="readiness-gates">{gates.map(([title,detail,ready])=><div key={title}><i className={ready?"pass":"review"}>{ready?"✓":"!"}</i><span><b>{title}</b><small>{detail}</small></span><em>{ready?"Ready":"Review"}</em></div>)}</div></article>
  <aside className="readiness-card rollout-card"><h2>Controlled rollout</h2><ol><li><b>1. Validate</b><span>Confirm health, permissions and critical school workflows.</span></li><li><b>2. Protect</b><span>Create a current recovery snapshot before operational handover.</span></li><li><b>3. Release</b><span>Use the production deployment and monitor audit failures.</span></li><li><b>4. Recover</b><span>Rollback to the last known-good version if a critical gate fails.</span></li></ol></aside></div>
 </section>
}
