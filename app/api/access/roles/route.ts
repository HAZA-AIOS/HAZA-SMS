import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { enforceRateLimit } from "../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(v:unknown,n=100)=>typeof v==="string"?v.trim().slice(0,n):"";

export async function POST(request:Request){
  const auth=await authorize("roles.manage");
  if(!auth) return Response.json({error:"You do not have permission to create roles."},{status:403});
  if(!await enforceRateLimit(auth,"role.create",10,300)) return Response.json({error:"Role creation limit reached. Try again later."},{status:429});
  if(request.headers.get("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin") return Response.json({error:"Cross-site requests are blocked."},{status:403});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const name=clean(body?.name),scope=clean(body?.scope),permissionCode=clean(body?.permissionCode);
  if(name.length<3||!["organization","campus","class","self"].includes(scope)) return Response.json({error:"Enter a valid role name and scope."},{status:400});
  const permission=await env.DB.prepare("SELECT id FROM permissions WHERE code=?1").bind(permissionCode).first<{id:string}>();
  if(!permission) return Response.json({error:"The selected permission is invalid."},{status:400});
  const key=name.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,48);
  const exists=await env.DB.prepare("SELECT id FROM roles WHERE organization_id=?1 AND key=?2").bind(auth.organizationId,key).first();
  if(exists) return Response.json({error:"A role with this name already exists."},{status:409});
  const roleId=crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO roles (id,organization_id,key,name,scope,is_system) VALUES (?1,?2,?3,?4,?5,0)").bind(roleId,auth.organizationId,key,name,scope),
    env.DB.prepare("INSERT INTO role_permissions (role_id,permission_id) VALUES (?1,?2)").bind(roleId,permission.id),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'role.create','role',?4,'success',?5)").bind(crypto.randomUUID(),auth.organizationId,auth.userId,roleId,JSON.stringify({name,scope,permissionCode})),
  ]);
  return Response.json({ok:true});
}
