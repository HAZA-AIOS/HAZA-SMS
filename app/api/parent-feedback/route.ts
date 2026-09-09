import { env } from "cloudflare:workers";
import { publicSchool, sameOrigin, publicLimit, boundedBody, fail, noStore, text, PublicFormError } from "../../../lib/public-forms";
export const dynamic="force-dynamic";
export async function GET(){try{const org=await publicSchool();const rows=await env.DB.prepare("SELECT id,name,message,created_at FROM parent_feedback WHERE organization_id=?1 AND status='published' ORDER BY created_at DESC LIMIT 30").bind(org).all();return Response.json({feedback:rows.results},{headers:noStore})}catch(e){return fail(e)}}
export async function POST(request:Request){try{
 sameOrigin(request);const org=await publicSchool();await publicLimit(request,org,"feedback",5);
 const body=JSON.parse(new TextDecoder().decode(await boundedBody(request,8192)));
 const name=text(body.name,80),message=text(body.message,1000),id=text(body.id,36);
 if(!/^[0-9a-f-]{36}$/i.test(id)||name.length<2||message.length<10||body.consent!==true||body.website)throw new PublicFormError("Enter your name and a message of at least 10 characters, and agree to publish them.");
 await env.DB.prepare("INSERT INTO parent_feedback (id,organization_id,name,message,status,created_at) VALUES (?1,?2,?3,?4,'published',?5) ON CONFLICT(id) DO NOTHING").bind(id,org,name,message,Date.now()).run();
 return Response.json({ok:true},{headers:noStore});
 }catch(e){return fail(e)}}
