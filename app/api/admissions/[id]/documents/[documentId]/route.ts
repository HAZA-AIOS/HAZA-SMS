import { env } from "cloudflare:workers";
import { authorize } from "../../../../../../lib/authorization";
import { requireSameOrigin, safeMetadata } from "../../../../../../lib/security";

export const dynamic="force-dynamic";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string;documentId:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("admissions.verify_documents");if(!auth)return Response.json({error:"You do not have permission to verify admission documents."},{status:403});
  const {id,documentId}=await params,body=await request.json().catch(()=>null) as Record<string,unknown>|null,status=typeof body?.status==="string"?body.status:"",notes=typeof body?.notes==="string"?body.notes.trim().slice(0,500):"";
  if(!["verified","rejected","pending"].includes(status))return Response.json({error:"Select a valid verification status."},{status:400});
  const row=await env.DB.prepare(`SELECT d.id,a.campus_id FROM admission_documents d JOIN admission_applications a ON a.id=d.application_id WHERE d.id=?1 AND d.application_id=?2 AND d.organization_id=?3 AND a.organization_id=?3`).bind(documentId,id,auth.organizationId).first<{id:string;campus_id:string}>();if(!row)return Response.json({error:"Admission document not found."},{status:404});
  await env.DB.batch([
    env.DB.prepare("UPDATE admission_documents SET verification_status=?1,verification_notes=?2,verified_by=?3,verified_at=?4,updated_at=unixepoch()*1000 WHERE id=?5 AND application_id=?6 AND organization_id=?7").bind(status,notes||null,status==="pending"?null:auth.userId,status==="pending"?null:Date.now(),documentId,id,auth.organizationId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'admission.document.verify','admission_document',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,row.campus_id,auth.userId,documentId,safeMetadata({status,applicationId:id})),
  ]);
  return Response.json({ok:true});
}
