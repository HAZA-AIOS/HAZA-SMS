import { cookies } from "next/headers";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { authorize, getOrganizationChoices } from "../../../../lib/authorization";
import { requireSameOrigin } from "../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown)=>typeof value==="string"?value.trim().slice(0,100):"";

export async function GET(){
  const choices=await getOrganizationChoices();
  const auth=await authorize();
  return Response.json({organizations:choices,campuses:auth?.campuses??[],activeOrganizationId:auth?.organizationId??null,activeCampusId:auth?.activeCampusId??null,organizationWide:auth?.organizationWide??false},{headers:{"cache-control":"private, no-store"}});
}

export async function POST(request:Request){
  const origin=requireSameOrigin(request);if(origin)return origin;
  const identity=await getChatGPTUser();if(!identity)return Response.json({error:"Sign in is required."},{status:401});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const organizationId=clean(body?.organizationId),campusId=clean(body?.campusId);
  const choices=await getOrganizationChoices();
  if(organizationId){
    if(!choices.some(choice=>choice.organizationId===organizationId))return Response.json({error:"School access denied."},{status:403});
    const jar=await cookies();jar.set("sms_active_organization",organizationId,{httpOnly:true,sameSite:"strict",secure:true,path:"/",maxAge:60*60*24*30});jar.set("sms_active_campus","",{httpOnly:true,sameSite:"strict",secure:true,path:"/",maxAge:0});
    return Response.json({ok:true});
  }
  const auth=await authorize();if(!auth)return Response.json({error:"Select an authorized school first."},{status:403});
  if(campusId==="all"){
    if(!auth.organizationWide)return Response.json({error:"All-campus access is not permitted for this account."},{status:403});
  }else if(!auth.allowedCampusIds.has(campusId))return Response.json({error:"Campus access denied."},{status:403});
  const jar=await cookies();jar.set("sms_active_campus",campusId,{httpOnly:true,sameSite:"strict",secure:true,path:"/",maxAge:60*60*24*30});
  await env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'session.campus.select','campus',?5,'success')").bind(crypto.randomUUID(),auth.organizationId,campusId==="all"?null:campusId,auth.userId,campusId).run();
  return Response.json({ok:true});
}
