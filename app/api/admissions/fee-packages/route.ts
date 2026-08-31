import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin, safeMetadata } from "../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=100)=>typeof value==="string"?value.trim().slice(0,length):"";
const amount=(value:unknown)=>Math.max(0,Math.min(100000000,Math.round(Number(value)||0)));
export async function GET(){const auth=await authorize("admissions.view");if(!auth)return Response.json({error:"You do not have permission to view fee packages."},{status:403});const rows=await env.DB.prepare(`SELECT p.*,c.name campus_name,cl.name class_name FROM admission_fee_packages p LEFT JOIN campuses c ON c.id=p.campus_id LEFT JOIN classes cl ON cl.id=p.class_id WHERE p.organization_id=?1 AND p.status='active' ORDER BY p.name`).bind(auth.organizationId).all();return Response.json({feePackages:rows.results});}
export async function POST(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;const auth=await authorize("admissions.fee_packages");if(!auth)return Response.json({error:"You do not have permission to manage fee packages."},{status:403});
  if(!await enforceRateLimit(auth,"admission.fee_package.create",30,300))return Response.json({error:"Fee package creation limit reached."},{status:429});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null,name=clean(body?.name),code=clean(body?.code,40).toUpperCase(),campusId=clean(body?.campusId),classId=clean(body?.classId),admissionFee=amount(body?.admissionFee),registrationFee=amount(body?.registrationFee),securityDeposit=amount(body?.securityDeposit),monthlyTuition=amount(body?.monthlyTuition),annualCharges=amount(body?.annualCharges);
  if(!name||!code)return Response.json({error:"Fee package name and code are required."},{status:400});
  if(campusId){const row=await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2 AND status='active'").bind(campusId,auth.organizationId).first();if(!row)return Response.json({error:"Select a valid campus."},{status:400});}
  if(classId){const row=await env.DB.prepare("SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND status='active'").bind(classId,auth.organizationId).first();if(!row)return Response.json({error:"Select a valid class."},{status:400});}
  const id=crypto.randomUUID();try{await env.DB.batch([
    env.DB.prepare("INSERT INTO admission_fee_packages (id,organization_id,campus_id,class_id,name,code,admission_fee,registration_fee,security_deposit,monthly_tuition,annual_charges,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)").bind(id,auth.organizationId,campusId||null,classId||null,name,code,admissionFee,registrationFee,securityDeposit,monthlyTuition,annualCharges,auth.userId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'admission.fee_package.create','admission_fee_package',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,campusId||null,auth.userId,id,safeMetadata({name,code})),
  ]);return Response.json({ok:true,id});}catch{return Response.json({error:"Fee package code already exists."},{status:409});}
}
