"use client";
import { useState } from "react";
import type { OrganizationChoice } from "../lib/authorization";

export default function SchoolSelectionPanel({schools,userName}:{schools:OrganizationChoice[];userName:string}){
  const [busy,setBusy]=useState("");const [error,setError]=useState("");
  async function choose(organizationId:string){setBusy(organizationId);setError("");const response=await fetch("/api/session/context",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId})});const result=await response.json().catch(()=>({error:"School selection failed."}));if(!response.ok){setError(result.error);setBusy("");return;}window.location.reload();}
  return <main className="welcome-page"><section className="welcome-card school-choice"><img src="/tms-original-logo-transparent.png" alt="The Mentor School logo"/><span className="welcome-kicker">SECURE SCHOOL CONTEXT</span><h1>Select your school</h1><p>{userName}, your account belongs to more than one school. Choose the school workspace you want to open.</p><div>{schools.map(school=><button key={school.organizationId} disabled={!!busy} onClick={()=>choose(school.organizationId)}><span>🏫</span><b>{school.schoolName}</b><small>{busy===school.organizationId?"Opening…":"Open secure workspace"}</small></button>)}</div>{error&&<p className="form-error">{error}</p>}</section></main>;
}
