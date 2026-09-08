import { env } from "cloudflare:workers";
import { authorize } from "../../../lib/authorization";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const auth=await authorize("analytics.view"); if(!auth)return Response.json({error:"You do not have permission to view analytics."},{status:403});
 const c=auth.activeCampusId, bind=(sql:string)=>env.DB.prepare(sql).bind(auth.organizationId,c);
 const [students,staff,attendance,fees,results,operations,classes]=await Promise.all([
  bind("SELECT count(*) value FROM students WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR home_campus_id=?2)").first<{value:number}>(),
  bind("SELECT count(*) value FROM staff WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR campus_id=?2)").first<{value:number}>(),
  bind("SELECT coalesce(sum(present_count),0) present,coalesce(sum(student_count),0) total FROM student_attendance_sessions WHERE organization_id=?1 AND (?2 IS NULL OR campus_id=?2)").first<{present:number;total:number}>(),
  bind("SELECT coalesce(sum(total_amount),0) billed,coalesce(sum(paid_amount),0) paid,coalesce(sum(balance_amount),0) balance FROM fee_invoices WHERE organization_id=?1 AND (?2 IS NULL OR campus_id=?2)").first<{billed:number;paid:number;balance:number}>(),
  bind("SELECT round(avg(CASE WHEN maximum_marks>0 THEN marks_obtained*100.0/maximum_marks END),1) average,count(*) results FROM assessment_marks m JOIN assessments a ON a.id=m.assessment_id WHERE m.organization_id=?1 AND (?2 IS NULL OR a.campus_id=?2) AND m.status IN ('approved','published')").first<{average:number|null;results:number}>(),
  bind("SELECT count(*) total,sum(CASE WHEN status IN ('open','in_progress','issued','scheduled') THEN 1 ELSE 0 END) active FROM operation_records WHERE organization_id=?1 AND (?2 IS NULL OR campus_id=?2 OR campus_id IS NULL)").first<{total:number;active:number}>(),
  bind("SELECT c.name,count(DISTINCT e.student_id) students FROM classes c LEFT JOIN enrollments e ON e.class_id=c.id AND e.status='active' WHERE c.organization_id=?1 AND (?2 IS NULL OR c.campus_id=?2 OR c.campus_id IS NULL) GROUP BY c.id,c.name ORDER BY students DESC LIMIT 12").all<{name:string;students:number}>(),
 ]);
 const payload={campus:auth.activeCampusId?auth.campuses.find(x=>x.id===auth.activeCampusId)?.name:"All campuses",students:students?.value||0,staff:staff?.value||0,attendanceRate:attendance?.total?Math.round(attendance.present*1000/attendance.total)/10:0,fees:fees||{billed:0,paid:0,balance:0},results:results||{average:0,results:0},operations:operations||{total:0,active:0},classes:classes.results,generatedAt:Date.now()};
 if(new URL(request.url).searchParams.get("format")==="csv"&&auth.permissions.has("analytics.export")){const rows=["Metric,Value",`Students,${payload.students}`,`Staff,${payload.staff}`,`Attendance rate,${payload.attendanceRate}%`,`Fees billed,${payload.fees.billed}`,`Fees collected,${payload.fees.paid}`,`Outstanding fees,${payload.fees.balance}`,`Average result,${payload.results.average||0}%`,`Active operations,${payload.operations.active||0}`];return new Response(rows.join("\n"),{headers:{"content-type":"text/csv","content-disposition":"attachment; filename=school-analytics.csv"}})}
 return Response.json({...payload,canExport:auth.permissions.has("analytics.export")},{headers:{"cache-control":"private, no-store"}});
}
