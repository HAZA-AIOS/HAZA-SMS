import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=160)=>typeof value==="string"?value.trim().slice(0,length):"";
const flag=(value:unknown)=>value===true||value==="true"||value==="on"||value===1;
async function student(auth:{organizationId:string},id:string){return env.DB.prepare("SELECT id,home_campus_id FROM students WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId).first<{id:string;home_campus_id:string}>();}

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await authorize("guardians.view");if(!auth)return Response.json({error:"You do not have permission to view family information."},{status:403});
  const {id}=await params,studentRow=await student(auth,id);if(!studentRow)return Response.json({error:"Student not found."},{status:404});const denied=await requireCampusAccess(auth,studentRow.home_campus_id,"guardians.view");if(denied)return denied;
  const [guardians,available]=await Promise.all([
    env.DB.prepare(`SELECT g.id,g.family_id,g.first_name,g.last_name,g.national_id,g.occupation,g.employer,g.primary_phone,g.alternate_phone,g.email,g.address,g.city,g.preferred_language,g.communication_opt_in,sg.relationship,sg.is_primary,sg.lives_with_student,sg.legal_guardian,sg.pickup_authorized,sg.receives_academic,sg.receives_financial,f.family_code,f.family_name,(SELECT group_concat(s.first_name||' '||coalesce(s.last_name,''),', ') FROM student_guardians x JOIN students s ON s.id=x.student_id WHERE x.guardian_id=g.id AND s.organization_id=?2) linked_children FROM student_guardians sg JOIN guardians g ON g.id=sg.guardian_id AND g.organization_id=?2 LEFT JOIN families f ON f.id=g.family_id WHERE sg.student_id=?1 ORDER BY sg.is_primary DESC,g.first_name`).bind(id,auth.organizationId).all(),
    env.DB.prepare(`SELECT g.id,g.first_name,g.last_name,g.primary_phone,f.family_name FROM guardians g LEFT JOIN families f ON f.id=g.family_id WHERE g.organization_id=?1 AND g.status='active' AND NOT EXISTS (SELECT 1 FROM student_guardians sg WHERE sg.student_id=?2 AND sg.guardian_id=g.id) ORDER BY g.first_name LIMIT 100`).bind(auth.organizationId,id).all(),
  ]);
  return Response.json({guardians:guardians.results,available:available.results});
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("guardians.manage");if(!auth)return Response.json({error:"You do not have permission to manage guardians."},{status:403});
  if(!await enforceRateLimit(auth,"guardian.create",30,300))return Response.json({error:"Guardian change limit reached. Try again later."},{status:429});
  const {id:studentId}=await params,studentRow=await student(auth,studentId);if(!studentRow)return Response.json({error:"Student not found."},{status:404});
  const denied=await requireCampusAccess(auth,studentRow.home_campus_id,"guardians.manage");if(denied)return denied;
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return Response.json({error:"Enter valid guardian information."},{status:400});
  let guardianId=clean(body.guardianId),familyId="";const relationship=clean(body.relationship,40);
  if(!relationship)return Response.json({error:"Select the guardian relationship."},{status:400});
  const statements=[];
  if(guardianId){const existing=await env.DB.prepare("SELECT id,family_id FROM guardians WHERE id=?1 AND organization_id=?2 AND status='active'").bind(guardianId,auth.organizationId).first<{id:string;family_id:string|null}>();if(!existing)return Response.json({error:"Guardian not found."},{status:404});familyId=existing.family_id??"";}
  else{
    const firstName=clean(body.firstName,80),lastName=clean(body.lastName,80),primaryPhone=clean(body.primaryPhone,30),email=clean(body.email,160).toLowerCase();if(!firstName||!primaryPhone)return Response.json({error:"Guardian name and primary phone are required."},{status:400});if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return Response.json({error:"Enter a valid guardian email."},{status:400});
    const duplicate=await env.DB.prepare("SELECT id FROM guardians WHERE organization_id=?1 AND primary_phone=?2 AND status='active' LIMIT 1").bind(auth.organizationId,primaryPhone).first();if(duplicate)return Response.json({error:"A guardian with this phone already exists. Link the existing guardian instead."},{status:409});
    const currentFamily=await env.DB.prepare("SELECT g.family_id FROM student_guardians sg JOIN guardians g ON g.id=sg.guardian_id WHERE sg.student_id=?1 AND g.organization_id=?2 AND g.family_id IS NOT NULL ORDER BY sg.is_primary DESC LIMIT 1").bind(studentId,auth.organizationId).first<{family_id:string}>();familyId=currentFamily?.family_id??crypto.randomUUID();
    if(!currentFamily){const familyName=clean(body.familyName,120)||`${lastName||firstName} Family`,familyCode=`FAM-${Date.now().toString(36).toUpperCase()}`;statements.push(env.DB.prepare("INSERT INTO families (id,organization_id,family_code,family_name,address,city) VALUES (?1,?2,?3,?4,?5,?6)").bind(familyId,auth.organizationId,familyCode,familyName,clean(body.address,300)||null,clean(body.city,80)||null));}
    guardianId=crypto.randomUUID();statements.push(env.DB.prepare("INSERT INTO guardians (id,organization_id,family_id,first_name,last_name,national_id,occupation,employer,primary_phone,alternate_phone,email,address,city,preferred_language,communication_opt_in) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)").bind(guardianId,auth.organizationId,familyId,firstName,lastName||null,clean(body.nationalId,40)||null,clean(body.occupation,100)||null,clean(body.employer,120)||null,primaryPhone,clean(body.alternatePhone,30)||null,email||null,clean(body.address,300)||null,clean(body.city,80)||null,clean(body.preferredLanguage,40)||"English",flag(body.communicationOptIn)?1:0));
  }
  statements.push(env.DB.prepare("INSERT INTO student_guardians (student_id,guardian_id,relationship,is_primary,lives_with_student,legal_guardian,pickup_authorized,receives_academic,receives_financial) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(studentId,guardianId,relationship,flag(body.isPrimary)?1:0,flag(body.livesWithStudent)?1:0,flag(body.legalGuardian)?1:0,flag(body.pickupAuthorized)?1:0,flag(body.receivesAcademic)?1:0,flag(body.receivesFinancial)?1:0));
  if(flag(body.isPrimary))statements.push(env.DB.prepare("UPDATE student_guardians SET is_primary=0,updated_at=unixepoch()*1000 WHERE student_id=?1 AND guardian_id<>?2").bind(studentId,guardianId));
  statements.push(env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'guardian.link','student',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,studentRow.home_campus_id,auth.userId,studentId,JSON.stringify({guardianId,relationship})));
  try{await env.DB.batch(statements);return Response.json({ok:true,guardianId,familyId});}catch{return Response.json({error:"Guardian is already linked or could not be saved."},{status:409});}
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("guardians.manage");if(!auth)return Response.json({error:"You do not have permission to manage guardians."},{status:403});
  const {id:studentId}=await params,studentRow=await student(auth,studentId),body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!studentRow||!body)return Response.json({error:"Student or guardian not found."},{status:404});
  const denied=await requireCampusAccess(auth,studentRow.home_campus_id,"guardians.manage");if(denied)return denied;
  const guardianId=clean(body.guardianId),action=clean(body.action,20),linked=await env.DB.prepare("SELECT sg.guardian_id FROM student_guardians sg JOIN guardians g ON g.id=sg.guardian_id WHERE sg.student_id=?1 AND sg.guardian_id=?2 AND g.organization_id=?3").bind(studentId,guardianId,auth.organizationId).first();if(!linked)return Response.json({error:"Guardian link not found."},{status:404});
  if(action==="unlink"){await env.DB.batch([env.DB.prepare("DELETE FROM student_guardians WHERE student_id=?1 AND guardian_id=?2").bind(studentId,guardianId),env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'guardian.unlink','student',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,studentRow.home_campus_id,auth.userId,studentId,JSON.stringify({guardianId}))]);return Response.json({ok:true});}
  const relationship=clean(body.relationship,40);if(!relationship)return Response.json({error:"Relationship is required."},{status:400});
  const statements=[env.DB.prepare("UPDATE student_guardians SET relationship=?1,is_primary=?2,lives_with_student=?3,legal_guardian=?4,pickup_authorized=?5,receives_academic=?6,receives_financial=?7,updated_at=unixepoch()*1000 WHERE student_id=?8 AND guardian_id=?9").bind(relationship,flag(body.isPrimary)?1:0,flag(body.livesWithStudent)?1:0,flag(body.legalGuardian)?1:0,flag(body.pickupAuthorized)?1:0,flag(body.receivesAcademic)?1:0,flag(body.receivesFinancial)?1:0,studentId,guardianId)];if(flag(body.isPrimary))statements.push(env.DB.prepare("UPDATE student_guardians SET is_primary=0,updated_at=unixepoch()*1000 WHERE student_id=?1 AND guardian_id<>?2").bind(studentId,guardianId));statements.push(env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'guardian.relationship.update','student',?5,'success')").bind(crypto.randomUUID(),auth.organizationId,studentRow.home_campus_id,auth.userId,studentId));await env.DB.batch(statements);return Response.json({ok:true});
}
