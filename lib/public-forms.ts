import { env } from "cloudflare:workers";
export class PublicFormError extends Error { constructor(message:string,public status=400){super(message)} }
export const noStore = { "cache-control": "no-store" };
export async function publicSchool() {
 const rows=await env.DB.prepare("SELECT id FROM organizations WHERE status='active' AND lower(trim(name))='the mentor school' LIMIT 2").all<{id:string}>();
 if(rows.results.length!==1)throw new PublicFormError("Online submissions are temporarily unavailable. Please contact the school.",503);
 return rows.results[0].id;
}
export function sameOrigin(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)throw new PublicFormError("Please submit this form from the school website.",403);
}
export async function boundedBody(request:Request,limit:number){
 if(Number(request.headers.get("content-length"))>limit)throw new PublicFormError("The upload is too large.",413);
 const reader=request.body?.getReader();if(!reader)throw new PublicFormError("Empty request.");
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new PublicFormError("The upload is too large.",413)}chunks.push(value)}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return bytes;
}
export async function publicLimit(request:Request,org:string,kind:string,max:number){
 const ip=request.headers.get("cf-connecting-ip")||"unknown";
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${org}:${kind}:${ip}`));
 const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");const now=Date.now();
 const row=await env.DB.prepare("INSERT INTO public_form_limits (key,attempts,expires_at) VALUES (?1,1,?2) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=?3 THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=?3 THEN ?2 ELSE expires_at END RETURNING attempts").bind(key,now+3600000,now).first<{attempts:number}>();
 if((row?.attempts??max+1)>max)throw new PublicFormError("Too many submissions. Please try again in an hour or contact the school.",429);
}
export function fail(error:unknown){if(error instanceof SyntaxError)return Response.json({error:"Invalid form data."},{status:400,headers:noStore});if(error instanceof PublicFormError)return Response.json({error:error.message},{status:error.status,headers:noStore});console.error("Public school form failed",error);return Response.json({error:"Unable to save right now. Your form is still here; please try again."},{status:503,headers:noStore})}
export const text=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";
