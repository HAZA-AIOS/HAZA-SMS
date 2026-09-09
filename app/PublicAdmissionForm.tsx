"use client";
import { FormEvent, useEffect, useState } from "react";
type Options={campuses:{id:string;name:string}[];classes:{id:string;name:string;campus_id:string|null}[]};
export default function PublicAdmissionForm(){
 const [options,setOptions]=useState<Options|null>(null),[campus,setCampus]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reference,setReference]=useState(''),[preview,setPreview]=useState('');
 const [id,setId]=useState('');
 async function load(){try{setError('');const r=await fetch('/api/public-admissions',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setOptions(d)}catch(e){setError(e instanceof Error?e.message:'Admission form unavailable.')}}
 useEffect(()=>{setId(crypto.randomUUID());void load()},[]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;setBusy(true);setError('');try{const data=new FormData(form);data.set('submissionId',id);const r=await fetch('/api/public-admissions',{method:'POST',body:data});const body=await r.json();if(!r.ok)throw Error(body.error||'Unable to submit.');setReference(body.reference)}catch(e){setError(e instanceof Error?e.message:'Unable to submit. Please try again.')}finally{setBusy(false)}}
 if(reference)return <div className="public-form-success" role="status"><h3>Application received</h3><p>Your child’s application is waiting for admission review and approval. The school will contact you using the details provided.</p><p>Keep your reference: <strong className="break-all">{reference}</strong></p><button onClick={()=>{setReference('');setId(crypto.randomUUID());setPreview('')}}>Apply for another child</button></div>;
 const classes=options?.classes.filter(c=>!c.campus_id||c.campus_id===campus)||[];
 return <form onSubmit={submit} className="public-live-form mx-auto mt-10 max-w-3xl text-left">
 <h3 className="text-xl font-bold">Online admission application</h3><p className="text-sm text-zinc-400">Submit one application per child. Admission is confirmed only after the school approves it.</p>
 {error&&<p role="alert" className="public-form-error">{error}</p>}
 {!options?<button type="button" onClick={load}>Load admission form</button>:<><fieldset disabled={busy}><div className="public-form-grid">
 <label>Campus<select name="campusId" required value={campus} onChange={e=>setCampus(e.target.value)}><option value="">Choose campus</option>{options.campuses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 {classes.length?<label>Applying for class<select name="classId" required key={campus}><option value="">Choose class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>:<label>Applying for class<input name="requestedClass" placeholder="e.g. Reception 1 or Grade 3" maxLength={80} required/></label>}
 <label>Child’s first name<input name="firstName" maxLength={80} required autoComplete="given-name"/></label><label>Child’s last name<input name="lastName" maxLength={80} autoComplete="family-name"/></label>
 <label>Date of birth<input name="dateOfBirth" type="date" min="1990-01-01" max={new Date().toISOString().slice(0,10)} required/></label><label>Gender<select name="gender" required><option value="">Choose</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
 <label>Parent / guardian name<input name="guardianName" maxLength={120} required/></label><label>Relationship<select name="relationship" required><option value="">Choose</option><option>Father</option><option>Mother</option><option>Guardian</option></select></label>
 <label>Phone / WhatsApp<input name="phone" type="tel" maxLength={30} required autoComplete="tel"/></label><label>Email (optional)<input name="email" type="email" maxLength={160} autoComplete="email"/></label>
 <label className="public-form-wide">Home address<textarea name="address" maxLength={400} required rows={2} autoComplete="street-address"/></label>
 <label>Previous school (optional)<input name="previousSchool" maxLength={160}/></label><label>Student photo (optional)<input name="photo" type="file" accept="image/jpeg,image/png" onChange={e=>{const f=e.target.files?.[0];if(f&&f.size>5*1024*1024){setError('Photo must be 5 MB or smaller.');e.target.value='';setPreview('');return}setError('');setPreview(f?URL.createObjectURL(f):'')}}/><small>JPEG or PNG, up to 5 MB. Visible only to authorised school staff.</small></label>
 {preview&&<img src={preview} alt="Selected student photo preview" className="h-28 w-28 rounded-lg object-cover"/>}
 <label className="public-form-wide">Additional information (optional)<textarea name="notes" rows={2} maxLength={600}/></label>
 </div><input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true"/>
 <label className="public-form-consent"><input name="consent" type="checkbox" required/>I am the parent or guardian, confirm these details are accurate, and agree that the school may use this information and photo to process this application and contact me.</label>
 <button type="submit" disabled={!id||!options.campuses.length}>{busy?'Submitting…':'Submit admission application'}</button></fieldset></>}
 </form>
}
