"use client";
import { FormEvent, useState } from "react";

export type AccessData={
  users:{id:string;name:string;email:string;status:string;roles:string|null}[];
  roles:{id:string;name:string;scope:string;is_system:number;permission_count:number}[];
  permissions:{code:string;module:string;action:string;sensitive:number}[];
  campuses:{id:string;name:string}[];
};

export default function AccessControlPanel({data}: {data:AccessData}){
  const [tab,setTab]=useState<"users"|"roles"|"permissions">("users");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function submit(url:string,event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    const payload=Object.fromEntries(new FormData(event.currentTarget).entries());
    const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json().catch(()=>({error:"Request failed."}));
    if(!response.ok){setMessage(result.error??"Request failed.");setBusy(false);return;}
    window.location.reload();
  }
  return <div className="access-page">
    <div className="access-heading"><div><span className="eyebrow">PHASE 0C · ACCESS CONTROL</span><h1>Users, Roles & Permissions</h1><p>Organization-scoped access enforced by the server on every protected operation.</p></div><span className="phase-badge complete">0C Active</span></div>
    <div className="access-stats"><article><span>👥</span><strong>{data.users.length}</strong><small>Users</small></article><article><span>🛡️</span><strong>{data.roles.length}</strong><small>Roles</small></article><article><span>🔑</span><strong>{data.permissions.length}</strong><small>Permissions</small></article><article><span>🏢</span><strong>{data.campuses.length}</strong><small>Campuses</small></article></div>
    <div className="access-tabs" role="tablist"><button className={tab==="users"?"active":""} onClick={()=>setTab("users")}>Users</button><button className={tab==="roles"?"active":""} onClick={()=>setTab("roles")}>Roles</button><button className={tab==="permissions"?"active":""} onClick={()=>setTab("permissions")}>Permissions</button></div>
    {message&&<p className="access-message">{message}</p>}
    {tab==="users"&&<div className="access-layout">
      <section className="access-card wide"><div className="card-title"><div><h2>Organization users</h2><p>Invited users activate automatically after verified sign-in.</p></div></div>
        <div className="access-table"><div className="table-row table-head"><span>User</span><span>Role</span><span>Status</span></div>{data.users.map(u=><div className="table-row" key={u.id}><span><strong>{u.name}</strong><small>{u.email}</small></span><span>{u.roles||"No role"}</span><span><i className={`status-dot ${u.status}`}/>{u.status}</span></div>)}</div>
      </section>
      <form className="access-card invite-form" onSubmit={e=>submit("/api/access/users",e)}><div className="card-title"><h2>Invite user</h2><p>Assign the initial role and campus scope.</p></div>
        <label>Full name<input name="displayName" required /></label><label>Email<input name="email" required type="email" /></label>
        <label>Role<select name="roleId" required defaultValue=""><option value="" disabled>Select role</option>{data.roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label>Campus scope<select name="campusId" defaultValue=""><option value="">All permitted campuses</option>{data.campuses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <button disabled={busy}>{busy?"Sending…":"Create invitation"}</button>
      </form>
    </div>}
    {tab==="roles"&&<div className="access-layout">
      <section className="access-card wide role-list"><div className="card-title"><h2>Available roles</h2><p>System roles can be extended with organization-specific roles.</p></div>{data.roles.map(r=><article key={r.id}><span>🛡️</span><div><strong>{r.name}</strong><small>{r.scope} scope · {r.permission_count} permissions</small></div><b>{r.is_system?"System":"Custom"}</b></article>)}</section>
      <form className="access-card invite-form" onSubmit={e=>submit("/api/access/roles",e)}><div className="card-title"><h2>Create custom role</h2><p>Select its scope and initial permission.</p></div>
        <label>Role name<input name="name" required placeholder="Academic Coordinator" /></label>
        <label>Scope<select name="scope" defaultValue="organization"><option value="organization">Organization</option><option value="campus">Campus</option><option value="class">Class</option><option value="self">Self</option></select></label>
        <label>Initial permission<select name="permissionCode" required defaultValue=""><option value="" disabled>Select permission</option>{data.permissions.map(p=><option key={p.code} value={p.code}>{p.code}</option>)}</select></label>
        <button disabled={busy}>{busy?"Creating…":"Create role"}</button>
      </form>
    </div>}
    {tab==="permissions"&&<section className="access-card permission-grid"><div className="card-title"><h2>Permission catalogue</h2><p>These codes are checked by protected server endpoints—not only by the sidebar.</p></div><div>{data.permissions.map(p=><article key={p.code}><span>🔑</span><div><strong>{p.code}</strong><small>{p.module} · {p.action}</small></div>{p.sensitive?<b>Sensitive</b>:null}</article>)}</div></section>}
  </div>;
}
