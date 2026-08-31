import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { requireSameOrigin, safeMetadata } from "../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=240)=>typeof value==="string"?value.trim().slice(0,length):"";
const validDate=(value:string)=>!value||/^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await authorize("admissions.view");if(!auth)return Response.json({error:"You do not have permission to view applications."},{status:403});
  const {id}=await params;
  const application=await env.DB.prepare(`SELECT a.*,c.name campus_name,cl.name class_name,y.name academic_year_name,s.admission_number converted_admission_number FROM admission_applications a JOIN campuses c ON c.id=a.campus_id LEFT JOIN classes cl ON cl.id=a.applying_class_id LEFT JOIN academic_years y ON y.id=a.academic_year_id LEFT JOIN students s ON s.id=a.student_id AND s.organization_id=a.organization_id WHERE a.id=?1 AND a.organization_id=?2`).bind(id,auth.organizationId).first();
  if(!application)return Response.json({error:"Application not found."},{status:404});
  const [documents,assessments,feeAssignment,feePackages,sections]=await Promise.all([
    env.DB.prepare(`SELECT d.id,d.document_type,d.title,d.verification_status,d.verification_notes,d.verified_at,d.created_at,a.id asset_id,a.original_name,a.content_type,a.size_bytes FROM admission_documents d JOIN storage_assets a ON a.id=d.asset_id WHERE d.application_id=?1 AND d.organization_id=?2 ORDER BY d.created_at DESC`).bind(id,auth.organizationId).all(),
    env.DB.prepare(`SELECT x.id,x.assessment_type,x.scheduled_at,x.venue,x.max_score,x.score,x.result,x.remarks,x.conducted_by,u.display_name conducted_by_name FROM admission_assessments x LEFT JOIN users u ON u.id=x.conducted_by WHERE x.application_id=?1 AND x.organization_id=?2 ORDER BY x.scheduled_at`).bind(id,auth.organizationId).all(),
    env.DB.prepare(`SELECT f.*,p.name package_name,p.code package_code,p.admission_fee,p.registration_fee,p.security_deposit,p.monthly_tuition,p.annual_charges FROM application_fee_assignments f JOIN admission_fee_packages p ON p.id=f.fee_package_id WHERE f.application_id=?1 AND f.organization_id=?2`).bind(id,auth.organizationId).first(),
    env.DB.prepare(`SELECT id,name,code,admission_fee,registration_fee,security_deposit,monthly_tuition,annual_charges FROM admission_fee_packages WHERE organization_id=?1 AND status='active' AND (campus_id IS NULL OR campus_id=?2) AND (class_id IS NULL OR class_id=?3) ORDER BY name`).bind(auth.organizationId,application.campus_id,application.applying_class_id).all(),
    env.DB.prepare("SELECT id,name FROM sections WHERE organization_id=?1 AND campus_id=?2 AND class_id=?3 AND status='active' ORDER BY name").bind(auth.organizationId,application.campus_id,application.applying_class_id).all(),
  ]);
  return Response.json({application,documents:documents.results,assessments:assessments.results,feeAssignment,feePackages:feePackages.results,sections:sections.results},{headers:{"cache-control":"private, no-store"}});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("admissions.edit");if(!auth)return Response.json({error:"You do not have permission to edit applications."},{status:403});
  const {id}=await params,body=await request.json().catch(()=>null) as Record<string,unknown>|null,action=clean(body?.action,30)||"save";
  const current=await env.DB.prepare("SELECT id,campus_id,status FROM admission_applications WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId).first<{id:string;campus_id:string;status:string}>();if(!current)return Response.json({error:"Application not found."},{status:404});
  const childFirstName=clean(body?.childFirstName,80),childLastName=clean(body?.childLastName,80),dateOfBirth=clean(body?.dateOfBirth,10),gender=clean(body?.gender,20),applyingClassId=clean(body?.applyingClassId),academicYearId=clean(body?.academicYearId),guardianName=clean(body?.guardianName,120),guardianRelationship=clean(body?.guardianRelationship,40),guardianNationalId=clean(body?.guardianNationalId,40),guardianOccupation=clean(body?.guardianOccupation,100),primaryPhone=clean(body?.primaryPhone,30),alternatePhone=clean(body?.alternatePhone,30),email=clean(body?.email,160).toLowerCase(),address=clean(body?.address,400),city=clean(body?.city,80),previousSchool=clean(body?.previousSchool,160),previousClass=clean(body?.previousClass,80),medicalNotes=clean(body?.medicalNotes,600),specialNeeds=clean(body?.specialNeeds,600),notes=clean(body?.notes,1200),declarationAccepted=body?.declarationAccepted===true||body?.declarationAccepted==="on";
  if(!childFirstName||!guardianName||!primaryPhone||!validDate(dateOfBirth)||!["","male","female","other"].includes(gender)||email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:"Complete the required student and guardian information."},{status:400});
  if(applyingClassId){const row=await env.DB.prepare("SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'").bind(applyingClassId,auth.organizationId,current.campus_id).first();if(!row)return Response.json({error:"Select a valid class."},{status:400});}
  if(academicYearId){const row=await env.DB.prepare("SELECT id FROM academic_years WHERE id=?1 AND organization_id=?2").bind(academicYearId,auth.organizationId).first();if(!row)return Response.json({error:"Select a valid academic year."},{status:400});}
  if(action==="submit"&&(!dateOfBirth||!applyingClassId||!academicYearId||!address||!declarationAccepted))return Response.json({error:"Date of birth, class, academic year, address and guardian declaration are required before submission."},{status:400});
  const status=action==="submit"?"submitted":current.status,submittedOn=action==="submit"?new Date().toISOString().slice(0,10):null;
  await env.DB.batch([
    env.DB.prepare(`UPDATE admission_applications SET child_first_name=?1,child_last_name=?2,date_of_birth=?3,gender=?4,applying_class_id=?5,academic_year_id=?6,guardian_name=?7,guardian_relationship=?8,guardian_national_id=?9,guardian_occupation=?10,primary_phone=?11,alternate_phone=?12,email=?13,address=?14,city=?15,previous_school=?16,previous_class=?17,medical_notes=?18,special_needs=?19,notes=?20,declaration_accepted=?21,status=?22,submitted_on=COALESCE(?23,submitted_on),updated_at=unixepoch()*1000 WHERE id=?24 AND organization_id=?25`).bind(childFirstName,childLastName||null,dateOfBirth||null,gender||null,applyingClassId||null,academicYearId||null,guardianName,guardianRelationship||null,guardianNationalId||null,guardianOccupation||null,primaryPhone,alternatePhone||null,email||null,address||null,city||null,previousSchool||null,previousClass||null,medicalNotes||null,specialNeeds||null,notes||null,declarationAccepted?1:0,status,submittedOn,id,auth.organizationId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,?5,'admission_application',?6,'success',?7)").bind(crypto.randomUUID(),auth.organizationId,current.campus_id,auth.userId,action==="submit"?"admission.application.submit":"admission.application.update",id,safeMetadata({status})),
  ]);
  return Response.json({ok:true,status});
}
