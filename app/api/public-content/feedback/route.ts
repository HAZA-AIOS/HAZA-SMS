import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { sameOrigin, boundedBody, fail, noStore, PublicFormError } from "../../../../lib/public-forms";
export const dynamic="force-dynamic";
export async function GET(){try{const auth=await authorize('settings.edit');if(!auth)throw new PublicFormError('Permission denied.',403);const result=await env.DB.prepare('SELECT id,name,message,status,created_at FROM parent_feedback WHERE organization_id=?1 ORDER BY created_at DESC LIMIT 100').bind(auth.organizationId).all();return Response.json({feedback:result.results},{headers:noStore})}catch(e){return fail(e)}}
export async function PATCH(request:Request){try{
 sameOrigin(request);const auth=await authorize('settings.edit');if(!auth)throw new PublicFormError('Permission denied.',403);
 const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,2048)));
 if(!['hidden','published'].includes(body.status)||typeof body.id!=='string')throw new PublicFormError('Invalid feedback update.');
 const row=await env.DB.prepare('SELECT id FROM parent_feedback WHERE id=?1 AND organization_id=?2').bind(body.id,auth.organizationId).first();if(!row)throw new PublicFormError('Feedback not found.',404);
 await env.DB.batch([env.DB.prepare('UPDATE parent_feedback SET status=?1 WHERE id=?2 AND organization_id=?3').bind(body.status,body.id,auth.organizationId),env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'public.feedback.moderate','parent_feedback',?4,'success',?5)").bind(crypto.randomUUID(),auth.organizationId,auth.userId,body.id,JSON.stringify({status:body.status}))]);return Response.json({ok:true},{headers:noStore});
 }catch(e){return fail(e)}}
