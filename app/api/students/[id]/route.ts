import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../../lib/authorization";
import { requireSameOrigin } from "../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=500)=>typeof value==="string"?value.trim().slice(0,length):"";
const fields=["preferredName","bloodGroup","nationality","religion","nationalId","placeOfBirth","motherTongue","domicileDistrict","identityMark","admissionCategory","admissionSource","previousAdmissionNumber","phone","email","addressLine1","addressLine2","city","province","postalCode","emergencyContactName","emergencyContactPhone","emergencyContactRelation","medicalNotes","allergies","dietaryRequirements","specialNeeds","accessibilityNotes","doctorName","doctorPhone","vaccinationNotes","previousSchool","previousClass","profileNotes"] as const;
const columns=["preferred_name","blood_group","nationality","religion","national_id","place_of_birth","mother_tongue","domicile_district","identity_mark","admission_category","admission_source","previous_admission_number","phone","email","address_line1","address_line2","city","province","postal_code","emergency_contact_name","emergency_contact_phone","emergency_contact_relation","medical_notes","allergies","dietary_requirements","special_needs","accessibility_notes","doctor_name","doctor_phone","vaccination_notes","previous_school","previous_class","profile_notes"];

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await authorize("students.view");if(!auth)return Response.json({error:"You do not have permission to view student profiles."},{status:403});
  const {id}=await params;
  const student=await env.DB.prepare(`SELECT s.*,c.name campus_name,sa.id photo_asset_id FROM students s JOIN campuses c ON c.id=s.home_campus_id LEFT JOIN storage_assets sa ON sa.id=s.photo_asset_id WHERE s.id=?1 AND s.organization_id=?2`).bind(id,auth.organizationId).first();
  if(!student)return Response.json({error:"Student not found."},{status:404});
  const denied=await requireCampusAccess(auth,(student as {home_campus_id:string}).home_campus_id,"student.profile.view");if(denied)return denied;
  const [enrollments,enrollmentEvents,documents,activity]=await Promise.all([
    env.DB.prepare(`SELECT e.id,e.status,e.roll_number,e.enrolled_on,e.ended_on,y.name academic_year,c.name campus_name,cl.name class_name,se.name section_name FROM enrollments e JOIN academic_years y ON y.id=e.academic_year_id JOIN campuses c ON c.id=e.campus_id LEFT JOIN classes cl ON cl.id=e.class_id LEFT JOIN sections se ON se.id=e.section_id WHERE e.student_id=?1 AND e.organization_id=?2 ORDER BY y.starts_on DESC`).bind(id,auth.organizationId).all(),
    env.DB.prepare(`SELECT ev.id,ev.event_type,ev.effective_on,ev.reason,ev.notes,fc.name from_campus,tc.name to_campus,fcl.name from_class,tcl.name to_class,u.display_name performed_by FROM enrollment_events ev LEFT JOIN campuses fc ON fc.id=ev.from_campus_id LEFT JOIN campuses tc ON tc.id=ev.to_campus_id LEFT JOIN classes fcl ON fcl.id=ev.from_class_id LEFT JOIN classes tcl ON tcl.id=ev.to_class_id LEFT JOIN users u ON u.id=ev.performed_by WHERE ev.student_id=?1 AND ev.organization_id=?2 ORDER BY ev.effective_on DESC,ev.created_at DESC`).bind(id,auth.organizationId).all(),
    env.DB.prepare(`SELECT d.id,d.document_type,d.title,d.notes,d.issued_on,d.expires_on,d.status,d.verification_status,d.is_required,d.version,d.verified_at,d.created_at,a.id asset_id,a.original_name,a.content_type,a.size_bytes,u.display_name verified_by_name FROM student_documents d JOIN storage_assets a ON a.id=d.asset_id LEFT JOIN users u ON u.id=d.verified_by WHERE d.student_id=?1 AND d.organization_id=?2 ORDER BY d.status='active' DESC,d.created_at DESC`).bind(id,auth.organizationId).all(),
    env.DB.prepare(`SELECT a.id,a.action,a.outcome,a.created_at,u.display_name actor_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id WHERE a.organization_id=?1 AND a.entity_type='student' AND a.entity_id=?2 ORDER BY a.created_at DESC LIMIT 30`).bind(auth.organizationId,id).all(),
  ]);
  await env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'student.profile.view','student',?5,'success')").bind(crypto.randomUUID(),auth.organizationId,(student as {home_campus_id:string}).home_campus_id,auth.userId,id).run();
  return Response.json({student,enrollments:enrollments.results,enrollmentEvents:enrollmentEvents.results,documents:documents.results,activity:activity.results});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("students.edit");if(!auth)return Response.json({error:"You do not have permission to edit student profiles."},{status:403});
  const {id}=await params,body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body)return Response.json({error:"Enter valid profile information."},{status:400});
  const student=await env.DB.prepare("SELECT home_campus_id FROM students WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId).first<{home_campus_id:string}>();
  if(!student)return Response.json({error:"Student not found."},{status:404});
  const denied=await requireCampusAccess(auth,student.home_campus_id,"student.profile.update");if(denied)return denied;
  const values=fields.map((field,index)=>clean(body[field],index>=15?2000:180)||null);
  if(values[13]&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[13]!))return Response.json({error:"Enter a valid email address."},{status:400});
  const assignments=columns.map((column,index)=>`${column}=?${index+1}`).join(",");
  await env.DB.batch([
    env.DB.prepare(`UPDATE students SET ${assignments},updated_at=unixepoch()*1000 WHERE id=?${values.length+1} AND organization_id=?${values.length+2}`).bind(...values,id,auth.organizationId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'student.profile.update','student',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,student.home_campus_id,auth.userId,id,JSON.stringify({fields:fields.filter(field=>field in body)})),
  ]);
  return Response.json({ok:true});
}
