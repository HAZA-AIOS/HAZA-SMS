"use client";
import { FormEvent, useState } from "react";
import type { SubscriptionPlan } from "../lib/subscriptions";
import AuthVisualShell from "./AuthVisualShell";

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
  const labelClass="grid gap-2 text-sm font-bold text-white/85";
  const fieldClass="min-h-12 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-violet-100/40 focus:border-fuchsia-300/60 focus:bg-white/[.14] focus:ring-4 focus:ring-fuchsia-400/10";
  return <AuthVisualShell wide title="Create your school" subtitle="One secure workspace for your complete school." description="Register the main campus, choose your plan and become the school owner with Super Administrator access." points={["School-isolated data", "Multiple campuses", "Role-based access"]}>
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-400 font-black text-emerald-950">✓</span><div className="min-w-0"><small className="block text-xs font-bold uppercase tracking-[.14em] text-emerald-100/65">Verified email account</small><strong className="block truncate text-sm text-white">{displayName}</strong><span className="block truncate text-sm text-violet-100/65">{email}</span></div></div>
      <div className="mb-7 mt-8"><span className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-200/75">School onboarding · Step 1 of 1</span><h2 className="mt-3 text-3xl font-black tracking-tight">Register your school</h2><p className="mt-2 text-sm leading-6 text-violet-100/65">This account will become the school owner and Super Administrator.</p></div>
      <form onSubmit={submit} className="grid gap-5">
        <label className={labelClass}>Selected plan<select name="plan" value={plan} onChange={event=>setPlan(event.target.value as Exclude<SubscriptionPlan,"legacy">)} className={fieldClass}><option className="bg-purple-950" value="demo">7-day demo — Free</option><option className="bg-purple-950" value="monthly">Monthly — Rs. 5,000</option><option className="bg-purple-950" value="yearly">Yearly — Rs. 50,000</option></select><small className="font-normal leading-5 text-violet-100/55">{planLabel}. You can change this before creating the workspace.</small></label>
        <label className={labelClass}>School name<input className={fieldClass} name="schoolName" required minLength={3} placeholder="e.g. The Mentor School" /></label>
        <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>Abbreviation<input className={fieldClass} name="abbreviation" maxLength={12} placeholder="e.g. TMS" /></label><label className={labelClass}>Institution type<select className={fieldClass} name="institutionType" defaultValue="school"><option className="bg-purple-950" value="school">School</option><option className="bg-purple-950" value="academy">Academy</option><option className="bg-purple-950" value="college">College</option></select></label></div>
        <label className={labelClass}>Main campus name<input className={fieldClass} name="campusName" required defaultValue="Main Campus" /></label>
        <label className={labelClass}>School address<textarea className={fieldClass} name="address" required rows={2} placeholder="Full school address" /></label>
        <div className="grid gap-5 sm:grid-cols-2"><label className={labelClass}>School phone<input className={fieldClass} name="phone" required placeholder="+92..." /></label><label className={labelClass}>Currency<select className={fieldClass} name="currency" defaultValue="PKR"><option className="bg-purple-950" value="PKR">PKR — Pakistani Rupee</option><option className="bg-purple-950" value="USD">USD — US Dollar</option><option className="bg-purple-950" value="GBP">GBP — British Pound</option><option className="bg-purple-950" value="EUR">EUR — Euro</option></select></label></div>
        <input type="hidden" name="timezone" value="Asia/Karachi" />
        {error&&<p className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-100" role="alert">{error}</p>}
        <button className="min-h-14 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-700 px-5 text-base font-black text-white shadow-lg shadow-fuchsia-950/40 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}>{busy?"Creating secure workspace…":plan==="demo"?"Start 7-day demo →":"Create workspace and continue to payment →"}</button>
        <a className="text-center text-sm font-semibold text-violet-100/60 hover:text-white" href="/signout-with-chatgpt?return_to=/">Use another account</a>
      </form>
  </AuthVisualShell>;
}
