import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const corePermissions=[
  ["organization.view","organization","view"],["organization.edit","organization","edit"],
  ["campus.view","campus","view"],["campus.create","campus","create"],["campus.edit","campus","edit"],
  ["users.view","users","view"],["users.create","users","create"],["users.edit","users","edit"],
  ["roles.view","roles","view"],["roles.manage","roles","manage"],["audit.view","audit","view"],
] as const;

function clean(value:unknown,max=180){return typeof value==="string"?value.trim().slice(0,max):"";}
function slugify(value:string){return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,42)||"school";}

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user) return Response.json({error:"Please sign in before registering a school."},{status:401});
  if(!request.headers.get("content-type")?.includes("application/json")) return Response.json({error:"Invalid request format."},{status:415});
  const fetchSite=request.headers.get("sec-fetch-site");
  if(fetchSite&&fetchSite!=="same-origin") return Response.json({error:"Cross-site registration is not allowed."},{status:403});
  if(!env.DB) return Response.json({error:"Database service is unavailable."},{status:503});

  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const schoolName=clean(body?.schoolName,120), campusName=clean(body?.campusName,100), address=clean(body?.address,500);
  const abbreviation=clean(body?.abbreviation,12).toUpperCase(), phone=clean(body?.phone,40);
  const institutionType=clean(body?.institutionType,24)||"school", timezone=clean(body?.timezone,64)||"Asia/Karachi", currency=clean(body?.currency,3)||"PKR";
  if(schoolName.length<3||campusName.length<2||!address||!phone) return Response.json({error:"Please complete all required school details."},{status:400});

  const email=user.email.trim().toLowerCase();
  const existing=await env.DB.prepare(`
    SELECT om.id FROM users u JOIN organization_memberships om ON om.user_id=u.id
    WHERE lower(u.email)=?1 AND om.status IN ('active','invited') LIMIT 1
  `).bind(email).first();
  if(existing) return Response.json({error:"This account already belongs to a school workspace."},{status:409});

  const existingUser=await env.DB.prepare("SELECT id FROM users WHERE lower(email)=?1 LIMIT 1").bind(email).first<{id:string}>();
  const userId=existingUser?.id??crypto.randomUUID();
  const organizationId=crypto.randomUUID(), campusId=crypto.randomUUID(), membershipId=crypto.randomUUID();
  const roleId=crypto.randomUUID(), identityId=crypto.randomUUID(), auditId=crypto.randomUUID();
  const slug=`${slugify(schoolName)}-${crypto.randomUUID().slice(0,6)}`;

  const statements=[];
  if(existingUser){
    statements.push(env.DB.prepare("UPDATE users SET display_name=?1,status='active',email_verified_at=COALESCE(email_verified_at,unixepoch()*1000),updated_at=unixepoch()*1000 WHERE id=?2").bind(user.displayName,userId));
  }else{
    statements.push(env.DB.prepare("INSERT INTO users (id,email,display_name,status,email_verified_at) VALUES (?1,?2,?3,'active',unixepoch()*1000)").bind(userId,email,user.displayName));
  }
  statements.push(
    env.DB.prepare("INSERT OR IGNORE INTO user_identities (id,user_id,provider,provider_subject) VALUES (?1,?2,'chatgpt',?3)").bind(identityId,userId,email),
    env.DB.prepare("INSERT INTO organizations (id,name,slug,abbreviation,institution_type,status,owner_user_id) VALUES (?1,?2,?3,?4,?5,'active',?6)").bind(organizationId,schoolName,slug,abbreviation,institutionType,userId),
    env.DB.prepare("INSERT INTO campuses (id,organization_id,name,code,abbreviation,is_main,status) VALUES (?1,?2,?3,'MAIN',?4,1,'active')").bind(campusId,organizationId,campusName,abbreviation),
    env.DB.prepare("INSERT INTO organization_settings (organization_id,address,email,phone,timezone,currency) VALUES (?1,?2,?3,?4,?5,?6)").bind(organizationId,address,email,phone,timezone,currency),
    env.DB.prepare("INSERT INTO campus_settings (campus_id) VALUES (?1)").bind(campusId),
    env.DB.prepare("INSERT INTO organization_memberships (id,organization_id,user_id,status,joined_at) VALUES (?1,?2,?3,'active',unixepoch()*1000)").bind(membershipId,organizationId,userId),
    env.DB.prepare("INSERT INTO campus_memberships (membership_id,campus_id) VALUES (?1,?2)").bind(membershipId,campusId),
    env.DB.prepare("INSERT INTO roles (id,organization_id,key,name,scope,is_system) VALUES (?1,?2,'super_administrator','Super Administrator','organization',1)").bind(roleId,organizationId),
    env.DB.prepare("INSERT INTO membership_roles (membership_id,role_id,campus_id,assigned_by) VALUES (?1,?2,NULL,?3)").bind(membershipId,roleId,userId)
  );
  for(const [code,module,action] of corePermissions){
    const permissionId=`permission:${code}`;
    statements.push(
      env.DB.prepare("INSERT OR IGNORE INTO permissions (id,code,module,action,sensitive) VALUES (?1,?2,?3,?4,?5)").bind(permissionId,code,module,action,code==="roles.manage"||code==="audit.view"?1:0),
      env.DB.prepare("INSERT INTO role_permissions (role_id,permission_id) VALUES (?1,?2)").bind(roleId,permissionId)
    );
  }
  statements.push(env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'organization.register','organization',?2,'success',?5)").bind(auditId,organizationId,campusId,userId,JSON.stringify({provider:"chatgpt",mainCampus:campusName})));

  try{await env.DB.batch(statements);return Response.json({ok:true,organizationId});}
  catch(error){console.error("registration_failed",error);return Response.json({error:"The school workspace could not be created. Please try again."},{status:500});}
}
