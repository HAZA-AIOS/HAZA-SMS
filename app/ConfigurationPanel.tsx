"use client";
import { FormEvent, useState } from "react";
import { cn, moduleSurface } from "./ui/TailwindPrimitives";

export type ConfigurationData={
  school:{id:string;name:string;abbreviation:string|null;institution_type:string;tagline:string|null;address:string|null;email:string|null;phone:string|null;website:string|null;timezone:string;currency:string;date_input_format:string;date_display_format:string};
  campuses:{id:string;name:string;code:string;abbreviation:string|null;is_main:number;status:string;use_school_address:number;address:string|null;use_school_bank_details:number;bank_name:string|null;use_school_logo1:number;use_school_logo2:number;use_school_report_header:number;use_school_principal_signature:number}[];
  academicYears:{id:string;name:string;starts_on:string;ends_on:string;is_current:number;status:string}[];
  assets:{id:string;asset_type:string;campus_id:string|null;original_name:string}[];
};

export default function ConfigurationPanel({data}:{data:ConfigurationData}){
  const [tab,setTab]=useState<"school"|"campuses"|"years">("school");
  const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function jsonSubmit(url:string,method:string,event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    const payload=Object.fromEntries(new FormData(event.currentTarget).entries());
    const response=await fetch(url,{method,headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json().catch(()=>({error:"Request failed."}));
    if(!response.ok){setMessage(result.error??"Request failed.");setBusy(false);return;}
    window.location.reload();
  }
  async function upload(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    const response=await fetch("/api/configuration/assets",{method:"POST",body:new FormData(event.currentTarget)});
    const result=await response.json().catch(()=>({error:"Upload failed."}));
    if(!response.ok){setMessage(result.error??"Upload failed.");setBusy(false);return;} window.location.reload();
  }
  const schoolAssets=data.assets.filter(a=>!a.campus_id);
  return <div className={cn("config-page",moduleSurface)}>
    <div className="access-heading"><div><span className="eyebrow">PHASE 0D · CONFIGURATION</span><h1>School, Campus & Academic Year</h1><p>Organization defaults with controlled campus overrides and audited changes.</p></div><span className="phase-badge complete">0D Active</span></div>
    <div className="config-tabs"><button className={tab==="school"?"active":""} onClick={()=>setTab("school")}>🏫 School Profile</button><button className={tab==="campuses"?"active":""} onClick={()=>setTab("campuses")}>🏢 Campuses <b>{data.campuses.length}</b></button><button className={tab==="years"?"active":""} onClick={()=>setTab("years")}>🗓️ Academic Years <b>{data.academicYears.length}</b></button></div>
    {message&&<p className="access-message">{message}</p>}
    {tab==="school"&&<div className="config-layout">
      <form className="config-card config-form" onSubmit={e=>jsonSubmit("/api/configuration/school","PUT",e)}>
        <div className="card-title"><h2>General information</h2><p>These values become defaults for every campus.</p></div>
        <div className="config-fields"><label className="span-2">School name<input name="name" required defaultValue={data.school.name}/></label><label>Abbreviation<input name="abbreviation" maxLength={12} defaultValue={data.school.abbreviation??""}/></label><label>Institution type<select name="institutionType" defaultValue={data.school.institution_type}><option value="school">School</option><option value="academy">Academy</option><option value="college">College</option></select></label><label className="span-2">Tagline<input name="tagline" defaultValue={data.school.tagline??""}/></label><label className="span-2">Address<textarea name="address" rows={3} defaultValue={data.school.address??""}/></label><label>Email<input name="email" type="email" defaultValue={data.school.email??""}/></label><label>Phone<input name="phone" defaultValue={data.school.phone??""}/></label><label>Website<input name="website" defaultValue={data.school.website??""}/></label><label>Timezone<select name="timezone" defaultValue={data.school.timezone}><option>Asia/Karachi</option><option>UTC</option><option>Europe/Berlin</option><option>Europe/London</option><option>America/New_York</option></select></label><label>Currency<select name="currency" defaultValue={data.school.currency}><option>PKR</option><option>USD</option><option>GBP</option><option>EUR</option></select></label><label>Date input format<select name="dateInputFormat" defaultValue={data.school.date_input_format}><option>DD-MM-YYYY</option><option>MM-DD-YYYY</option><option>YYYY-MM-DD</option></select></label><label>Date display format<select name="dateDisplayFormat" defaultValue={data.school.date_display_format}><option>DD-MM-YYYY</option><option>DD MMM YYYY</option><option>YYYY-MM-DD</option></select></label></div>
        <button className="config-save" disabled={busy}>{busy?"Saving…":"Save school information"}</button>
      </form>
      <section className="config-card branding-card"><div className="card-title"><h2>Branding & official files</h2><p>Stored securely in organization-scoped R2 storage.</p></div>
        <div className="asset-list">{schoolAssets.length?schoolAssets.map(a=><div key={a.id}><span>📎</span><p><strong>{a.asset_type.replaceAll("_"," ")}</strong><small>{a.original_name}</small></p><b>Stored</b></div>):<p className="empty-state">No school assets uploaded yet.</p>}</div>
        <form className="asset-upload" onSubmit={upload}><input type="hidden" name="campusId" value=""/><label>Asset type<select name="assetType"><option value="logo_primary">Primary logo</option><option value="logo_secondary">Secondary logo</option><option value="report_header">Report header</option><option value="principal_signature">Principal signature</option><option value="paid_stamp">Paid stamp</option><option value="student_handbook">Student handbook</option></select></label><label>Choose file<input name="file" type="file" accept="image/png,image/jpeg,application/pdf" required/></label><button disabled={busy}>Upload asset</button></form>
      </section>
    </div>}
    {tab==="campuses"&&<div className="config-layout">
      <section className="campus-stack">{data.campuses.map(c=><form className="config-card campus-card" key={c.id} onSubmit={e=>jsonSubmit("/api/configuration/campuses","PUT",e)}><input type="hidden" name="campusId" value={c.id}/><div className="campus-card-head"><div><span>{c.is_main?"MAIN CAMPUS":"SUB CAMPUS"}</span><h2>{c.name}</h2><small>{c.code} · {c.status}</small></div><button disabled={busy}>Save changes</button></div><div className="config-fields"><label>Campus name<input name="name" required defaultValue={c.name}/></label><label>Campus code<input name="code" required defaultValue={c.code}/></label><label>Abbreviation<input name="abbreviation" defaultValue={c.abbreviation??""}/></label><label>Status<select name="status" defaultValue={c.status}><option>active</option><option>inactive</option><option>archived</option></select></label><label className="check-row span-2"><input type="checkbox" name="useSchoolAddress" defaultChecked={!!c.use_school_address}/> Use school address</label><label className="span-2">Campus address<textarea name="address" rows={2} disabled={!!c.use_school_address} defaultValue={c.address??""}/></label><label className="check-row"><input type="checkbox" name="useSchoolBankDetails" defaultChecked={!!c.use_school_bank_details}/> Use school bank details</label><label className="check-row"><input type="checkbox" name="useSchoolLogo1" defaultChecked={!!c.use_school_logo1}/> Use school primary logo</label><label className="check-row"><input type="checkbox" name="useSchoolLogo2" defaultChecked={!!c.use_school_logo2}/> Use school secondary logo</label><label className="check-row"><input type="checkbox" name="useSchoolReportHeader" defaultChecked={!!c.use_school_report_header}/> Use school report header</label><label className="check-row"><input type="checkbox" name="useSchoolPrincipalSignature" defaultChecked={!!c.use_school_principal_signature}/> Use principal signature</label></div></form>)}</section>
      <form className="config-card invite-form" onSubmit={e=>jsonSubmit("/api/configuration/campuses","POST",e)}><div className="card-title"><h2>Add campus</h2><p>New campuses inherit school settings automatically.</p></div><label>Campus name<input name="name" required placeholder="Hasilpur Campus"/></label><label>Campus code<input name="code" required placeholder="HSP"/></label><label>Abbreviation<input name="abbreviation" placeholder="TMS-HSP"/></label><button disabled={busy}>Create campus</button></form>
    </div>}
    {tab==="years"&&<div className="config-layout">
      <section className="config-card year-list"><div className="card-title"><h2>Academic years</h2><p>Only one academic year can be current at a time.</p></div>{data.academicYears.length?data.academicYears.map(y=><article key={y.id}><div><span>{y.is_current?"CURRENT":"ACADEMIC YEAR"}</span><strong>{y.name}</strong><small>{y.starts_on} → {y.ends_on}</small></div><em>{y.status}</em>{!y.is_current&&<form onSubmit={e=>jsonSubmit("/api/configuration/academic-years","PUT",e)}><input type="hidden" name="academicYearId" value={y.id}/><button>Set current</button></form>}</article>):<p className="empty-state">Create your first academic year.</p>}</section>
      <form className="config-card invite-form" onSubmit={e=>jsonSubmit("/api/configuration/academic-years","POST",e)}><div className="card-title"><h2>Create academic year</h2><p>Define the school-wide operating period.</p></div><label>Name<input name="name" required placeholder="2026–2027"/></label><label>Start date<input name="startsOn" type="date" required/></label><label>End date<input name="endsOn" type="date" required/></label><label className="check-row"><input name="isCurrent" type="checkbox"/> Set as current year</label><button disabled={busy}>Create academic year</button></form>
    </div>}
  </div>;
}
