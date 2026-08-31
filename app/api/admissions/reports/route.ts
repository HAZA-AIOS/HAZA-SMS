import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { safeMetadata } from "../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:string|null,length=80)=>(value??"").trim().slice(0,length);
const statuses=["draft","submitted","approved","rejected","enrolled"];
const csvCell=(value:unknown)=>`"${String(value??"").replaceAll('"','""')}"`;

export async function GET(request:Request){
  const url=new URL(request.url),format=clean(url.searchParams.get("format"),10);
  const auth=await authorize(format==="csv"?"admissions.export":"admissions.report");
  if(!auth)return Response.json({error:"You do not have permission to access admission reports."},{status:403});
  const campusId=clean(url.searchParams.get("campusId")),academicYearId=clean(url.searchParams.get("academicYearId")),status=clean(url.searchParams.get("status"),20),from=clean(url.searchParams.get("from"),10),to=clean(url.searchParams.get("to"),10);
  if(status&&!statuses.includes(status))return Response.json({error:"Select a valid application status."},{status:400});
  if(campusId&&!await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2").bind(campusId,auth.organizationId).first())return Response.json({error:"Campus not found."},{status:404});
  const where=`a.organization_id=?1 AND (?2='' OR a.campus_id=?2) AND (?3='' OR a.academic_year_id=?3) AND (?4='' OR a.status=?4) AND (?5='' OR date(COALESCE(a.submitted_on,datetime(a.created_at/1000,'unixepoch')))>=?5) AND (?6='' OR date(COALESCE(a.submitted_on,datetime(a.created_at/1000,'unixepoch')))<=?6)`;
  const bind=[auth.organizationId,campusId,academicYearId,status,from,to] as const;
  const applications=await env.DB.prepare(`SELECT a.application_number,a.child_first_name,a.child_last_name,a.guardian_name,a.primary_phone,a.status,a.submitted_on,a.created_at,c.name campus_name,cl.name class_name,y.name academic_year_name,p.name fee_package_name,f.discount_amount,s.admission_number FROM admission_applications a JOIN campuses c ON c.id=a.campus_id LEFT JOIN classes cl ON cl.id=a.applying_class_id LEFT JOIN academic_years y ON y.id=a.academic_year_id LEFT JOIN application_fee_assignments f ON f.application_id=a.id LEFT JOIN admission_fee_packages p ON p.id=f.fee_package_id LEFT JOIN students s ON s.id=a.student_id WHERE ${where} ORDER BY a.created_at DESC LIMIT 500`).bind(...bind).all<Record<string,unknown>>();
  if(format==="csv"){
    const headers=["Application No","Student","Guardian","Phone","Campus","Class","Academic Year","Status","Submitted","Fee Package","Discount","Admission No"];
    const lines=[headers.map(csvCell).join(","),...applications.results.map(v=>[v.application_number,`${v.child_first_name} ${v.child_last_name??""}`.trim(),v.guardian_name,v.primary_phone,v.campus_name,v.class_name,v.academic_year_name,v.status,v.submitted_on,v.fee_package_name,v.discount_amount,v.admission_number].map(csvCell).join(","))];
    await env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,outcome,metadata_json) VALUES (?1,?2,?3,'admission.report.export','admission_report','success',?4)").bind(crypto.randomUUID(),auth.organizationId,auth.userId,safeMetadata({campusId,academicYearId,status,from,to,rows:applications.results.length})).run();
    return new Response(lines.join("\r\n"),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="admission-report-${new Date().toISOString().slice(0,10)}.csv"`,"cache-control":"private, no-store"}});
  }
  const [summary,statusesResult,campuses,classes]=await Promise.all([
    env.DB.prepare(`SELECT count(*) total,sum(CASE WHEN a.status='submitted' THEN 1 ELSE 0 END) submitted,sum(CASE WHEN a.status='approved' THEN 1 ELSE 0 END) approved,sum(CASE WHEN a.status='rejected' THEN 1 ELSE 0 END) rejected,sum(CASE WHEN a.status='enrolled' THEN 1 ELSE 0 END) enrolled FROM admission_applications a WHERE ${where}`).bind(...bind).first(),
    env.DB.prepare(`SELECT a.status label,count(*) value FROM admission_applications a WHERE ${where} GROUP BY a.status ORDER BY value DESC`).bind(...bind).all(),
    env.DB.prepare(`SELECT c.name label,count(*) value,sum(CASE WHEN a.status='enrolled' THEN 1 ELSE 0 END) enrolled FROM admission_applications a JOIN campuses c ON c.id=a.campus_id WHERE ${where} GROUP BY c.id,c.name ORDER BY value DESC`).bind(...bind).all(),
    env.DB.prepare(`SELECT COALESCE(cl.name,'Not selected') label,count(*) value,sum(CASE WHEN a.status='enrolled' THEN 1 ELSE 0 END) enrolled FROM admission_applications a LEFT JOIN classes cl ON cl.id=a.applying_class_id WHERE ${where} GROUP BY cl.id,cl.name ORDER BY value DESC LIMIT 12`).bind(...bind).all(),
  ]);
  return Response.json({summary:summary??{},statuses:statusesResult.results,campuses:campuses.results,classes:classes.results,applications:applications.results},{headers:{"cache-control":"private, no-store"}});
}
