import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";
import { requireSameOrigin } from "../../../lib/security";

export const dynamic="force-dynamic";

export async function GET(){
  const auth=await authorize();
  if(!auth)return Response.json({error:"Sign in to view notifications."},{status:403});
  const [notifications,unread]=await Promise.all([
    env.DB.prepare("SELECT id,event_code,title,body,entity_type,entity_id,read_at,created_at FROM user_notifications WHERE organization_id=?1 AND user_id=?2 ORDER BY created_at DESC LIMIT 20").bind(auth.organizationId,auth.userId).all(),
    env.DB.prepare("SELECT count(*) value FROM user_notifications WHERE organization_id=?1 AND user_id=?2 AND read_at IS NULL").bind(auth.organizationId,auth.userId).first<{value:number}>(),
  ]);
  return Response.json({notifications:notifications.results,unread:unread?.value??0},{headers:{"cache-control":"private, no-store"}});
}

export async function PATCH(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize();
  if(!auth)return Response.json({error:"Sign in to manage notifications."},{status:403});
  await env.DB.prepare("UPDATE user_notifications SET read_at=COALESCE(read_at,unixepoch()*1000),updated_at=unixepoch()*1000 WHERE organization_id=?1 AND user_id=?2 AND read_at IS NULL").bind(auth.organizationId,auth.userId).run();
  return Response.json({ok:true});
}
