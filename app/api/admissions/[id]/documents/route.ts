import { env } from "cloudflare:workers";
import { authorize } from "../../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin, safeMetadata } from "../../../../../lib/security";

export const dynamic="force-dynamic";
const allowed=new Set(["image/png","image/jpeg","application/pdf"]),types=new Set(["birth_certificate","guardian_id","previous_result","student_photo","transfer_certificate","medical_record","other"]);
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("admissions.documents");if(!auth)return Response.json({error:"You do not have permission to upload application documents."},{status:403});
  if(!await enforceRateLimit(auth,"admission.document.upload",30,300))return Response.json({error:"Upload limit reached. Try again later."},{status:429});
  const {id}=await params,data=await request.formData(),file=data.get("file"),documentType=String(data.get("documentType")??"other").slice(0,40),title=String(data.get("title")??"").trim().slice(0,160);
  if(!(file instanceof File)||!allowed.has(file.type)||file.size<1||file.size>10*1024*1024||!types.has(documentType))return Response.json({error:"Choose a PNG, JPEG or PDF document up to 10 MB."},{status:400});
  const application=await env.DB.prepare("SELECT id,campus_id FROM admission_applications WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId).first<{id:string;campus_id:string}>();if(!application)return Response.json({error:"Application not found."},{status:404});
  const assetId=crypto.randomUUID(),documentId=crypto.randomUUID(),safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100)||"file",r2Key=`organizations/${auth.organizationId}/admissions/${id}/${documentType}/${assetId}-${safeName}`;
  await env.BUCKET.put(r2Key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
  try{await env.DB.batch([
    env.DB.prepare("INSERT INTO storage_assets (id,organization_id,campus_id,asset_type,r2_key,original_name,content_type,size_bytes,uploaded_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(assetId,auth.organizationId,application.campus_id,`admission_document:${documentType}`,r2Key,file.name.slice(0,255),file.type,file.size,auth.userId),
    env.DB.prepare("INSERT INTO admission_documents (id,organization_id,application_id,asset_id,document_type,title) VALUES (?1,?2,?3,?4,?5,?6)").bind(documentId,auth.organizationId,id,assetId,documentType,title||file.name.slice(0,160)),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'admission.document.upload','admission_application',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,application.campus_id,auth.userId,id,safeMetadata({documentId,documentType,assetId})),
  ]);return Response.json({ok:true,documentId});}catch(error){await env.BUCKET.delete(r2Key);throw error;}
}
