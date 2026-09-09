import { env } from "cloudflare:workers";
import { publicSchool, sameOrigin, publicLimit, boundedBody, fail, noStore, text, PublicFormError } from "../../../lib/public-forms";
export const dynamic="force-dynamic";
export async function GET(){try{
 const org=await publicSchool();const [campuses,classes]=await Promise.all([
 env.DB.prepare("SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name").bind(org).all(),
 env.DB.prepare("SELECT id,name,campus_id FROM classes WHERE organization_id=?1 AND status='active' ORDER BY name").bind(org).all()]);
 return Response.json({campuses:campuses.results,classes:classes.results},{headers:noStore});
 }catch(e){return fail(e)}}
export async function POST(request:Request){let uploadedKey:string|undefined;try{
 sameOrigin(request);const org=await publicSchool();await publicLimit(request,org,"admission",12);
 const bytes=await boundedBody(request,6*1024*1024);
 const form=await new Response(bytes,{headers:{"content-type":request.headers.get("content-type")||""}}).formData();
 const get=(key:string,max=160)=>text(form.get(key),max);
 const id=get("submissionId",36),campusId=get("campusId"),first=get("firstName",80),last=get("lastName",80),dob=get("dateOfBirth",10),gender=get("gender",20),guardian=get("guardianName",120),phone=get("phone",30),email=get("email",160),address=get("address",400),classId=get("classId"),requestedClass=get("requestedClass",80),relationship=get("relationship",40);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!first||!guardian||!address||!relationship||!/^[+\d\s()-]{7,30}$/.test(phone)||!['male','female','other'].includes(gender)||form.get("consent")!=="on"||get("website"))throw new PublicFormError("Complete all required student, guardian and consent fields.");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!Number.isFinite(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||dob>=new Date().toISOString().slice(0,10)||dob<'1990-01-01')throw new PublicFormError("Enter a valid date of birth.");
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new PublicFormError("Enter a valid email address.");
 const campus=await env.DB.prepare("SELECT id FROM campuses WHERE id=?1 AND organization_id=?2 AND status='active'").bind(campusId,org).first();if(!campus)throw new PublicFormError("Choose an available campus.");
 if(classId){const cl=await env.DB.prepare("SELECT id FROM classes WHERE id=?1 AND organization_id=?2 AND (campus_id IS NULL OR campus_id=?3) AND status='active'").bind(classId,org,campusId).first();if(!cl)throw new PublicFormError("Choose an available class for this campus.")}else if(!requestedClass)throw new PublicFormError("Enter the class you are applying for.");
 const reference=`WEB-${id.toUpperCase()}`;
 const existing=await env.DB.prepare("SELECT id FROM admission_applications WHERE id=?1 AND organization_id=?2").bind(id,org).first();if(existing)return Response.json({ok:true,reference,status:"submitted"},{headers:noStore});
 const year=await env.DB.prepare("SELECT id FROM academic_years WHERE organization_id=?1 AND is_current=1 ORDER BY starts_on DESC LIMIT 1").bind(org).first<{id:string}>();
 // A disabled, identity-free service actor records anonymous website origin; it has no memberships or login credentials.
 const actor=`public-admissions:${org}`;
 const statements=[env.DB.prepare("INSERT INTO users (id,email,display_name,status) VALUES (?1,?2,'Public admission form','disabled') ON CONFLICT(id) DO NOTHING").bind(actor,`${actor}@system.invalid`),
 env.DB.prepare("INSERT INTO admission_applications (id,organization_id,campus_id,application_number,child_first_name,child_last_name,date_of_birth,gender,applying_class_id,academic_year_id,guardian_name,primary_phone,email,status,submitted_on,notes,created_by,guardian_relationship,address,declaration_accepted,previous_school) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,'submitted',?14,?15,?16,?17,?18,1,?19)").bind(id,org,campusId,reference,first,last||null,dob,gender,classId||null,year?.id??null,guardian,phone,email||null,new Date().toISOString().slice(0,10),`Online parent application. Requested class: ${requestedClass||'selected above'}. ${get('notes',600)}`,actor,relationship,address,get('previousSchool',160)||null)];
 const file=form.get("photo");
 if(file instanceof File&&file.size){
 if(file.size>5*1024*1024)throw new PublicFormError("Choose a student photo up to 5 MB.");const data=new Uint8Array(await file.arrayBuffer());
 const jpeg=data[0]===255&&data[1]===216&&data[2]===255,png=[137,80,78,71,13,10,26,10].every((v,i)=>data[i]===v);
 if(!jpeg&&!png)throw new PublicFormError("Use a JPEG or PNG student photo.");
 const asset=crypto.randomUUID(),type=jpeg?'image/jpeg':'image/png',name=jpeg?'student-photo.jpg':'student-photo.png';uploadedKey=`organizations/${org}/admissions/${id}/student_photo/${asset}`;
 await env.BUCKET.put(uploadedKey,data,{httpMetadata:{contentType:type}});
 statements.push(env.DB.prepare("INSERT INTO storage_assets (id,organization_id,campus_id,asset_type,r2_key,original_name,content_type,size_bytes,uploaded_by) VALUES (?1,?2,?3,'admission_document',?4,?5,?6,?7,?8)").bind(asset,org,campusId,uploadedKey,name,type,file.size,actor),env.DB.prepare("INSERT INTO admission_documents (id,organization_id,application_id,asset_id,document_type,title,verification_status) VALUES (?1,?2,?3,?4,'student_photo','Student photo','pending')").bind(crypto.randomUUID(),org,id,asset));
 }
 statements.push(env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,NULL,'admission.public.submit','admission_application',?4,'success',?5)").bind(crypto.randomUUID(),org,campusId,id,JSON.stringify({source:'public_website',reference})));
 await env.DB.batch(statements);uploadedKey=undefined;
 return Response.json({ok:true,reference,status:"submitted"},{status:201,headers:noStore});
 }catch(e){if(uploadedKey)await env.BUCKET.delete(uploadedKey).catch(()=>{});return fail(e)}}
