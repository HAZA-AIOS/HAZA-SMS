import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin, safeMetadata } from "../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=300)=>typeof value==="string"?value.trim().slice(0,length):"";
const statuses=new Set(["present","absent","late","leave","half_day"]);
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
type AttendanceInput={studentId?:unknown;enrollmentId?:unknown;status?:unknown;remarks?:unknown};

async function permittedClasses(auth:NonNullable<Awaited<ReturnType<typeof authorize>>>,academicYearId:string,campusId:string){
  if(auth.organizationWide&&auth.permissions.has("student_attendance.correct"))return null;
  const staffMember=await env.DB.prepare("SELECT id FROM staff WHERE organization_id=?1 AND campus_id=?2 AND lower(email)=lower(?3) AND status='active' LIMIT 1").bind(auth.organizationId,campusId,auth.email).first<{id:string}>();
  if(!staffMember)return new Set<string>();
  const assigned=await env.DB.prepare("SELECT class_id,section_id FROM class_teacher_assignments WHERE organization_id=?1 AND academic_year_id=?2 AND campus_id=?3 AND staff_id=?4 AND status='active'").bind(auth.organizationId,academicYearId,campusId,staffMember.id).all<{class_id:string;section_id:string|null}>();
  return new Set(assigned.results.map(row=>`${row.class_id}:${row.section_id||"all"}`));
}

function classAllowed(allowed:Set<string>|null,classId:string,sectionId:string){return allowed===null||allowed.has(`${classId}:all`)||allowed.has(`${classId}:${sectionId||"all"}`);}

export async function GET(request:Request){
  const auth=await authorize("student_attendance.view");if(!auth)return Response.json({error:"You do not have permission to view student attendance."},{status:403});
  const url=new URL(request.url),date=clean(url.searchParams.get("date"),10),campusId=clean(url.searchParams.get("campusId"))||auth.activeCampusId||"",academicYearId=clean(url.searchParams.get("academicYearId")),classId=clean(url.searchParams.get("classId")),sectionId=clean(url.searchParams.get("sectionId")),studentId=clean(url.searchParams.get("studentId"));
  if(campusId){const denied=await requireCampusAccess(auth,campusId,"student.attendance.view");if(denied)return denied;}
  const [years,campuses,classes,sections,recent]=await Promise.all([
    env.DB.prepare("SELECT id,name,is_current,starts_on,ends_on FROM academic_years WHERE organization_id=?1 AND status!='archived' ORDER BY is_current DESC,starts_on DESC").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' AND (?2='' OR id=?2) ORDER BY is_main DESC,name").bind(auth.organizationId,campusId).all(),
    env.DB.prepare("SELECT id,name,code,campus_id,academic_year_id FROM classes WHERE organization_id=?1 AND status='active' AND (?2='' OR campus_id IS NULL OR campus_id=?2) ORDER BY sort_order,name").bind(auth.organizationId,campusId).all(),
    env.DB.prepare("SELECT id,name,class_id,campus_id FROM sections WHERE organization_id=?1 AND status='active' AND (?2='' OR campus_id=?2) ORDER BY name").bind(auth.organizationId,campusId).all(),
    env.DB.prepare(`SELECT a.id,a.attendance_date,a.status,a.student_count,a.present_count,a.absent_count,a.late_count,a.leave_count,a.half_day_count,c.name class_name,s.name section_name,cp.name campus_name,u.display_name marked_by_name FROM student_attendance_sessions a JOIN classes c ON c.id=a.class_id LEFT JOIN sections s ON s.id=a.section_id JOIN campuses cp ON cp.id=a.campus_id JOIN users u ON u.id=a.marked_by WHERE a.organization_id=?1 AND (?2='' OR a.campus_id=?2) ORDER BY a.attendance_date DESC,a.created_at DESC LIMIT 25`).bind(auth.organizationId,campusId).all(),
  ]);
  let roster:unknown[]=[],session:unknown=null,history:unknown[]=[];
  if(studentId){
    if(!(auth.organizationWide&&auth.permissions.has("student_attendance.correct"))){
      if(!academicYearId||!campusId)return Response.json({error:"Select an academic year and campus to view student history."},{status:400});
      const enrollment=await env.DB.prepare("SELECT class_id,section_id FROM enrollments WHERE organization_id=?1 AND student_id=?2 AND academic_year_id=?3 AND campus_id=?4 AND status='active'").bind(auth.organizationId,studentId,academicYearId,campusId).first<{class_id:string;section_id:string|null}>(),allowed=await permittedClasses(auth,academicYearId,campusId);
      if(!enrollment||!classAllowed(allowed,enrollment.class_id,enrollment.section_id||""))return Response.json({error:"Teachers may only view attendance history for students in their assigned class or section."},{status:403});
    }
    history=(await env.DB.prepare(`SELECT r.attendance_date,r.status,r.remarks,c.name class_name,se.name section_name,co.reason correction_reason FROM student_attendance_records r JOIN enrollments e ON e.id=r.enrollment_id LEFT JOIN classes c ON c.id=e.class_id LEFT JOIN sections se ON se.id=e.section_id LEFT JOIN student_attendance_corrections co ON co.attendance_record_id=r.id WHERE r.organization_id=?1 AND r.student_id=?2 ORDER BY r.attendance_date DESC,co.created_at DESC LIMIT 120`).bind(auth.organizationId,studentId).all()).results;
  }
  if(date&&academicYearId&&campusId&&classId){
    if(!datePattern.test(date))return Response.json({error:"Select a valid attendance date."},{status:400});
    const allowed=await permittedClasses(auth,academicYearId,campusId);if(!classAllowed(allowed,classId,sectionId))return Response.json({error:"Teachers may only open attendance for their assigned class or section."},{status:403});
    const scopeKey=`${classId}:${sectionId||"all"}`;
    session=await env.DB.prepare("SELECT * FROM student_attendance_sessions WHERE organization_id=?1 AND academic_year_id=?2 AND campus_id=?3 AND scope_key=?4 AND attendance_date=?5").bind(auth.organizationId,academicYearId,campusId,scopeKey,date).first();
    roster=(await env.DB.prepare(`SELECT e.id enrollment_id,s.id student_id,s.admission_number,s.first_name,s.last_name,e.roll_number,COALESCE(r.status,'present') attendance_status,COALESCE(r.remarks,'') remarks,r.id attendance_record_id FROM enrollments e JOIN students s ON s.id=e.student_id AND s.organization_id=e.organization_id LEFT JOIN student_attendance_records r ON r.enrollment_id=e.id AND r.attendance_date=?1 AND r.organization_id=e.organization_id WHERE e.organization_id=?2 AND e.academic_year_id=?3 AND e.campus_id=?4 AND e.class_id=?5 AND (?6='' OR e.section_id=?6) AND e.status='active' AND s.enrollment_status='active' ORDER BY CAST(e.roll_number AS INTEGER),s.first_name,s.last_name`).bind(date,auth.organizationId,academicYearId,campusId,classId,sectionId).all()).results;
  }
  return Response.json({academicYears:years.results,campuses:campuses.results,classes:classes.results,sections:sections.results,recent:recent.results,session,roster,history,canManage:auth.permissions.has("student_attendance.manage"),canCorrect:auth.permissions.has("student_attendance.correct")},{headers:{"cache-control":"private, no-store"}});
}

