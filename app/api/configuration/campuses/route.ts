import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../lib/security";
export const dynamic="force-dynamic";
const clean=(v:unknown,n=300)=>typeof v==="string"?v.trim().slice(0,n):"";
const checked=(v:unknown)=>v==="on"||v===true||v==="true";
export async function POST(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("campus.create");if(!auth)return Response.json({error:"You do not have permission to create campuses."},{status:403});
  if(!await enforceRateLimit(auth,"campus.create",10,300))return Response.json({error:"Too many campus changes. Try again later."},{status:429});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;const name=clean(body?.name,100),code=clean(body?.code,20).toUpperCase(),abbreviation=clean(body?.abbreviation,20).toUpperCase();
  if(name.length<2||!code)return Response.json({error:"Campus name and code are required."},{status:400});
  const campusId=crypto.randomUUID();
  try{await env.DB.batch([
    env.DB.prepare("INSERT INTO campuses (id,organization_id,name,code,abbreviation,is_main,status) VALUES (?1,?2,?3,?4,?5,0,'active')").bind(campusId,auth.organizationId,name,code,abbreviation),
    env.DB.prepare("INSERT INTO campus_settings (campus_id) VALUES (?1)").bind(campusId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'campus.create','campus',?3,'success')").bind(crypto.randomUUID(),auth.organizationId,campusId,auth.userId),
  ]);return Response.json({ok:true});}catch{return Response.json({error:"Campus code must be unique within the school."},{status:409});}
}
export async function PUT(request:Request){
  const sameOrigin=requireSameOrigin(request);if(sameOrigin)return sameOrigin;
  const auth=await authorize("campus.edit");if(!auth)return Response.json({error:"You do not have permission to edit campuses."},{status:403});
  if(!await enforceRateLimit(auth,"campus.edit",30,300))return Response.json({error:"Too many campus changes. Try again later."},{status:429});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;const campusId=clean(body?.campusId,80),name=clean(body?.name,100),code=clean(body?.code,20).toUpperCase(),status=clean(body?.status,20);
  const campus=await env.DB.prepare("SELECT * FROM campuses WHERE id=?1 AND organization_id=?2").bind(campusId,auth.organizationId).first<{is_main:number}>();
  if(!campus)return Response.json({error:"Campus not found."},{status:404});if(campus.is_main&&status!=="active")return Response.json({error:"The main campus must remain active."},{status:400});
  const values={name,code,status,abbreviation:clean(body?.abbreviation,20).toUpperCase(),useSchoolAddress:checked(body?.useSchoolAddress),address:clean(body?.address),useSchoolBankDetails:checked(body?.useSchoolBankDetails),useSchoolLogo1:checked(body?.useSchoolLogo1),useSchoolLogo2:checked(body?.useSchoolLogo2),useSchoolReportHeader:checked(body?.useSchoolReportHeader),useSchoolPrincipalSignature:checked(body?.useSchoolPrincipalSignature)};
  try{await env.DB.batch([
    env.DB.prepare("UPDATE campuses SET name=?1,code=?2,abbreviation=?3,status=?4,updated_at=unixepoch()*1000 WHERE id=?5").bind(values.name,values.code,values.abbreviation,values.status,campusId),
    env.DB.prepare("UPDATE campus_settings SET use_school_address=?1,address=?2,use_school_bank_details=?3,use_school_logo1=?4,use_school_logo2=?5,use_school_report_header=?6,use_school_principal_signature=?7,updated_at=unixepoch()*1000 WHERE campus_id=?8").bind(values.useSchoolAddress?1:0,values.address,values.useSchoolBankDetails?1:0,values.useSchoolLogo1?1:0,values.useSchoolLogo2?1:0,values.useSchoolReportHeader?1:0,values.useSchoolPrincipalSignature?1:0,campusId),
    env.DB.prepare("INSERT INTO setting_revisions (id,organization_id,campus_id,setting_group,new_value_json,changed_by) VALUES (?1,?2,?3,'campus_profile',?4,?5)").bind(crypto.randomUUID(),auth.organizationId,campusId,JSON.stringify(values),auth.userId),
    env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,?4,'campus.update','campus',?3,'success')").bind(crypto.randomUUID(),auth.organizationId,campusId,auth.userId),
  ]);return Response.json({ok:true});}catch{return Response.json({error:"Campus information could not be saved."},{status:409});}
}
