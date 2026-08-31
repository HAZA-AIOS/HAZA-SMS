import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";

export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const auth=await authorize("assets.download");if(!auth)return Response.json({error:"You do not have permission to download files."},{status:403});
  const {id}=await params;
  const asset=await env.DB.prepare("SELECT r2_key,original_name,content_type FROM storage_assets WHERE id=?1 AND organization_id=?2").bind(id,auth.organizationId).first<{r2_key:string;original_name:string;content_type:string}>();
  if(!asset)return Response.json({error:"File not found."},{status:404});
  const object=await env.BUCKET.get(asset.r2_key);if(!object)return Response.json({error:"Stored file is unavailable."},{status:404});
  await env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'asset.download','storage_asset',?4,'success')").bind(crypto.randomUUID(),auth.organizationId,auth.userId,id).run();
  const safeName=asset.original_name.replace(/["\\\r\n]/g,"_");
  return new Response(object.body,{headers:{"content-type":asset.content_type,"content-disposition":`attachment; filename="${safeName}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
}
