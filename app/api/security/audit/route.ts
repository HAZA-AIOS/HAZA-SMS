import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";

export const dynamic="force-dynamic";
const clean=(value:string|null,length=80)=>(value??"").trim().slice(0,length);
export async function GET(request:Request){
  const auth=await authorize("audit.view");
  if(!auth)return Response.json({error:"You do not have permission to view audit history."},{status:403});
  const url=new URL(request.url),action=clean(url.searchParams.get("action")),campusId=clean(url.searchParams.get("campusId")),outcome=clean(url.searchParams.get("outcome"),20);
  if(campusId){const campus=await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2").bind(campusId,auth.organizationId).first();if(!campus)return Response.json({error:"Campus not found."},{status:404});}
  const result=await env.DB.prepare(`SELECT a.id,a.action,a.entity_type,a.entity_id,a.outcome,a.created_at,u.display_name actor_name,c.name campus_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN campuses c ON c.id=a.campus_id WHERE a.organization_id=?1 AND (?2='' OR a.action LIKE '%'||?2||'%') AND (?3='' OR a.campus_id=?3) AND (?4='' OR a.outcome=?4) ORDER BY a.created_at DESC LIMIT 200`).bind(auth.organizationId,action,campusId,outcome).all();
  return Response.json({logs:result.results});
}
