import { env } from "cloudflare:workers";
import { authorize } from "../../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin, safeMetadata } from "../../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=500)=>typeof value==="string"?value.trim().slice(0,length):"";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("admissions.assessments");if(!auth)return Response.json({error:"You do not have permission to schedule admission assessments."},{status:403});
  if(!await enforceRateLimit(auth,"admission.assessment.create",30,300))return Response.json({error:"Assessment scheduling limit reached."},{status:429});
  const {id}=await params,body=await request.json().catch(()=>null) as Record<string,unknown>|null,assessmentType=clean(body?.assessmentType,20),scheduledAt=clean(body?.scheduledAt,30),venue=clean(body?.venue,120),maxScore=Number(body?.maxScore)||null;
  if(!["test","interview"].includes(assessmentType)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(scheduledAt)||maxScore!==null&&(maxScore<1||maxScore>1000))return Response.json({error:"Enter a valid test or interview schedule."},{status:400});
  const application=await env.DB.prepare("SELECT id,campus_id FROM admission_applications WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId).first<{id:string;campus_id:string}>();if(!application)return Response.json({error:"Application not found."},{status:404});
  const assessmentId=crypto.randomUUID();await env.DB.batch([
    env.DB.prepare("INSERT INTO admission_assessments (id,organization_id,application_id,assessment_type,scheduled_at,venue,max_score,result,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,'scheduled',?8)").bind(assessmentId,auth.organizationId,id,assessmentType,scheduledAt,venue||null,maxScore,auth.userId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'admission.assessment.schedule','admission_assessment',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,application.campus_id,auth.userId,assessmentId,safeMetadata({applicationId:id,assessmentType,scheduledAt})),
  ]);return Response.json({ok:true,assessmentId});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("admissions.assessments");if(!auth)return Response.json({error:"You do not have permission to record assessment results."},{status:403});
  const {id}=await params,body=await request.json().catch(()=>null) as Record<string,unknown>|null,assessmentId=clean(body?.assessmentId,80),result=clean(body?.result,30),remarks=clean(body?.remarks,800),scoreRaw=body?.score,score=scoreRaw===""||scoreRaw==null?null:Number(scoreRaw);
  if(!["scheduled","passed","failed","recommended","not_recommended","absent","cancelled"].includes(result)||score!==null&&(!Number.isFinite(score)||score<0))return Response.json({error:"Enter a valid assessment result."},{status:400});
  const row=await env.DB.prepare(`SELECT x.id,x.max_score,a.campus_id FROM admission_assessments x JOIN admission_applications a ON a.id=x.application_id WHERE x.id=?1 AND x.application_id=?2 AND x.organization_id=?3 AND a.organization_id=?3`).bind(assessmentId,id,auth.organizationId).first<{id:string;max_score:number|null;campus_id:string}>();if(!row)return Response.json({error:"Assessment not found."},{status:404});
  if(score!==null&&row.max_score!==null&&score>row.max_score)return Response.json({error:"Score cannot exceed the maximum score."},{status:400});
  await env.DB.batch([
    env.DB.prepare("UPDATE admission_assessments SET score=?1,result=?2,remarks=?3,conducted_by=?4,updated_at=unixepoch()*1000 WHERE id=?5 AND application_id=?6 AND organization_id=?7").bind(score,result,remarks||null,auth.userId,assessmentId,id,auth.organizationId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'admission.assessment.result','admission_assessment',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,row.campus_id,auth.userId,assessmentId,safeMetadata({applicationId:id,result,score})),
  ]);return Response.json({ok:true});
}
