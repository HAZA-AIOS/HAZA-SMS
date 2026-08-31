import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin, safeMetadata } from "../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=160)=>typeof value==="string"?value.trim().slice(0,length):"";
const validDate=(value:string)=>!value||/^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(request:Request){
  const auth=await authorize("admissions.view");
  if(!auth)return Response.json({error:"You do not have permission to view admissions."},{status:403});
  const url=new URL(request.url),status=clean(url.searchParams.get("status"),30),requestedCampusId=clean(url.searchParams.get("campusId")),campusId=requestedCampusId||(!auth.organizationWide?auth.activeCampusId??"":""),search=clean(url.searchParams.get("search"),80);
  if(campusId){const denied=await requireCampusAccess(auth,campusId,"admissions.list");if(denied)return denied;const campus=await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2").bind(campusId,auth.organizationId).first();if(!campus)return Response.json({error:"Campus not found."},{status:404});}
  const [enquiries,applications,summary]=await Promise.all([
    env.DB.prepare(`SELECT e.id,e.enquiry_number,e.child_first_name,e.child_last_name,e.guardian_name,e.primary_phone,e.source,e.status,e.priority,e.next_follow_up_on,e.created_at,c.name campus_name,cl.name class_name FROM admission_enquiries e JOIN campuses c ON c.id=e.campus_id LEFT JOIN classes cl ON cl.id=e.applying_class_id WHERE e.organization_id=?1 AND (?2='' OR e.status=?2) AND (?3='' OR e.campus_id=?3) AND (?4='' OR e.child_first_name LIKE '%'||?4||'%' OR coalesce(e.child_last_name,'') LIKE '%'||?4||'%' OR e.guardian_name LIKE '%'||?4||'%' OR e.primary_phone LIKE '%'||?4||'%' OR e.enquiry_number LIKE '%'||?4||'%') ORDER BY e.created_at DESC LIMIT 100`).bind(auth.organizationId,status,campusId,search).all(),
    env.DB.prepare(`SELECT a.id,a.application_number,a.enquiry_id,a.child_first_name,a.child_last_name,a.guardian_name,a.primary_phone,a.status,a.submitted_on,a.created_at,c.name campus_name,cl.name class_name FROM admission_applications a JOIN campuses c ON c.id=a.campus_id LEFT JOIN classes cl ON cl.id=a.applying_class_id WHERE a.organization_id=?1 AND (?2='' OR a.campus_id=?2) ORDER BY a.created_at DESC LIMIT 50`).bind(auth.organizationId,campusId).all(),
    env.DB.prepare(`SELECT count(*) total,sum(CASE WHEN status='new' THEN 1 ELSE 0 END) new_count,sum(CASE WHEN status='contacted' THEN 1 ELSE 0 END) contacted_count,sum(CASE WHEN status='application_started' THEN 1 ELSE 0 END) converted_count,sum(CASE WHEN next_follow_up_on IS NOT NULL AND next_follow_up_on<=date('now') AND status NOT IN ('closed','application_started') THEN 1 ELSE 0 END) followups_due FROM admission_enquiries WHERE organization_id=?1 AND (?2='' OR campus_id=?2)`).bind(auth.organizationId,campusId).first(),
  ]);
  return Response.json({enquiries:enquiries.results,applications:applications.results,summary});
}

export async function POST(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("admissions.create");if(!auth)return Response.json({error:"You do not have permission to create admission enquiries."},{status:403});
  if(!await enforceRateLimit(auth,"admission.enquiry.create",40,300))return Response.json({error:"Admission enquiry limit reached. Try again later."},{status:429});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const campusId=clean(body?.campusId),childFirstName=clean(body?.childFirstName,80),childLastName=clean(body?.childLastName,80),dateOfBirth=clean(body?.dateOfBirth,10),gender=clean(body?.gender,20),applyingClassId=clean(body?.applyingClassId),academicYearId=clean(body?.academicYearId),guardianName=clean(body?.guardianName,120),relationship=clean(body?.relationship,40),primaryPhone=clean(body?.primaryPhone,30),email=clean(body?.email,160).toLowerCase(),source=clean(body?.source,40),priority=clean(body?.priority,20)||"normal",nextFollowUpOn=clean(body?.nextFollowUpOn,10),notes=clean(body?.notes,1200);
  if(!campusId||!childFirstName||!guardianName||!primaryPhone||!validDate(dateOfBirth)||!validDate(nextFollowUpOn)||!(["","male","female","other"].includes(gender))||!(["normal","high","urgent"].includes(priority))||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:"Enter valid child, guardian and follow-up information."},{status:400});
  const campus=await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2 AND status='active'").bind(campusId,auth.organizationId).first();if(!campus)return Response.json({error:"Select a valid campus."},{status:400});
  const denied=await requireCampusAccess(auth,campusId,"admission.enquiry.create");if(denied)return denied;
  if(applyingClassId){const row=await env.DB.prepare("SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'").bind(applyingClassId,auth.organizationId,campusId).first();if(!row)return Response.json({error:"Select a valid class."},{status:400});}
  if(academicYearId){const row=await env.DB.prepare("SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2").bind(academicYearId,auth.organizationId).first();if(!row)return Response.json({error:"Select a valid academic year."},{status:400});}
  const id=crypto.randomUUID(),enquiryNumber=`ENQ-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${id.slice(0,6).toUpperCase()}`;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO admission_enquiries (id,organization_id,campus_id,enquiry_number,child_first_name,child_last_name,date_of_birth,gender,applying_class_id,desired_academic_year_id,guardian_name,relationship,primary_phone,email,source,status,priority,next_follow_up_on,notes,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,'new',?16,?17,?18,?19)").bind(id,auth.organizationId,campusId,enquiryNumber,childFirstName,childLastName||null,dateOfBirth||null,gender||null,applyingClassId||null,academicYearId||null,guardianName,relationship||null,primaryPhone,email||null,source||null,priority,nextFollowUpOn||null,notes||null,auth.userId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'admission.enquiry.create','admission_enquiry',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,campusId,auth.userId,id,safeMetadata({enquiryNumber})),
  ]);
  return Response.json({ok:true,id,enquiryNumber});
}

