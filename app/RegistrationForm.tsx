"use client";
import { FormEvent, useState } from "react";

export default function RegistrationForm({email,displayName}:{email:string;displayName:string}) {
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setBusy(true); setError("");
    const form=new FormData(event.currentTarget);
    const payload=Object.fromEntries(form.entries());
    const response=await fetch("/api/registration",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json().catch(()=>({error:"Registration could not be completed."}));
    if(!response.ok){setError(result.error??"Registration could not be completed.");setBusy(false);return;}
    window.location.assign("/");
  }
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
        <label>School name<input name="schoolName" required minLength={3} placeholder="e.g. The Mentor School" /></label>
        <div className="form-row"><label>Abbreviation<input name="abbreviation" maxLength={12} placeholder="e.g. TMS" /></label><label>Institution type<select name="institutionType" defaultValue="school"><option value="school">School</option><option value="academy">Academy</option><option value="college">College</option></select></label></div>
        <label>Main campus name<input name="campusName" required defaultValue="Main Campus" /></label>
        <label>School address<textarea name="address" required rows={2} placeholder="Full school address" /></label>
        <div className="form-row"><label>School phone<input name="phone" required placeholder="+92..." /></label><label>Currency<select name="currency" defaultValue="PKR"><option value="PKR">PKR — Pakistani Rupee</option><option value="USD">USD — US Dollar</option><option value="GBP">GBP — British Pound</option><option value="EUR">EUR — Euro</option></select></label></div>
        <input type="hidden" name="timezone" value="Asia/Karachi" />
        {error&&<p className="form-error" role="alert">{error}</p>}
        <button className="primary-submit" type="submit" disabled={busy}>{busy?"Creating secure workspace…":"Create school workspace →"}</button>
        <a className="signout-link" href="/signout-with-chatgpt?return_to=/">Use another account</a>
      </form>
    </section>
  </main>;
}
