import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=300)=>typeof value==="string"?value.trim().slice(0,length):"";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("enrollments.manage");if(!auth)return Response.json({error:"You do not have permission to manage enrollment history."},{status:403});if(!await enforceRateLimit(auth,"enrollment.change",40,300))return Response.json({error:"Enrollment change limit reached."},{status:429});
  const {id:studentId}=await params,body=await request.json().catch(()=>null) as Record<string,unknown>|null,action=clean(body?.action,20),effectiveOn=clean(body?.effectiveOn,10)||new Date().toISOString().slice(0,10),reason=clean(body?.reason),notes=clean(body?.notes,1000);
  if(!body||!["place","promote","transfer","withdraw","graduate"].includes(action)||!/^\d{4}-\d{2}-\d{2}$/.test(effectiveOn))return Response.json({error:"Enter a valid enrollment action and date."},{status:400});
  const student=await env.DB.prepare("SELECT id,home_campus_id,enrollment_status FROM students WHERE id=?1 AND organization_id=?2").bind(studentId,auth.organizationId).first<{id:string;home_campus_id:string;enrollment_status:string}>();if(!student)return Response.json({error:"Student not found."},{status:404});
  const currentDenied=await requireCampusAccess(auth,student.home_campus_id,"student.enrollment.manage");if(currentDenied)return currentDenied;
  const current=await env.DB.prepare("SELECT id,academic_year_id,campus_id,class_id,section_id FROM enrollments WHERE student_id=?1 AND organization_id=?2 AND status='active' ORDER BY created_at DESC LIMIT 1").bind(studentId,auth.organizationId).first<{id:string;academic_year_id:string;campus_id:string;class_id:string|null;section_id:string|null}>();
  const statements=[],eventId=crypto.randomUUID();let enrollmentId=current?.id??null,toCampusId:string|null=null,toClassId:string|null=null;
  if(action==="withdraw"||action==="graduate"){
    if(!current)return Response.json({error:"The student has no active enrollment to close."},{status:409});const newStatus=action==="graduate"?"graduated":"withdrawn";statements.push(env.DB.prepare("UPDATE enrollments SET status=?1,ended_on=?2,updated_at=unixepoch()*1000 WHERE id=?3 AND organization_id=?4").bind(newStatus,effectiveOn,current.id,auth.organizationId),env.DB.prepare("UPDATE students SET enrollment_status=?1,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(newStatus,studentId,auth.organizationId));
  }else{
    const academicYearId=clean(body.academicYearId),campusId=clean(body.campusId),classId=clean(body.classId),sectionId=clean(body.sectionId),rollNumber=clean(body.rollNumber,40);if(!academicYearId||!campusId||!classId)return Response.json({error:"Select an academic year, campus and class."},{status:400});
    const [year,campus,schoolClass]=await Promise.all([env.DB.prepare("SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2").bind(academicYearId,auth.organizationId).first(),env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2 AND status='active'").bind(campusId,auth.organizationId).first(),env.DB.prepare("SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'").bind(classId,auth.organizationId,campusId).first()]);if(!year||!campus||!schoolClass)return Response.json({error:"Select valid school enrollment values."},{status:400});
    const targetDenied=await requireCampusAccess(auth,campusId,"student.enrollment.target");if(targetDenied)return targetDenied;
    if(sectionId){const section=await env.DB.prepare("SELECT id FROM sections WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND class_id=?4 AND status='active'").bind(sectionId,auth.organizationId,campusId,classId).first();if(!section)return Response.json({error:"Select a valid section."},{status:400});}
    toCampusId=campusId;toClassId=classId;
    if(action==="transfer"){
      if(!current)return Response.json({error:"The student has no active enrollment to transfer."},{status:409});enrollmentId=current.id;statements.push(env.DB.prepare("UPDATE enrollments SET campus_id=?1,class_id=?2,section_id=?3,roll_number=?4,updated_at=unixepoch()*1000 WHERE id=?5 AND organization_id=?6").bind(campusId,classId,sectionId||null,rollNumber||null,current.id,auth.organizationId));
    }else{
      if(current)statements.push(env.DB.prepare("UPDATE enrollments SET status='completed',ended_on=?1,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(effectiveOn,current.id,auth.organizationId));enrollmentId=crypto.randomUUID();statements.push(env.DB.prepare("INSERT INTO enrollments (id,organization_id,student_id,academic_year_id,campus_id,class_id,section_id,roll_number,status,enrolled_on) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'active',?9)").bind(enrollmentId,auth.organizationId,studentId,academicYearId,campusId,classId,sectionId||null,rollNumber||null,effectiveOn));
    }
    statements.push(env.DB.prepare("UPDATE students SET home_campus_id=?1,enrollment_status='active',updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(campusId,studentId,auth.organizationId));
  }
  statements.push(env.DB.prepare("INSERT INTO enrollment_events (id,organization_id,student_id,enrollment_id,event_type,from_campus_id,to_campus_id,from_class_id,to_class_id,effective_on,reason,notes,performed_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)").bind(eventId,auth.organizationId,studentId,enrollmentId,action,current?.campus_id??null,toCampusId,current?.class_id??null,toClassId,effectiveOn,reason||null,notes||null,auth.userId),env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,?5,'student',?6,'success',?7)").bind(crypto.randomUUID(),auth.organizationId,toCampusId??current?.campus_id??student.home_campus_id,auth.userId,`student.enrollment.${action}`,studentId,JSON.stringify({eventId,enrollmentId})));
  try{await env.DB.batch(statements);return Response.json({ok:true,eventId});}catch{return Response.json({error:"Enrollment could not be updated. Check for an existing record in the selected academic year."},{status:409});}
}
