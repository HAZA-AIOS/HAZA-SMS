import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { requireSameOrigin } from "../../../../lib/security";
export const dynamic="force-dynamic";
const clean=(v:unknown,n=500)=>typeof v==="string"?v.trim().slice(0,n):"";
export async function PUT(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("settings.edit"); if(!auth)return Response.json({error:"You do not have permission to edit school settings."},{status:403});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const name=clean(body?.name,120),abbreviation=clean(body?.abbreviation,12).toUpperCase(),institutionType=clean(body?.institutionType,24);
  if(name.length<3||!["school","academy","college"].includes(institutionType))return Response.json({error:"Enter valid school information."},{status:400});
  const values={name,abbreviation,institutionType,tagline:clean(body?.tagline,160),address:clean(body?.address),email:clean(body?.email,160),phone:clean(body?.phone,40),website:clean(body?.website,180),timezone:clean(body?.timezone,64)||"Asia/Karachi",currency:clean(body?.currency,3)||"PKR",dateInputFormat:clean(body?.dateInputFormat,24)||"DD-MM-YYYY",dateDisplayFormat:clean(body?.dateDisplayFormat,24)||"DD-MM-YYYY"};
  const previous=await env.DB.prepare("SELECT o.name,o.abbreviation,o.institution_type,s.* FROM organizations o JOIN organization_settings s ON s.organization_id=o.id WHERE o.id=?1").bind(auth.organizationId).first();
  await env.DB.batch([
    env.DB.prepare("UPDATE organizations SET name=?1,abbreviation=?2,institution_type=?3,updated_at=unixepoch()*1000 WHERE id=?4").bind(values.name,values.abbreviation,values.institutionType,auth.organizationId),
    env.DB.prepare("UPDATE organization_settings SET tagline=?1,address=?2,email=?3,phone=?4,website=?5,timezone=?6,currency=?7,date_input_format=?8,date_display_format=?9,updated_at=unixepoch()*1000 WHERE organization_id=?10").bind(values.tagline,values.address,values.email,values.phone,values.website,values.timezone,values.currency,values.dateInputFormat,values.dateDisplayFormat,auth.organizationId),
    env.DB.prepare("INSERT INTO setting_revisions (id,organization_id,setting_group,previous_value_json,new_value_json,changed_by) VALUES (?1,?2,'school_profile',?3,?4,?5)").bind(crypto.randomUUID(),auth.organizationId,JSON.stringify(previous??{}),JSON.stringify(values),auth.userId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'settings.update','organization',?2,'success')").bind(crypto.randomUUID(),auth.organizationId,auth.userId),
  ]);
  return Response.json({ok:true});
}