export async function POST(request:Request){
  const origin=requireSameOrigin(request);if(origin)return origin;
  const auth=await authorize("student_attendance.manage");if(!auth)return Response.json({error:"You do not have permission to mark student attendance."},{status:403});
  if(!await enforceRateLimit(auth,"student.attendance.save",40,300))return Response.json({error:"Attendance save limit reached. Try again later."},{status:429});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null,campusId=clean(body?.campusId),academicYearId=clean(body?.academicYearId),classId=clean(body?.classId),sectionId=clean(body?.sectionId),date=clean(body?.date,10),correctionReason=clean(body?.correctionReason,500),records=Array.isArray(body?.records)?body.records as AttendanceInput[]:[];
  if(!campusId||!academicYearId||!classId||!datePattern.test(date)||!records.length||records.length>300)return Response.json({error:"Select a date, class and at least one student."},{status:400});
  const denied=await requireCampusAccess(auth,campusId,"student.attendance.save");if(denied)return denied;
  const allowed=await permittedClasses(auth,academicYearId,campusId);if(!classAllowed(allowed,classId,sectionId))return Response.json({error:"Teachers may only mark attendance for their assigned class or section."},{status:403});
  const [year,schoolClass,section]=await Promise.all([
    env.DB.prepare("SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2 AND ?3 BETWEEN starts_on AND ends_on").bind(academicYearId,auth.organizationId,date).first(),
    env.DB.prepare("SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'").bind(classId,auth.organizationId,campusId).first(),
    sectionId?env.DB.prepare("SELECT id FROM sections WHERE id=?1 AND organization_id=?2 AND campus_id=?3 AND class_id=?4 AND status='active'").bind(sectionId,auth.organizationId,campusId,classId).first():Promise.resolve({id:"all"}),
  ]);if(!year||!schoolClass||!section)return Response.json({error:"Attendance scope is not valid for this school, campus or academic year."},{status:400});
  const normalized=records.map(record=>({studentId:clean(record.studentId),enrollmentId:clean(record.enrollmentId),status:clean(record.status,20),remarks:clean(record.remarks,300)}));
  if(normalized.some(record=>!record.studentId||!record.enrollmentId||!statuses.has(record.status)))return Response.json({error:"Every student needs a valid attendance status."},{status:400});
  const placeholders=normalized.map((_,index)=>`?${index+6}`).join(","),bindings=[auth.organizationId,academicYearId,campusId,classId,sectionId,...normalized.map(record=>record.enrollmentId)];
  const ownedEnrollments=await env.DB.prepare(`SELECT id,student_id FROM enrollments WHERE organization_id=?1 AND academic_year_id=?2 AND campus_id=?3 AND class_id=?4 AND (?5='' OR section_id=?5) AND status='active' AND id IN (${placeholders})`).bind(...bindings).all<{id:string;student_id:string}>();
  const valid=new Map(ownedEnrollments.results.map(row=>[row.id,row.student_id]));if(valid.size!==normalized.length||normalized.some(record=>valid.get(record.enrollmentId)!==record.studentId))return Response.json({error:"One or more students do not belong to this attendance register."},{status:400});
  const scopeKey=`${classId}:${sectionId||"all"}`,existingSession=await env.DB.prepare("SELECT id,status FROM student_attendance_sessions WHERE organization_id=?1 AND academic_year_id=?2 AND campus_id=?3 AND scope_key=?4 AND attendance_date=?5").bind(auth.organizationId,academicYearId,campusId,scopeKey,date).first<{id:string;status:string}>(),sessionId=existingSession?.id||crypto.randomUUID();
  if(existingSession?.status==="submitted"&&!auth.permissions.has("student_attendance.correct"))return Response.json({error:"Submitted attendance can only be changed by an authorized correction user."},{status:403});
  if(existingSession?.status==="submitted"&&!correctionReason)return Response.json({error:"A correction reason is required when changing submitted attendance."},{status:400});
  const oldRows=existingSession?(await env.DB.prepare("SELECT id,student_id,status,remarks FROM student_attendance_records WHERE session_id=?1 AND organization_id=?2").bind(sessionId,auth.organizationId).all<{id:string;student_id:string;status:string;remarks:string|null}>()).results:[],oldByStudent=new Map(oldRows.map(row=>[row.student_id,row]));
  const counts={present:0,absent:0,late:0,leave:0,half_day:0};for(const record of normalized)counts[record.status as keyof typeof counts]++;
  const statements=[];
  if(!existingSession)statements.push(env.DB.prepare("INSERT INTO student_attendance_sessions (id,organization_id,academic_year_id,campus_id,class_id,section_id,scope_key,attendance_date,status,student_count,present_count,absent_count,late_count,leave_count,half_day_count,marked_by,submitted_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,'submitted',?9,?10,?11,?12,?13,?14,?15,unixepoch()*1000)").bind(sessionId,auth.organizationId,academicYearId,campusId,classId,sectionId||null,scopeKey,date,normalized.length,counts.present,counts.absent,counts.late,counts.leave,counts.half_day,auth.userId));
  else statements.push(env.DB.prepare("UPDATE student_attendance_sessions SET status='submitted',student_count=?1,present_count=?2,absent_count=?3,late_count=?4,leave_count=?5,half_day_count=?6,marked_by=?7,submitted_at=unixepoch()*1000,updated_at=unixepoch()*1000 WHERE id=?8 AND organization_id=?9").bind(normalized.length,counts.present,counts.absent,counts.late,counts.leave,counts.half_day,auth.userId,sessionId,auth.organizationId));
  for(const record of normalized){
    const previous=oldByStudent.get(record.studentId),recordId=previous?.id||crypto.randomUUID();
    if(previous&&(previous.status!==record.status||(previous.remarks||"")!==record.remarks))statements.push(env.DB.prepare("INSERT INTO student_attendance_corrections (id,organization_id,attendance_record_id,previous_status,new_status,previous_remarks,new_remarks,reason,corrected_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(crypto.randomUUID(),auth.organizationId,recordId,previous.status,record.status,previous.remarks,record.remarks||null,correctionReason,auth.userId));
    statements.push(env.DB.prepare("INSERT INTO student_attendance_records (id,organization_id,session_id,student_id,enrollment_id,attendance_date,status,remarks,marked_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status,remarks=excluded.remarks,marked_by=excluded.marked_by,updated_at=unixepoch()*1000").bind(recordId,auth.organizationId,sessionId,record.studentId,record.enrollmentId,date,record.status,record.remarks||null,auth.userId));
    if(record.status==="absent"||record.status==="late")statements.push(env.DB.prepare("INSERT OR IGNORE INTO attendance_alerts (id,organization_id,campus_id,student_id,attendance_record_id,alert_type,status,recipient_count) VALUES (?1,?2,?3,?4,?5,?6,'queued',(SELECT count(*) FROM student_guardians sg JOIN guardians g ON g.id=sg.guardian_id WHERE sg.student_id=?4 AND g.organization_id=?2 AND g.communication_opt_in=1))").bind(crypto.randomUUID(),auth.organizationId,campusId,record.studentId,recordId,record.status));
  }
  statements.push(env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,?5,'student_attendance_session',?6,'success',?7)").bind(crypto.randomUUID(),auth.organizationId,campusId,auth.userId,existingSession?"student.attendance.correct":"student.attendance.submit",sessionId,safeMetadata({date,classId,sectionId,counts,reason:correctionReason||undefined})));
  await env.DB.batch(statements);return Response.json({ok:true,sessionId,counts});
}
