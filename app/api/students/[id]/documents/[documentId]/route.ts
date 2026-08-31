import { env } from "cloudflare:workers";
import { authorize } from "../../../../../../lib/authorization";
import { requireSameOrigin } from "../../../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=300)=>typeof value==="string"?value.trim().slice(0,length):"";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string;documentId:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null,action=clean(body?.action,20),permission=["verify","reject"].includes(action)?"student_documents.verify":"students.edit",auth=await authorize(permission);if(!auth)return Response.json({error:"You do not have permission to manage this document."},{status:403});
  const {id:studentId,documentId}=await params,document=await env.DB.prepare(`SELECT d.id,s.home_campus_id FROM student_documents d JOIN students s ON s.id=d.student_id WHERE d.id=?1 AND d.student_id=?2 AND d.organization_id=?3 AND s.organization_id=?3`).bind(documentId,studentId,auth.organizationId).first<{id:string;home_campus_id:string}>();if(!document)return Response.json({error:"Document not found."},{status:404});
  let statement;
  if(action==="verify"||action==="reject")statement=env.DB.prepare("UPDATE student_documents SET verification_status=?1,verified_by=?2,verified_at=unixepoch()*1000,notes=CASE WHEN ?3='' THEN notes ELSE ?3 END,updated_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5").bind(action==="verify"?"verified":"rejected",auth.userId,clean(body?.notes),documentId,auth.organizationId);
  else if(action==="archive"||action==="restore")statement=env.DB.prepare("UPDATE student_documents SET status=?1,archived_at=?2,updated_at=unixepoch()*1000 WHERE id=?3 AND organization_id=?4").bind(action==="archive"?"archived":"active",action==="archive"?Date.now():null,documentId,auth.organizationId);
  else if(action==="metadata")statement=env.DB.prepare("UPDATE student_documents SET title=?1,document_type=?2,issued_on=?3,expires_on=?4,is_required=?5,notes=?6,updated_at=unixepoch()*1000 WHERE id=?7 AND organization_id=?8").bind(clean(body?.title,160),clean(body?.documentType,40),clean(body?.issuedOn,10)||null,clean(body?.expiresOn,10)||null,body?.isRequired?1:0,clean(body?.notes)||null,documentId,auth.organizationId);
  else return Response.json({error:"Invalid document action."},{status:400});
  await env.DB.batch([statement,env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,?5,'student',?6,'success',?7)").bind(crypto.randomUUID(),auth.organizationId,document.home_campus_id,auth.userId,`student.document.${action}`,studentId,JSON.stringify({documentId}))]);
  return Response.json({ok:true});
}
