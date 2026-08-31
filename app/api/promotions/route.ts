import { env } from "cloudflare:workers";
import { authorize, requireCampusAccess } from "../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin, safeMetadata } from "../../../lib/security";

export const dynamic="force-dynamic";
const clean=(value:unknown,length=300)=>typeof value==="string"?value.trim().slice(0,length):"";
const outcomes=new Set(["promote","retain","graduate","withdraw"]);
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);

async function owned(table:"academic_years"|"campuses"|"classes"|"sections",id:string,organizationId:string){
  return env.DB.prepare(`SELECT * FROM ${table} WHERE id=?1 AND organization_id=?2`).bind(id,organizationId).first<Record<string,unknown>>();
}

export async function GET(request:Request){
  const auth=await authorize("promotions.view");if(!auth)return Response.json({error:"You do not have permission to view promotions."},{status:403});
  const batchId=clean(new URL(request.url).searchParams.get("batchId"));
  const campusId=auth.activeCampusId;
  const [years,campuses,classes,sections,rules,batches,decisions]=await Promise.all([
    env.DB.prepare("SELECT id,name,starts_on,ends_on,is_current,status FROM academic_years WHERE organization_id=?1 ORDER BY starts_on DESC").bind(auth.organizationId).all(),
    env.DB.prepare("SELECT id,name,code,is_main FROM campuses WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR id=?2) ORDER BY is_main DESC,name").bind(auth.organizationId,campusId).all(),
    env.DB.prepare("SELECT id,name,code,campus_id,grade_level_id,sort_order FROM classes WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR campus_id IS NULL OR campus_id=?2) ORDER BY sort_order,name").bind(auth.organizationId,campusId).all(),
    env.DB.prepare("SELECT id,name,code,campus_id,class_id FROM sections WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR campus_id=?2) ORDER BY name").bind(auth.organizationId,campusId).all(),
    env.DB.prepare(`SELECT r.*,c.name campus_name,sc.name source_class_name,tc.name target_class_name,ts.name target_section_name FROM promotion_rules r JOIN campuses c ON c.id=r.campus_id JOIN classes sc ON sc.id=r.source_class_id LEFT JOIN classes tc ON tc.id=r.target_class_id LEFT JOIN sections ts ON ts.id=r.target_section_id WHERE r.organization_id=?1 AND (?2 IS NULL OR r.campus_id=?2) ORDER BY sc.sort_order,sc.name`).bind(auth.organizationId,campusId).all(),
    env.DB.prepare(`SELECT b.*,c.name campus_name,sy.name source_year_name,ty.name target_year_name,cl.name source_class_name,u.display_name created_by_name,ap.display_name applied_by_name FROM promotion_batches b JOIN campuses c ON c.id=b.campus_id JOIN academic_years sy ON sy.id=b.source_academic_year_id JOIN academic_years ty ON ty.id=b.target_academic_year_id JOIN classes cl ON cl.id=b.source_class_id JOIN users u ON u.id=b.created_by LEFT JOIN users ap ON ap.id=b.applied_by WHERE b.organization_id=?1 AND (?2 IS NULL OR b.campus_id=?2) ORDER BY b.created_at DESC LIMIT 30`).bind(auth.organizationId,campusId).all(),
    batchId?env.DB.prepare(`SELECT d.*,s.admission_number,s.first_name,s.last_name,cl.name current_class_name,tc.name target_class_name,ts.name target_section_name FROM promotion_decisions d JOIN students s ON s.id=d.student_id JOIN enrollments e ON e.id=d.current_enrollment_id LEFT JOIN classes cl ON cl.id=e.class_id LEFT JOIN classes tc ON tc.id=d.target_class_id LEFT JOIN sections ts ON ts.id=d.target_section_id JOIN promotion_batches b ON b.id=d.batch_id WHERE d.batch_id=?1 AND d.organization_id=?2 AND b.organization_id=?2 ORDER BY s.first_name,s.last_name`).bind(batchId,auth.organizationId).all():Promise.resolve({results:[]}),
  ]);
  return Response.json({academicYears:years.results,campuses:campuses.results,classes:classes.results,sections:sections.results,rules:rules.results,batches:batches.results,decisions:decisions.results,canManage:auth.permissions.has("promotions.manage"),canApply:auth.permissions.has("promotions.apply")},{headers:{"cache-control":"private, no-store"}});
}

