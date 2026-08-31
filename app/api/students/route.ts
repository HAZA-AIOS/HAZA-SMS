import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=120)=>typeof value==="string"?value.trim().slice(0,length):"";

export async function GET(request:Request){
  const auth=await authorize("students.view");if(!auth)return Response.json({error:"You do not have permission to view students."},{status:403});
  const url=new URL(request.url),search=clean(url.searchParams.get("search"),80),requestedCampusId=clean(url.searchParams.get("campusId")),campusId=requestedCampusId||(!auth.organizationWide?auth.activeCampusId??"":""),classId=clean(url.searchParams.get("classId")),status=clean(url.searchParams.get("status"),20),gender=clean(url.searchParams.get("gender"),20);
  const page=Math.max(1,Math.min(10000,Number(url.searchParams.get("page"))||1)),pageSize=25,offset=(page-1)*pageSize;
  if(campusId){const denied=await requireCampusAccess(auth,campusId,"students.list");if(denied)return denied;const campus=await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2").bind(campusId,auth.organizationId).first();if(!campus)return Response.json({error:"Campus not found."},{status:404});}
  if(classId){const schoolClass=await env.DB.prepare("SELECT id FROM classes WHERE id=?1 AND organization_id=?2").bind(classId,auth.organizationId).first();if(!schoolClass)return Response.json({error:"Class not found."},{status:404});}
  const where=`s.organization_id=?1 AND (?2='' OR s.first_name LIKE '%'||?2||'%' OR coalesce(s.last_name,'') LIKE '%'||?2||'%' OR s.admission_number LIKE '%'||?2||'%') AND (?3='' OR s.home_campus_id=?3) AND (?4='' OR e.class_id=?4) AND (?5='' OR s.enrollment_status=?5) AND (?6='' OR s.gender=?6)`;
  const [rows,total]=await Promise.all([
    env.DB.prepare(`SELECT s.id,s.admission_number,s.first_name,s.last_name,s.preferred_name,s.gender,s.date_of_birth,s.enrollment_status,s.admitted_on,c.name campus_name,cl.name class_name,se.name section_name FROM students s JOIN campuses c ON c.id=s.home_campus_id LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='active' AND e.academic_year_id=(SELECT id FROM academic_years WHERE organization_id=?1 AND is_current=1 LIMIT 1) LEFT JOIN classes cl ON cl.id=e.class_id LEFT JOIN sections se ON se.id=e.section_id WHERE ${where} ORDER BY s.first_name,s.last_name LIMIT ?7 OFFSET ?8`).bind(auth.organizationId,search,campusId,classId,status,gender,pageSize,offset).all(),
    env.DB.prepare(`SELECT count(DISTINCT s.id) value FROM students s LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='active' AND e.academic_year_id=(SELECT id FROM academic_years WHERE organization_id=?1 AND is_current=1 LIMIT 1) WHERE ${where}`).bind(auth.organizationId,search,campusId,classId,status,gender).first<{value:number}>(),
  ]);
  return Response.json({students:rows.results,total:total?.value??0,page,pageSize});
}

export async function POST(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("students.create");if(!auth)return Response.json({error:"You do not have permission to add students."},{status:403});
  if(!await enforceRateLimit(auth,"student.create",30,300))return Response.json({error:"Student creation limit reached. Try again later."},{status:429});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const firstName=clean(body?.firstName,80),lastName=clean(body?.lastName,80),campusId=clean(body?.campusId),gender=clean(body?.gender,20),dateOfBirth=clean(body?.dateOfBirth,10),admittedOn=clean(body?.admittedOn,10),classId=clean(body?.classId),sectionId=clean(body?.sectionId);
  let admissionNumber=clean(body?.admissionNumber,40).toUpperCase();
  if(!firstName||!campusId||!(["","male","female","other"].includes(gender))||dateOfBirth&&!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth))return Response.json({error:"Enter valid student information."},{status:400});
  const campus=await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2 AND status='active'").bind(campusId,auth.organizationId).first();if(!campus)return Response.json({error:"Select a valid campus."},{status:400});
  const denied=await requireCampusAccess(auth,campusId,"student.create");if(denied)return denied;
  if(classId){const schoolClass=await env.DB.prepare("SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'").bind(classId,auth.organizationId,campusId).first();if(!schoolClass)return Response.json({error:"Select a valid class."},{status:400});}
  if(sectionId){const section=await env.DB.prepare("SELECT id FROM sections WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND class_id=?4 AND status='active'").bind(sectionId,auth.organizationId,campusId,classId).first();if(!section)return Response.json({error:"Select a valid section."},{status:400});}
  if(!admissionNumber)admissionNumber=`TMS-${Date.now().toString(36).toUpperCase()}`;
  const id=crypto.randomUUID(),statements=[
    env.DB.prepare("INSERT INTO students (id,organization_id,home_campus_id,admission_number,first_name,last_name,gender,date_of_birth,enrollment_status,admitted_on) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'active',?9)").bind(id,auth.organizationId,campusId,admissionNumber,firstName,lastName||null,gender||null,dateOfBirth||null,admittedOn||null),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'student.create','student',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,campusId,auth.userId,id,JSON.stringify({admissionNumber})),
  ];
  if(classId){const year=await env.DB.prepare("SELECT id FROM academic_years WHERE organization_id=?1 AND is_current=1 LIMIT 1").bind(auth.organizationId).first<{id:string}>();if(!year)return Response.json({error:"Set a current academic year before assigning a class."},{status:400});statements.push(env.DB.prepare("INSERT INTO enrollments (id,organization_id,student_id,academic_year_id,campus_id,class_id,section_id,status,enrolled_on) VALUES (?1,?2,?3,?4,?5,?6,?7,'active',?8)").bind(crypto.randomUUID(),auth.organizationId,id,year.id,campusId,classId,sectionId||null,admittedOn||new Date().toISOString().slice(0,10)));}
  try{await env.DB.batch(statements);return Response.json({ok:true,id,admissionNumber});}catch{return Response.json({error:"Admission number already exists or the student could not be saved."},{status:409});}
}

export async function PATCH(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null,studentId=clean(body?.studentId),action=clean(body?.action,20);
  const permission=action==="restore"?"students.restore":"students.archive",auth=await authorize(permission);if(!auth)return Response.json({error:"You do not have permission to change student status."},{status:403});
  if(!["archive","restore"].includes(action))return Response.json({error:"Invalid student action."},{status:400});
  const student=await env.DB.prepare("SELECT id,home_campus_id FROM students WHERE id=?1 AND organization_id=?2").bind(studentId,auth.organizationId).first<{id:string;home_campus_id:string}>();if(!student)return Response.json({error:"Student not found."},{status:404});
  const denied=await requireCampusAccess(auth,student.home_campus_id,`student.${action}`);if(denied)return denied;
  const status=action==="archive"?"archived":"active";
  await env.DB.batch([
    env.DB.prepare("UPDATE students SET enrollment_status=?1,archived_at=?2,archived_by=?3,updated_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5").bind(status,action==="archive"?Date.now():null,action==="archive"?auth.userId:null,studentId,auth.organizationId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,?5,'student',?6,'success')").bind(crypto.randomUUID(),auth.organizationId,student.home_campus_id,auth.userId,`student.${action}`,studentId),
  ]);
  return Response.json({ok:true});
}