export async function PATCH(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null,id=clean(body?.id),action=clean(body?.action,30);
  const auth=await authorize(action==="convert"?"admissions.convert":"admissions.edit");if(!auth)return Response.json({error:"You do not have permission to update admissions."},{status:403});
  const enquiry=await env.DB.prepare("SELECT * FROM admission_enquiries WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId).first<Record<string,unknown>>();if(!enquiry)return Response.json({error:"Admission enquiry not found."},{status:404});
  const denied=await requireCampusAccess(auth,String(enquiry.campus_id??""),`admission.enquiry.${action}`);if(denied)return denied;
  if(action==="convert"){
    const existing=await env.DB.prepare("SELECT id FROM admission_applications WHERE enquiry_id=?1 AND organization_id=?2").bind(id,auth.organizationId).first();if(existing)return Response.json({error:"This enquiry already has an application."},{status:409});
    const applicationId=crypto.randomUUID(),applicationNumber=`APP-${new Date().toISOString().slice(2,10).replaceAll("-","")}-${applicationId.slice(0,6).toUpperCase()}`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO admission_applications (id,organization_id,campus_id,enquiry_id,application_number,child_first_name,child_last_name,date_of_birth,gender,applying_class_id,academic_year_id,guardian_name,primary_phone,email,status,submitted_on,notes,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,'draft',NULL,?15,?16)").bind(applicationId,auth.organizationId,enquiry.campus_id,id,applicationNumber,enquiry.child_first_name,enquiry.child_last_name,enquiry.date_of_birth,enquiry.gender,enquiry.applying_class_id,enquiry.desired_academic_year_id,enquiry.guardian_name,enquiry.primary_phone,enquiry.email,enquiry.notes,auth.userId),
      env.DB.prepare("UPDATE admission_enquiries SET status='application_started',updated_at=unixepoch()*1000 WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'admission.enquiry.convert','admission_application',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,enquiry.campus_id,auth.userId,applicationId,safeMetadata({enquiryId:id,applicationNumber})),
    ]);
    return Response.json({ok:true,applicationId,applicationNumber});
  }
  const status=clean(body?.status,30),nextFollowUpOn=clean(body?.nextFollowUpOn,10),notes=clean(body?.notes,1200);
  if(!["new","contacted","visit_scheduled","not_interested","closed"].includes(status)||!validDate(nextFollowUpOn))return Response.json({error:"Select a valid enquiry status and follow-up date."},{status:400});
  await env.DB.batch([
    env.DB.prepare("UPDATE admission_enquiries SET status=?1,next_follow_up_on=?2,notes=?3,updated_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5").bind(status,nextFollowUpOn||null,notes||null,id,auth.organizationId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'admission.enquiry.update','admission_enquiry',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,enquiry.campus_id,auth.userId,id,safeMetadata({status,nextFollowUpOn})),
  ]);
  return Response.json({ok:true});
}