export async function POST(request:Request){
  const origin=requireSameOrigin(request);if(origin)return origin;
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null,action=clean(body?.action,30);
  const auth=await authorize(action==="apply_batch"?"promotions.apply":"promotions.manage");if(!auth)return Response.json({error:"You do not have permission to manage promotions."},{status:403});
  if(!await enforceRateLimit(auth,"promotion.change",30,300))return Response.json({error:"Promotion change limit reached. Try again later."},{status:429});
  if(action==="create_rule"){
    const campusId=clean(body?.campusId),sourceClassId=clean(body?.sourceClassId),targetClassId=clean(body?.targetClassId),targetSectionId=clean(body?.targetSectionId),outcome=clean(body?.outcome,20)||"promote";
    if(!campusId||!sourceClassId||!outcomes.has(outcome)||!["promote","retain","graduate"].includes(outcome))return Response.json({error:"Complete the promotion rule."},{status:400});
    const denied=await requireCampusAccess(auth,campusId,"promotion.rule.create");if(denied)return denied;
    const [campus,source,target,section]=await Promise.all([owned("campuses",campusId,auth.organizationId),owned("classes",sourceClassId,auth.organizationId),targetClassId?owned("classes",targetClassId,auth.organizationId):null,targetSectionId?owned("sections",targetSectionId,auth.organizationId):null]);
    if(!campus||!source||outcome!=="graduate"&&!target||target&&target.campus_id&&target.campus_id!==campusId||section&&(section.campus_id!==campusId||section.class_id!==targetClassId))return Response.json({error:"Select valid classes and section for this campus."},{status:400});
    const id=crypto.randomUUID();
    try{await env.DB.batch([
      env.DB.prepare("INSERT INTO promotion_rules (id,organization_id,campus_id,source_class_id,target_class_id,target_section_id,default_outcome,status,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,'active',?8)").bind(id,auth.organizationId,campusId,sourceClassId,outcome==="graduate"?null:targetClassId,outcome==="graduate"?null:targetSectionId||null,outcome,auth.userId),
      env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'promotion.rule.create','promotion_rule',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,campusId,auth.userId,id,safeMetadata({sourceClassId,targetClassId,outcome})),
    ]);return Response.json({ok:true,id});}catch{return Response.json({error:"A promotion rule already exists for this campus and class."},{status:409});}
  }
  if(action==="create_batch"){
    const campusId=clean(body?.campusId),sourceYearId=clean(body?.sourceAcademicYearId),targetYearId=clean(body?.targetAcademicYearId),sourceClassId=clean(body?.sourceClassId),effectiveOn=clean(body?.effectiveOn,10);
    if(!campusId||!sourceYearId||!targetYearId||sourceYearId===targetYearId||!sourceClassId||!validDate(effectiveOn))return Response.json({error:"Select different source and target years, a class and effective date."},{status:400});
    const denied=await requireCampusAccess(auth,campusId,"promotion.batch.preview");if(denied)return denied;
    const [sourceYear,targetYear,sourceClass,rule]=await Promise.all([owned("academic_years",sourceYearId,auth.organizationId),owned("academic_years",targetYearId,auth.organizationId),owned("classes",sourceClassId,auth.organizationId),env.DB.prepare("SELECT * FROM promotion_rules WHERE organization_id=?1 AND campus_id=?2 AND source_class_id=?3 AND status='active'").bind(auth.organizationId,campusId,sourceClassId).first<Record<string,unknown>>()]);
    if(!sourceYear||!targetYear||!sourceClass||!rule)return Response.json({error:"Create an active promotion rule for the selected class first."},{status:400});
    const candidates=await env.DB.prepare(`SELECT e.id enrollment_id,e.student_id FROM enrollments e JOIN students s ON s.id=e.student_id AND s.organization_id=e.organization_id WHERE e.organization_id=?1 AND e.academic_year_id=?2 AND e.campus_id=?3 AND e.class_id=?4 AND e.status='active' AND s.enrollment_status='active' ORDER BY s.first_name,s.last_name LIMIT 250`).bind(auth.organizationId,sourceYearId,campusId,sourceClassId).all<{enrollment_id:string;student_id:string}>();
    if(!candidates.results.length)return Response.json({error:"No active students were found in the selected class."},{status:404});
    const existing=await env.DB.prepare(`SELECT count(*) value FROM enrollments WHERE organization_id=?1 AND academic_year_id=?2 AND student_id IN (SELECT student_id FROM enrollments WHERE organization_id=?1 AND academic_year_id=?3 AND campus_id=?4 AND class_id=?5 AND status='active')`).bind(auth.organizationId,targetYearId,sourceYearId,campusId,sourceClassId).first<{value:number}>();
    if((existing?.value??0)>0)return Response.json({error:"One or more students already have an enrollment in the target academic year."},{status:409});
    const batchId=crypto.randomUUID(),outcome=String(rule.default_outcome),statements=[env.DB.prepare("INSERT INTO promotion_batches (id,organization_id,campus_id,source_academic_year_id,target_academic_year_id,source_class_id,effective_on,status,student_count,created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,'draft',?8,?9)").bind(batchId,auth.organizationId,campusId,sourceYearId,targetYearId,sourceClassId,effectiveOn,candidates.results.length,auth.userId)];
    for(const candidate of candidates.results)statements.push(env.DB.prepare("INSERT INTO promotion_decisions (id,organization_id,batch_id,student_id,current_enrollment_id,outcome,target_campus_id,target_class_id,target_section_id,status) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'draft')").bind(crypto.randomUUID(),auth.organizationId,batchId,candidate.student_id,candidate.enrollment_id,outcome,outcome==="graduate"?null:campusId,outcome==="graduate"?null:rule.target_class_id,outcome==="graduate"?null:rule.target_section_id));
    statements.push(env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'promotion.batch.preview','promotion_batch',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,campusId,auth.userId,batchId,safeMetadata({studentCount:candidates.results.length,sourceYearId,targetYearId,sourceClassId})));
    await env.DB.batch(statements);return Response.json({ok:true,batchId,studentCount:candidates.results.length});
  }
  if(action==="apply_batch"){
    const batchId=clean(body?.batchId),batch=await env.DB.prepare("SELECT * FROM promotion_batches WHERE id=?1 AND organization_id=?2").bind(batchId,auth.organizationId).first<Record<string,unknown>>();
    if(!batch||batch.status!=="draft")return Response.json({error:"Only a draft promotion batch can be applied."},{status:409});
    const denied=await requireCampusAccess(auth,String(batch.campus_id),"promotion.batch.apply");if(denied)return denied;
    const decisions=await env.DB.prepare("SELECT * FROM promotion_decisions WHERE batch_id=?1 AND organization_id=?2 AND status='draft'").bind(batchId,auth.organizationId).all<Record<string,unknown>>();if(!decisions.results.length)return Response.json({error:"This batch has no pending students."},{status:409});
    const targetConflicts=await env.DB.prepare("SELECT count(*) value FROM enrollments WHERE organization_id=?1 AND academic_year_id=?2 AND student_id IN (SELECT student_id FROM promotion_decisions WHERE batch_id=?3 AND organization_id=?1)").bind(auth.organizationId,batch.target_academic_year_id,batchId).first<{value:number}>();if((targetConflicts?.value??0)>0)return Response.json({error:"A target-year enrollment now exists for one or more students. Review the batch again."},{status:409});
    const statements=[];
    for(const decision of decisions.results){
      const outcome=String(decision.outcome),studentId=String(decision.student_id),currentId=String(decision.current_enrollment_id),eventId=crypto.randomUUID();
      if(!outcomes.has(outcome))return Response.json({error:"The batch contains an invalid student outcome."},{status:400});
      if(outcome==="graduate"||outcome==="withdraw"){
        const status=outcome==="graduate"?"graduated":"withdrawn";statements.push(env.DB.prepare("UPDATE enrollments SET status=?1,ended_on=?2,updated_at=unixepoch()*1000 WHERE id=?3 AND organization_id=?4").bind(status,batch.effective_on,currentId,auth.organizationId),env.DB.prepare("UPDATE students SET enrollment_status=?1,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(status,studentId,auth.organizationId));
      }else{
        if(!decision.target_campus_id||!decision.target_class_id)return Response.json({error:"Every promoted or retained student needs a target class."},{status:400});
        const targetDenied=await requireCampusAccess(auth,String(decision.target_campus_id),"promotion.student.target");if(targetDenied)return targetDenied;
        statements.push(env.DB.prepare("UPDATE enrollments SET status='completed',ended_on=?1,updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(batch.effective_on,currentId,auth.organizationId),env.DB.prepare("INSERT INTO enrollments (id,organization_id,student_id,academic_year_id,campus_id,class_id,section_id,status,enrolled_on) VALUES (?1,?2,?3,?4,?5,?6,?7,'active',?8)").bind(crypto.randomUUID(),auth.organizationId,studentId,batch.target_academic_year_id,decision.target_campus_id,decision.target_class_id,decision.target_section_id,batch.effective_on),env.DB.prepare("UPDATE students SET home_campus_id=?1,enrollment_status='active',updated_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3").bind(decision.target_campus_id,studentId,auth.organizationId));
      }
      statements.push(env.DB.prepare("INSERT INTO enrollment_events (id,organization_id,student_id,enrollment_id,event_type,from_campus_id,to_campus_id,from_class_id,to_class_id,effective_on,reason,notes,performed_by) SELECT ?1,?2,?3,?4,?5,e.campus_id,?6,e.class_id,?7,?8,?9,?10,?11 FROM enrollments e WHERE e.id=?4 AND e.organization_id=?2").bind(eventId,auth.organizationId,studentId,currentId,outcome,decision.target_campus_id,decision.target_class_id,batch.effective_on,decision.reason||null,`Promotion batch ${batchId}`,auth.userId),env.DB.prepare("UPDATE promotion_decisions SET status='applied',updated_at=unixepoch()*1000 WHERE id=?1 AND organization_id=?2").bind(decision.id,auth.organizationId));
    }
    statements.push(env.DB.prepare("UPDATE promotion_batches SET status='applied',applied_by=?1,applied_at=?2,updated_at=unixepoch()*1000 WHERE id=?3 AND organization_id=?4").bind(auth.userId,Date.now(),batchId,auth.organizationId),env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'promotion.batch.apply','promotion_batch',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,batch.campus_id,auth.userId,batchId,safeMetadata({studentCount:decisions.results.length,targetAcademicYearId:batch.target_academic_year_id})));
    await env.DB.batch(statements);return Response.json({ok:true,applied:decisions.results.length});
  }
  return Response.json({error:"Invalid promotion action."},{status:400});
}

export async function PATCH(request:Request){
  const origin=requireSameOrigin(request);if(origin)return origin;
  const auth=await authorize("promotions.manage");if(!auth)return Response.json({error:"You do not have permission to edit promotion decisions."},{status:403});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null,decisionId=clean(body?.decisionId),outcome=clean(body?.outcome,20),targetClassId=clean(body?.targetClassId),targetSectionId=clean(body?.targetSectionId),reason=clean(body?.reason,500);
  if(!decisionId||!outcomes.has(outcome))return Response.json({error:"Select a valid promotion outcome."},{status:400});
  const row=await env.DB.prepare("SELECT d.*,b.campus_id,b.status batch_status FROM promotion_decisions d JOIN promotion_batches b ON b.id=d.batch_id AND b.organization_id=d.organization_id WHERE d.id=?1 AND d.organization_id=?2").bind(decisionId,auth.organizationId).first<Record<string,unknown>>();if(!row||row.batch_status!=="draft")return Response.json({error:"Only draft decisions can be changed."},{status:409});
  const denied=await requireCampusAccess(auth,String(row.campus_id),"promotion.decision.update");if(denied)return denied;
  if(outcome==="promote"||outcome==="retain"){
    const target=await owned("classes",targetClassId,auth.organizationId);if(!target||target.campus_id&&target.campus_id!==row.campus_id)return Response.json({error:"Select a valid target class."},{status:400});
    if(targetSectionId){const section=await owned("sections",targetSectionId,auth.organizationId);if(!section||section.class_id!==targetClassId||section.campus_id!==row.campus_id)return Response.json({error:"Select a valid target section."},{status:400});}
  }
  await env.DB.batch([env.DB.prepare("UPDATE promotion_decisions SET outcome=?1,target_campus_id=?2,target_class_id=?3,target_section_id=?4,reason=?5,updated_at=unixepoch()*1000 WHERE id=?6 AND organization_id=?7").bind(outcome,["graduate","withdraw"].includes(outcome)?null:row.campus_id,["graduate","withdraw"].includes(outcome)?null:targetClassId,["graduate","withdraw"].includes(outcome)?null:targetSectionId||null,reason||null,decisionId,auth.organizationId),env.DB.prepare("INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,?4,'promotion.decision.update','promotion_decision',?5,'success',?6)").bind(crypto.randomUUID(),auth.organizationId,row.campus_id,auth.userId,decisionId,safeMetadata({outcome,targetClassId}))]);
  return Response.json({ok:true});
}
