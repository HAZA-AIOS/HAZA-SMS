import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../../lib/authorization";
import { enforceRateLimit } from "../../../../lib/security";

export const dynamic="force-dynamic";
const clean=(v:unknown,n=160)=>typeof v==="string"?v.trim().slice(0,n):"";

export async function POST(request:Request){
  const auth=await authorize("users.create");
  if(!auth) return Response.json({error:"You do not have permission to invite users."},{status:403});
  if(!await enforceRateLimit(auth,"user.invite",15,300)) return Response.json({error:"Invitation limit reached. Try again later."},{status:429});
  if(request.headers.get("sec-fetch-site")&&request.headers.get("sec-fetch-site")!=="same-origin") return Response.json({error:"Cross-site requests are blocked."},{status:403});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const email=clean(body?.email).toLowerCase(),displayName=clean(body?.displayName),roleId=clean(body?.roleId),campusId=clean(body?.campusId);
  if(!/^\S+@\S+\.\S+$/.test(email)||!displayName||!roleId) return Response.json({error:"Enter a valid name, email and role."},{status:400});
  const role=await env.DB.prepare("SELECT id,scope FROM roles WHERE id=?1 AND organization_id=?2").bind(roleId,auth.organizationId).first<{id:string;scope:string}>();
  if(!role) return Response.json({error:"The selected role is invalid."},{status:400});
  if(role.scope!=="organization"&&!campusId)return Response.json({error:"A campus is required for this scoped role."},{status:400});
  if(campusId){const campus=await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2 AND status='active'").bind(campusId,auth.organizationId).first();if(!campus)return Response.json({error:"The selected campus is invalid."},{status:400});const denied=await requireCampusAccess(auth,campusId,"user.invite.campus");if(denied)return denied;}
  const target=await env.DB.prepare("SELECT id FROM users WHERE lower(email)=?1").bind(email).first<{id:string}>();
  const userId=target?.id??crypto.randomUUID();
  const duplicate=await env.DB.prepare("SELECT id FROM organization_memberships WHERE organization_id=?1 AND user_id=?2").bind(auth.organizationId,userId).first();
  if(duplicate) return Response.json({error:"This user already belongs to the school."},{status:409});
  const membershipId=crypto.randomUUID();
  const statements=[];
  if(!target) statements.push(env.DB.prepare("INSERT INTO users (id,email,display_name,status) VALUES (?1,?2,?3,'invited')").bind(userId,email,displayName));
  statements.push(
    env.DB.prepare("INSERT INTO organization_memberships (id,organization_id,user_id,status) VALUES (?1,?2,?3,'invited')").bind(membershipId,auth.organizationId,userId),
    env.DB.prepare("INSERT INTO membership_roles (membership_id,role_id,campus_id,assigned_by) VALUES (?1,?2,?3,?4)").bind(membershipId,roleId,campusId||null,auth.userId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'user.invite','organization_membership',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,campusId||null,auth.userId,membershipId,JSON.stringify({email,roleId}))
  );
  if(campusId)statements.push(env.DB.prepare("INSERT INTO campus_memberships (membership_id,campus_id) VALUES (?1,?2)").bind(membershipId,campusId));
  await env.DB.batch(statements);
  return Response.json({ok:true});
}
