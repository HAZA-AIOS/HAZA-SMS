import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../../../lib/authorization";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const auth=await authorize('admissions.view');if(!auth)return Response.json({error:'Permission denied'},{status:403});const {id}=await params;
 const row=await env.DB.prepare("SELECT a.campus_id,s.r2_key,s.content_type FROM admission_applications a JOIN admission_documents d ON d.application_id=a.id AND d.organization_id=a.organization_id JOIN storage_assets s ON s.id=d.asset_id AND s.organization_id=a.organization_id WHERE a.id=?1 AND a.organization_id=?2 AND d.document_type='student_photo' ORDER BY d.created_at DESC LIMIT 1").bind(id,auth.organizationId).first<{campus_id:string;r2_key:string;content_type:string}>();
 if(!row)return new Response(null,{status:404});const denied=await requireCampusAccess(auth,row.campus_id,'admission.photo.view');if(denied)return denied;
 const object=await env.BUCKET.get(row.r2_key);if(!object)return new Response(null,{status:404});return new Response(object.body,{headers:{'content-type':row.content_type,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
}
