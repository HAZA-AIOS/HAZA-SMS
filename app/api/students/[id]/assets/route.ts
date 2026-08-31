import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../../lib/security";

export const dynamic="force-dynamic";
const allowed=new Set(["image/png","image/jpeg","application/pdf"]);
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("students.edit");if(!auth)return Response.json({error:"You do not have permission to upload student files."},{status:403});
  if(!await enforceRateLimit(auth,"student.asset.upload",30,300))return Response.json({error:"Upload limit reached. Try again later."},{status:429});
  const {id:studentId}=await params,data=await request.formData(),file=data.get("file"),kind=String(data.get("kind")??"document"),documentType=String(data.get("documentType")??"other").slice(0,40),title=String(data.get("title")??"").trim().slice(0,160),notes=String(data.get("notes")??"").trim().slice(0,500),issuedOn=String(data.get("issuedOn")??"").slice(0,10),expiresOn=String(data.get("expiresOn")??"").slice(0,10),isRequired=data.get("isRequired")==="on";
  if(!(file instanceof File)||!allowed.has(file.type)||file.size<1||file.size>10*1024*1024||!["photo","document"].includes(kind))return Response.json({error:"Choose a PNG, JPEG or PDF file up to 10 MB."},{status:400});
  if(kind==="photo"&&!file.type.startsWith("image/"))return Response.json({error:"Student photos must be PNG or JPEG."},{status:400});
  const student=await env.DB.prepare("SELECT home_campus_id FROM students WHERE id=?1 AND organization_id=?2").bind(studentId,auth.organizationId).first<{home_campus_id:string}>();if(!student)return Response.json({error:"Student not found."},{status:404});
  const denied=await requireCampusAccess(auth,student.home_campus_id,"student.asset.upload");if(denied)return denied;
  const assetId=crypto.randomUUID(),documentId=crypto.randomUUID(),safeName=file.name.replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100)||"file",assetType=kind==="photo"?"student_photo":`student_document:${documentType}`,r2Key=`organizations/${auth.organizationId}/students/${studentId}/${assetType}/${assetId}-${safeName}`;
  await env.BUCKET.put(r2Key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type}});
  const statements=[env.DB.prepare("INSERT INTO storage_assets (id,organization_id,campus_id,asset_type,r2_key,original_name,content_type,size_bytes,uploaded_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)").bind(assetId,auth.organizationId,student.home_campus_id,assetType,r2Key,file.name.slice(0,255),file.type,file.size,auth.userId)];
  if(kind==="photo")statements.push(env.DB.prepare("UPDATE students SET photo_asset_id=?1,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(assetId,studentId,auth.organizationId));
  else statements.push(env.DB.prepare("INSERT INTO student_documents (id,organization_id,student_id,asset_id,document_type,title,notes,issued_on,expires_on,is_required) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)").bind(documentId,auth.organizationId,studentId,assetId,documentType,title||file.name.slice(0,160),notes||null,issuedOn||null,expiresOn||null,isRequired?1:0));
  statements.push(env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,?5,'student',?6,'success',?7)").bind(crypto.randomUUID(),auth.organizationId,student.home_campus_id,auth.userId,kind==="photo"?"student.photo.upload":"student.document.upload",studentId,JSON.stringify({assetId,documentType})));
  try{await env.DB.batch(statements);return Response.json({ok:true});}catch(error){await env.BUCKET.delete(r2Key);throw error;}
}
