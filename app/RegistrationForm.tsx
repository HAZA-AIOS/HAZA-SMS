"use client";
import { FormEvent, useState } from "react";
import type { SubscriptionPlan } from "../lib/subscriptions";

export default function RegistrationForm({email,displayName,selectedPlan}:{email:string;displayName:string;selectedPlan:Exclude<SubscriptionPlan,"legacy">}) {
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [plan,setPlan]=useState(selectedPlan);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setBusy(true); setError("");
    const form=new FormData(event.currentTarget);
    const payload=Object.fromEntries(form.entries());
    const response=await fetch("/api/registration",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json().catch(()=>({error:"Registration could not be completed."}));
    if(!response.ok){setError(result.error??"Registration could not be completed.");setBusy(false);return;}
    window.location.assign(result.nextPath ?? "/subscription");
  }
  const planLabel=plan==="demo"?"7-day demo":plan==="monthly"?"Monthly — Rs. 5,000/month":"Yearly — Rs. 50,000/year";
  return <main className="auth-page">
    <section className="auth-brand">
      <img src="/tms-original-logo-transparent.png" alt="The Mentor School logo" />
      <span>THE MENTOR SCHOOL SMS</span>
      <h1>Create your school workspace</h1>
      <p>One secure platform for every campus, team and academic year.</p>
      <div className="auth-points"><span>✓ School-isolated data</span><span>✓ Multiple campuses</span><span>✓ Role-based access</span></div>
    </section>
    <section className="registration-card">
      <div className="signed-account"><span>✓</span><div><small>Signed in with ChatGPT</small><strong>{displayName}</strong><em>{email}</em></div></div>
      <div className="registration-title"><span>STEP 1 OF 1</span><h2>Register your school</h2><p>This account will become the school owner and Super Administrator.</p></div>
      <form onSubmit={submit}>
        <label>Selected plan<select name="plan" value={plan} onChange={event=>setPlan(event.target.value as Exclude<SubscriptionPlan,"legacy">)}><option value="demo">7-day demo — Free</option><option value="monthly">Monthly — Rs. 5,000</option><option value="yearly">Yearly — Rs. 50,000</option></select><small>{planLabel}. You can change this selection before creating the workspace.</small></label>
        <label>School name<input name="schoolName" required minLength={3} placeholder="e.g. The Mentor School" /></label>
        <div className="form-row"><label>Abbreviation<input name="abbreviation" maxLength={12} placeholder="e.g. TMS" /></label><label>Institution type<select name="institutionType" defaultValue="school"><option value="school">School</option><option value="academy">Academy</option><option value="college">College</option></select></label></div>
        <label>Main campus name<input name="campusName" required defaultValue="Main Campus" /></label>
        <label>School address<textarea name="address" required rows={2} placeholder="Full school address" /></label>
        <div className="form-row"><label>School phone<input name="phone" required placeholder="+92..." /></label><label>Currency<select name="currency" defaultValue="PKR"><option value="PKR">PKR — Pakistani Rupee</option><option value="USD">USD — US Dollar</option><option value="GBP">GBP — British Pound</option><option value="EUR">EUR — Euro</option></select></label></div>
        <input type="hidden" name="timezone" value="Asia/Karachi" />
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="primary-submit" type="submit" disabled={busy}>{busy?"Creating secure workspace…":plan==="demo"?"Start 7-day demo →":"Create workspace and continue to payment →"}</button>
        <a className="signout-link" href="/signout-with-chatgpt?return_to=/">Use another account</a>
      </form>
    </section>
  </main>;
}
