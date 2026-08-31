"use client";
import type { AccessData } from "./AccessControlPanel";
import type { ConfigurationData } from "./ConfigurationPanel";
import type { SecurityData } from "./SecurityPanel";
import type { StudentDirectoryData } from "./StudentDirectoryPanel";

export default function HomeDashboardPanel({schoolName,userName,accessData,configurationData,securityData,studentData,onNavigate}:{schoolName:string;userName:string;accessData:AccessData|null;configurationData:ConfigurationData|null;securityData:SecurityData|null;studentData:StudentDirectoryData|null;onNavigate:(view:string)=>void}){
  const first=userName.split(/\s+/)[0]||"Administrator",currentYear=configurationData?.academicYears.find(y=>y.is_current);
  const cards=[
    ["🎓","Current students",studentData?.summary.active??0,"Student records","Students"],
    ["🏫","School campuses",configurationData?.campuses.filter(c=>c.status==="active").length??0,"Active locations","Configuration"],
    ["👥","Users & staff",accessData?.users.filter(u=>u.status==="active").length??0,"Active accounts","Access Control"],
    ["📅","Academic year",currentYear?.name??"Not set",currentYear?`${currentYear.starts_on} – ${currentYear.ends_on}`:"Configuration required","Configuration"],
  ] as const;
  const campusCounts=(studentData?.campuses??[]).map((campus,index)=>({name:campus.name,count:studentData?.students.filter(s=>s.campus_name===campus.name).length??0,color:["purple","green","yellow","coral"][index%4]}));
  const total=Math.max(1,campusCounts.reduce((sum,c)=>sum+c.count,0));
  return <div className="home-dashboard">
    <div className="home-welcome"><div><span className="eyebrow">SCHOOL MANAGEMENT OVERVIEW</span><h1>Good morning, {first}! 👋</h1><p>Here’s what’s happening at {schoolName} today.</p></div><button onClick={()=>onNavigate("Students")}>＋ Add student</button></div>
    <div className="home-metrics">{cards.map(([icon,label,value,detail,view],index)=><button key={label} onClick={()=>onNavigate(view)}><span className={`metric-icon tone-${index}`}>{icon}</span><small>{label}</small><strong>{value}</strong><em>{detail}</em><i>•••</i></button>)}</div>
    <div className="home-grid">
      <section className="home-panel enrollment-panel"><header><div><h2>Campus overview</h2><p>Current students across active campuses</p></div><button onClick={()=>onNavigate("Students")}>View directory</button></header>{campusCounts.length?<div className="campus-overview"><div className="donut" style={{background:`conic-gradient(#7658e8 0 42%,#40b780 42% 70%,#f2b834 70% 86%,#ef7774 86% 100%)`}}><span><strong>{studentData?.summary.active??0}</strong><small>Students</small></span></div><div className="campus-legend">{campusCounts.map(c=><div key={c.name}><span className={c.color}/><strong>{c.name}</strong><b>{c.count}</b><small>{Math.round(c.count/total*100)}%</small></div>)}</div></div>:<div className="dashboard-empty">No campus data available.</div>}</section>
      <section className="home-panel activity-panel"><header><div><h2>Recent activity</h2><p>Latest protected operations</p></div><button onClick={()=>onNavigate("Security & Audit")}>View all</button></header><div className="activity-list">{securityData?.logs.slice(0,5).map((log,index)=><article key={log.id}><span className={`activity-icon tone-${index%4}`}>{log.action.includes("student")?"🎓":log.action.includes("campus")?"🏫":log.action.includes("user")?"👤":"🛡️"}</span><div><strong>{log.action.replaceAll("."," ")}</strong><small>{log.actor_name??"System"} · {log.campus_name??"School-wide"}</small></div><time>{new Date(log.created_at).toLocaleDateString()}</time></article>)}{!securityData?.logs.length&&<div className="dashboard-empty">Activity will appear here as your team uses the system.</div>}</div></section>
      <section className="home-panel progress-panel"><header><div><h2>Foundation progress</h2><p>Your SMS implementation roadmap</p></div><span>Phase 1A</span></header><div className="progress-cards"><article><span>🛡️</span><div><strong>Secure foundation</strong><small>Authentication, RBAC, audit and backup</small><i><b style={{width:"100%"}}/></i></div><em>100%</em></article><article><span>🎓</span><div><strong>Student Information System</strong><small>Directory foundation is now active</small><i><b style={{width:"18%"}}/></i></div><em>18%</em></article></div></section>
      <aside className="home-tip"><span>💡</span><div><strong>Smart setup tip</strong><p>{currentYear?"Your current academic year is ready. Add classes before assigning new students.":"Set the current academic year before assigning students to classes."}</p></div><button onClick={()=>onNavigate("Configuration")}>Configure</button></aside>
    </div>
  </div>;
}
