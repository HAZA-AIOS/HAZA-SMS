import { env } from "cloudflare:workers";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
import DashboardShell from "./DashboardShell";
import RegistrationForm from "./RegistrationForm";
import SchoolSelectionPanel from "./SchoolSelectionPanel";
import type { AccessData } from "./AccessControlPanel";
import type { ConfigurationData } from "./ConfigurationPanel";
import type { SecurityData } from "./SecurityPanel";
import type { StudentDirectoryData } from "./StudentDirectoryPanel";
import type { AdmissionsData } from "./AdmissionsPanel";
import type { StaffDirectoryData } from "./StaffDirectoryPanel";
import type { TeachersData } from "./TeachersPanel";
import type { StaffAttendanceData } from "./StaffAttendancePanel";
import type { PayrollData } from "./PayrollPanel";
import type { AcademicsData } from "./AcademicsPanel";
import {
  acceptPendingInvitation,
  authorize,
  getOrganizationChoices,
  ensureAdmissionAccess,
  ensureConfigurationAccess,
  ensureDefaultRoles,
  ensureSecurityAccess,
  ensureStaffAccess,
  ensureStudentAccess,
  ensureTimetableAccess,
} from "../lib/authorization";

export const dynamic = "force-dynamic";

async function loadAccessData(organizationId: string): Promise<AccessData> {
  const [users, roles, permissions, campuses] = await Promise.all([
    env.DB.prepare(
      `SELECT u.id,u.display_name name,u.email,om.status,group_concat(r.name, ', ') roles FROM organization_memberships om JOIN users u ON u.id=om.user_id LEFT JOIN membership_roles mr ON mr.membership_id=om.id LEFT JOIN roles r ON r.id=mr.role_id WHERE om.organization_id=?1 GROUP BY u.id,u.display_name,u.email,om.status ORDER BY u.display_name`,
    )
      .bind(organizationId)
      .all<AccessData["users"][number]>(),
    env.DB.prepare(
      `SELECT r.id,r.name,r.scope,r.is_system,count(rp.permission_id) permission_count FROM roles r LEFT JOIN role_permissions rp ON rp.role_id=r.id WHERE r.organization_id=?1 GROUP BY r.id,r.name,r.scope,r.is_system ORDER BY r.is_system DESC,r.name`,
    )
      .bind(organizationId)
      .all<AccessData["roles"][number]>(),
    env.DB.prepare(
      "SELECT code,module,action,sensitive FROM permissions ORDER BY module,action",
    ).all<AccessData["permissions"][number]>(),
    env.DB.prepare(
      "SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name",
    )
      .bind(organizationId)
      .all<AccessData["campuses"][number]>(),
  ]);
  return {
    users: users.results,
    roles: roles.results,
    permissions: permissions.results,
    campuses: campuses.results,
  };
}

async function loadConfigurationData(
  organizationId: string,
): Promise<ConfigurationData> {
  const [school, campuses, academicYears, assets] = await Promise.all([
    env.DB.prepare(
      `SELECT o.id,o.name,o.abbreviation,o.institution_type,s.tagline,s.address,s.email,s.phone,s.website,s.timezone,s.currency,s.date_input_format,s.date_display_format FROM organizations o JOIN organization_settings s ON s.organization_id=o.id WHERE o.id=?1`,
    )
      .bind(organizationId)
      .first<ConfigurationData["school"]>(),
    env.DB.prepare(
      `SELECT c.id,c.name,c.code,c.abbreviation,c.is_main,c.status,s.use_school_address,s.address,s.use_school_bank_details,s.bank_name,s.use_school_logo1,s.use_school_logo2,s.use_school_report_header,s.use_school_principal_signature FROM campuses c JOIN campus_settings s ON s.campus_id=c.id WHERE c.organization_id=?1 ORDER BY c.is_main DESC,c.name`,
    )
      .bind(organizationId)
      .all<ConfigurationData["campuses"][number]>(),
    env.DB.prepare(
      "SELECT id,name,starts_on,ends_on,is_current,status FROM academic_years WHERE organization_id=?1 ORDER BY starts_on DESC",
    )
      .bind(organizationId)
      .all<ConfigurationData["academicYears"][number]>(),
    env.DB.prepare(
      "SELECT id,asset_type,campus_id,original_name FROM storage_assets WHERE organization_id=?1 ORDER BY created_at DESC",
    )
      .bind(organizationId)
      .all<ConfigurationData["assets"][number]>(),
  ]);
  if (!school) throw new Error("School configuration is missing.");
  return {
    school,
    campuses: campuses.results,
    academicYears: academicYears.results,
    assets: assets.results,
  };
}

async function loadSecurityData(organizationId: string): Promise<SecurityData> {
  const since = Date.now() - 86400000;
  const [logs, campuses, backups, events, failed, sensitive, lastBackup] =
    await Promise.all([
      env.DB.prepare(
        `SELECT a.id,a.action,a.entity_type,a.entity_id,a.outcome,a.created_at,u.display_name actor_name,c.name campus_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN campuses c ON c.id=a.campus_id WHERE a.organization_id=?1 ORDER BY a.created_at DESC LIMIT 100`,
      )
        .bind(organizationId)
        .all<SecurityData["logs"][number]>(),
      env.DB.prepare(
        "SELECT id,name FROM campuses WHERE organization_id=?1 ORDER BY is_main DESC,name",
      )
        .bind(organizationId)
        .all<SecurityData["campuses"][number]>(),
      env.DB.prepare(
        `SELECT b.id,b.status,b.size_bytes,b.created_at,b.completed_at,u.display_name actor_name FROM backup_runs b LEFT JOIN users u ON u.id=b.requested_by WHERE b.organization_id=?1 ORDER BY b.created_at DESC LIMIT 25`,
      )
        .bind(organizationId)
        .all<SecurityData["backups"][number]>(),
      env.DB.prepare(
        "SELECT count(*) value FROM audit_logs WHERE organization_id=?1 AND created_at>=?2",
      )
        .bind(organizationId, since)
        .first<{ value: number }>(),
      env.DB.prepare(
        "SELECT count(*) value FROM audit_logs WHERE organization_id=?1 AND created_at>=?2 AND outcome!='success'",
      )
        .bind(organizationId, since)
        .first<{ value: number }>(),
      env.DB.prepare(
        "SELECT count(*) value FROM audit_logs WHERE organization_id=?1 AND created_at>=?2 AND (action LIKE '%permission%' OR action LIKE '%role%' OR action LIKE '%backup%' OR action LIKE '%asset%')",
      )
        .bind(organizationId, since)
        .first<{ value: number }>(),
      env.DB.prepare(
        "SELECT max(completed_at) value FROM backup_runs WHERE organization_id=?1 AND status='completed'",
      )
        .bind(organizationId)
        .first<{ value: number | null }>(),
    ]);
  return {
    logs: logs.results,
    campuses: campuses.results,
    backups: backups.results,
    summary: {
      events24h: events?.value ?? 0,
      failed24h: failed?.value ?? 0,
      sensitive24h: sensitive?.value ?? 0,
      lastBackupAt: lastBackup?.value ?? null,
    },
  };
}

async function loadStudentDirectoryData(
  organizationId: string,
  campusId: string | null,
): Promise<StudentDirectoryData> {
  const [
    students,
    campuses,
    classes,
    sections,
    academicYears,
    total,
    active,
    applicants,
    archived,
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT s.id,s.admission_number,s.first_name,s.last_name,s.preferred_name,s.gender,s.date_of_birth,s.enrollment_status,s.admitted_on,c.name campus_name,cl.name class_name,se.name section_name FROM students s JOIN campuses c ON c.id=s.home_campus_id LEFT JOIN enrollments e ON e.student_id=s.id AND e.status='active' AND e.academic_year_id=(SELECT id FROM academic_years WHERE organization_id=?1 AND is_current=1 LIMIT 1) LEFT JOIN classes cl ON cl.id=e.class_id LEFT JOIN sections se ON se.id=e.section_id WHERE s.organization_id=?1 AND (?2 IS NULL OR s.home_campus_id=?2) ORDER BY s.first_name,s.last_name LIMIT 25`,
    )
      .bind(organizationId, campusId)
      .all<StudentDirectoryData["students"][number]>(),
    env.DB.prepare(
      "SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR id=?2) ORDER BY is_main DESC,name",
    )
      .bind(organizationId, campusId)
      .all<StudentDirectoryData["campuses"][number]>(),
    env.DB.prepare(
      "SELECT id,name,campus_id FROM classes WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR campus_id IS NULL OR campus_id=?2) ORDER BY sort_order,name",
    )
      .bind(organizationId, campusId)
      .all<StudentDirectoryData["classes"][number]>(),
    env.DB.prepare(
      "SELECT id,name,campus_id,class_id FROM sections WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR campus_id=?2) ORDER BY name",
    )
      .bind(organizationId, campusId)
      .all<StudentDirectoryData["sections"][number]>(),
    env.DB.prepare(
      "SELECT id,name,is_current,status FROM academic_years WHERE organization_id=?1 ORDER BY starts_on DESC",
    )
      .bind(organizationId)
      .all<StudentDirectoryData["academicYears"][number]>(),
    env.DB.prepare(
      "SELECT count(*) value FROM students WHERE organization_id=?1 AND (?2 IS NULL OR home_campus_id=?2)",
    )
      .bind(organizationId, campusId)
      .first<{ value: number }>(),
    env.DB.prepare(
      "SELECT count(*) value FROM students WHERE organization_id=?1 AND enrollment_status='active' AND (?2 IS NULL OR home_campus_id=?2)",
    )
      .bind(organizationId, campusId)
      .first<{ value: number }>(),
    env.DB.prepare(
      "SELECT count(*) value FROM students WHERE organization_id=?1 AND enrollment_status='applicant' AND (?2 IS NULL OR home_campus_id=?2)",
    )
      .bind(organizationId, campusId)
      .first<{ value: number }>(),
    env.DB.prepare(
      "SELECT count(*) value FROM students WHERE organization_id=?1 AND enrollment_status='archived' AND (?2 IS NULL OR home_campus_id=?2)",
    )
      .bind(organizationId, campusId)
      .first<{ value: number }>(),
  ]);
  return {
    students: students.results,
    campuses: campuses.results,
    classes: classes.results,
    sections: sections.results,
    academicYears: academicYears.results,
    summary: {
      total: total?.value ?? 0,
      active: active?.value ?? 0,
      applicants: applicants?.value ?? 0,
      archived: archived?.value ?? 0,
    },
    page: 1,
    pageSize: 25,
  };
}

async function loadAdmissionsData(
  organizationId: string,
  campusId: string | null,
): Promise<AdmissionsData> {
  const [enquiries, applications, campuses, classes, academicYears, summary] =
    await Promise.all([
      env.DB.prepare(
        `SELECT e.id,e.enquiry_number,e.child_first_name,e.child_last_name,e.guardian_name,e.primary_phone,e.source,e.status,e.priority,e.next_follow_up_on,e.created_at,c.name campus_name,cl.name class_name FROM admission_enquiries e JOIN campuses c ON c.id=e.campus_id LEFT JOIN classes cl ON cl.id=e.applying_class_id WHERE e.organization_id=?1 AND (?2 IS NULL OR e.campus_id=?2) ORDER BY e.created_at DESC LIMIT 100`,
      )
        .bind(organizationId, campusId)
        .all<AdmissionsData["enquiries"][number]>(),
      env.DB.prepare(
        `SELECT a.id,a.application_number,a.enquiry_id,a.child_first_name,a.child_last_name,a.guardian_name,a.primary_phone,a.status,a.submitted_on,a.created_at,c.name campus_name,cl.name class_name FROM admission_applications a JOIN campuses c ON c.id=a.campus_id LEFT JOIN classes cl ON cl.id=a.applying_class_id WHERE a.organization_id=?1 AND (?2 IS NULL OR a.campus_id=?2) ORDER BY a.created_at DESC LIMIT 50`,
      )
        .bind(organizationId, campusId)
        .all<AdmissionsData["applications"][number]>(),
      env.DB.prepare(
        "SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR id=?2) ORDER BY is_main DESC,name",
      )
        .bind(organizationId, campusId)
        .all<AdmissionsData["campuses"][number]>(),
      env.DB.prepare(
        "SELECT id,name,campus_id FROM classes WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR campus_id IS NULL OR campus_id=?2) ORDER BY sort_order,name",
      )
        .bind(organizationId, campusId)
        .all<AdmissionsData["classes"][number]>(),
      env.DB.prepare(
        "SELECT id,name,is_current FROM academic_years WHERE organization_id=?1 ORDER BY starts_on DESC",
      )
        .bind(organizationId)
        .all<AdmissionsData["academicYears"][number]>(),
      env.DB.prepare(
        `SELECT count(*) total,sum(CASE WHEN status='new' THEN 1 ELSE 0 END) new_count,sum(CASE WHEN status='contacted' THEN 1 ELSE 0 END) contacted_count,sum(CASE WHEN status='application_started' THEN 1 ELSE 0 END) converted_count,sum(CASE WHEN next_follow_up_on IS NOT NULL AND next_follow_up_on<=date('now') AND status NOT IN ('closed','application_started') THEN 1 ELSE 0 END) followups_due FROM admission_enquiries WHERE organization_id=?1 AND (?2 IS NULL OR campus_id=?2)`,
      )
        .bind(organizationId, campusId)
        .first<AdmissionsData["summary"]>(),
    ]);
  return {
    enquiries: enquiries.results,
    applications: applications.results,
    campuses: campuses.results,
    classes: classes.results,
    academicYears: academicYears.results,
    summary: summary ?? {
      total: 0,
      new_count: 0,
      contacted_count: 0,
      converted_count: 0,
      followups_due: 0,
    },
  };
}

async function loadStaffDirectoryData(
  organizationId: string,
  canViewFinancial: boolean,
  campusId: string | null,
): Promise<StaffDirectoryData> {
  const [staff, campuses, total, active, teaching, nonTeaching] =
    await Promise.all([
      env.DB.prepare(
        `SELECT s.id,s.employee_number,s.first_name,s.last_name,s.preferred_name,s.phone,s.email,s.designation,s.department,s.staff_category,s.employment_type,s.joined_on,s.status,s.photo_asset_id,c.name campus_name FROM staff s JOIN campuses c ON c.id=s.campus_id WHERE s.organization_id=?1 AND (?2 IS NULL OR s.campus_id=?2) ORDER BY CASE s.status WHEN 'active' THEN 0 ELSE 1 END,s.first_name,s.last_name LIMIT 150`,
      )
        .bind(organizationId, campusId)
        .all<StaffDirectoryData["staff"][number]>(),
      env.DB.prepare(
        "SELECT id,name,code FROM campuses WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR id=?2) ORDER BY is_main DESC,name",
      )
        .bind(organizationId, campusId)
        .all<StaffDirectoryData["campuses"][number]>(),
      env.DB.prepare(
        "SELECT count(*) value FROM staff WHERE organization_id=?1 AND (?2 IS NULL OR campus_id=?2)",
      )
        .bind(organizationId, campusId)
        .first<{ value: number }>(),
      env.DB.prepare(
        "SELECT count(*) value FROM staff WHERE organization_id=?1 AND status='active' AND (?2 IS NULL OR campus_id=?2)",
      )
        .bind(organizationId, campusId)
        .first<{ value: number }>(),
      env.DB.prepare(
        "SELECT count(*) value FROM staff WHERE organization_id=?1 AND status='active' AND staff_category='teaching' AND (?2 IS NULL OR campus_id=?2)",
      )
        .bind(organizationId, campusId)
        .first<{ value: number }>(),
      env.DB.prepare(
        "SELECT count(*) value FROM staff WHERE organization_id=?1 AND status='active' AND staff_category='non_teaching' AND (?2 IS NULL OR campus_id=?2)",
      )
        .bind(organizationId, campusId)
        .first<{ value: number }>(),
    ]);
  return {
    staff: staff.results,
    campuses: campuses.results,
    summary: {
      total: total?.value ?? 0,
      active: active?.value ?? 0,
      teaching: teaching?.value ?? 0,
      nonTeaching: nonTeaching?.value ?? 0,
    },
    canViewFinancial,
  };
}

async function loadTeachersData(organizationId: string): Promise<TeachersData> {
  const [
    assignments,
    classTeachers,
    teachers,
    subjects,
    classes,
    sections,
    years,
    campuses,
    curriculumCoverage,
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT a.id,a.staff_id,a.weekly_periods,a.is_primary,s.employee_number,s.first_name,s.last_name,s.designation,sub.name subject_name,sub.code subject_code,sub.color,cl.name class_name,se.name section_name,c.name campus_name,y.name academic_year_name FROM teacher_subject_assignments a JOIN staff s ON s.id=a.staff_id JOIN subjects sub ON sub.id=a.subject_id JOIN classes cl ON cl.id=a.class_id LEFT JOIN sections se ON se.id=a.section_id JOIN campuses c ON c.id=a.campus_id JOIN academic_years y ON y.id=a.academic_year_id WHERE a.organization_id=?1 AND a.status='active' ORDER BY s.first_name,cl.sort_order,sub.name`,
    )
      .bind(organizationId)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT a.id,a.staff_id,s.employee_number,s.first_name,s.last_name,cl.name class_name,se.name section_name,c.name campus_name,y.name academic_year_name,a.notes FROM class_teacher_assignments a JOIN staff s ON s.id=a.staff_id JOIN classes cl ON cl.id=a.class_id LEFT JOIN sections se ON se.id=a.section_id JOIN campuses c ON c.id=a.campus_id JOIN academic_years y ON y.id=a.academic_year_id WHERE a.organization_id=?1 AND a.status='active' ORDER BY c.name,cl.sort_order,se.name`,
    )
      .bind(organizationId)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      "SELECT id,employee_number,first_name,last_name,campus_id,designation FROM staff WHERE organization_id=?1 AND status='active' AND staff_category IN ('teaching','management') ORDER BY first_name,last_name",
    )
      .bind(organizationId)
      .all<TeachersData["teachers"][number]>(),
    env.DB.prepare(
      "SELECT id,name,code,campus_id,color,subject_type FROM subjects WHERE organization_id=?1 AND status='active' ORDER BY name",
    )
      .bind(organizationId)
      .all<TeachersData["subjects"][number]>(),
    env.DB.prepare(
      "SELECT id,name,code,campus_id FROM classes WHERE organization_id=?1 AND status='active' ORDER BY sort_order,name",
    )
      .bind(organizationId)
      .all<TeachersData["classes"][number]>(),
    env.DB.prepare(
      "SELECT id,name,class_id,campus_id FROM sections WHERE organization_id=?1 AND status='active' ORDER BY name",
    )
      .bind(organizationId)
      .all<TeachersData["sections"][number]>(),
    env.DB.prepare(
      "SELECT id,name,is_current FROM academic_years WHERE organization_id=?1 AND status!='archived' ORDER BY starts_on DESC",
    )
      .bind(organizationId)
      .all<TeachersData["academicYears"][number]>(),
    env.DB.prepare(
      "SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name",
    )
      .bind(organizationId)
      .all<TeachersData["campuses"][number]>(),
    env.DB.prepare(
      `SELECT m.id,m.weekly_periods,m.is_compulsory,g.name grade_name,cl.name class_name,s.name subject_name,s.code subject_code,c.name campus_name,y.name academic_year_name,(SELECT count(*) FROM teacher_subject_assignments a WHERE a.organization_id=m.organization_id AND a.academic_year_id=m.academic_year_id AND a.subject_id=m.subject_id AND (m.class_id IS NULL OR a.class_id=m.class_id) AND (m.campus_id IS NULL OR a.campus_id=m.campus_id) AND a.status='active') teacher_count FROM curriculum_mappings m JOIN academic_years y ON y.id=m.academic_year_id JOIN grade_levels g ON g.id=m.grade_level_id LEFT JOIN classes cl ON cl.id=m.class_id JOIN subjects s ON s.id=m.subject_id LEFT JOIN campuses c ON c.id=m.campus_id WHERE m.organization_id=?1 AND m.status='active' ORDER BY g.sort_order,s.name`,
    )
      .bind(organizationId)
      .all<Record<string, unknown>>(),
  ]);
  const workload = new Map<
    string,
    TeachersData["workload"][number] & { classes: string[]; subjects: string[] }
  >();
  for (const a of assignments.results) {
    const id = String(a.staff_id),
      v = workload.get(id) ?? {
        staff_id: id,
        employee_number: String(a.employee_number),
        name: `${a.first_name} ${a.last_name ?? ""}`.trim(),
        designation: String(a.designation),
        classes: [],
        subjects: [],
        periods: 0,
      };
    const className = `${a.class_name}${a.section_name ? ` · ${a.section_name}` : ""}`;
    if (!v.classes.includes(className)) v.classes.push(className);
    if (!v.subjects.includes(String(a.subject_name)))
      v.subjects.push(String(a.subject_name));
    v.periods += Number(a.weekly_periods);
    workload.set(id, v);
  }
  return {
    assignments: assignments.results,
    classTeachers: classTeachers.results,
    curriculumCoverage: curriculumCoverage.results,
    workload: [...workload.values()],
    teachers: teachers.results,
    subjects: subjects.results,
    classes: classes.results,
    sections: sections.results,
    academicYears: years.results,
    campuses: campuses.results,
  };
}

async function loadStaffAttendanceData(
  organizationId: string,
): Promise<StaffAttendanceData> {
  const day = new Date().toISOString().slice(0, 10),
    month = day.slice(0, 7);
  const [roster, summary, monthly, corrections, campuses] = await Promise.all([
    env.DB.prepare(
      `SELECT s.id staff_id,s.employee_number,s.first_name,s.last_name,s.designation,s.department,s.campus_id,c.name campus_name,a.id attendance_id,a.status,a.check_in,a.check_out,a.late_minutes,a.worked_minutes,a.notes FROM staff s JOIN campuses c ON c.id=s.campus_id LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.organization_id=s.organization_id AND a.attendance_date=?2 WHERE s.organization_id=?1 AND s.status='active' ORDER BY c.name,s.first_name,s.last_name`,
    )
      .bind(organizationId, day)
      .all<StaffAttendanceData["roster"][number]>(),
    env.DB.prepare(
      "SELECT count(*) total,sum(CASE WHEN a.status='present' THEN 1 ELSE 0 END) present,sum(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) absent,sum(CASE WHEN a.status='late' THEN 1 ELSE 0 END) late,sum(CASE WHEN a.status='leave' THEN 1 ELSE 0 END) on_leave FROM staff s LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.organization_id=s.organization_id AND a.attendance_date=?2 WHERE s.organization_id=?1 AND s.status='active'",
    )
      .bind(organizationId, day)
      .first<StaffAttendanceData["summary"]>(),
    env.DB.prepare(
      `SELECT s.id staff_id,s.employee_number,s.first_name,s.last_name,s.designation,count(a.id) marked,sum(CASE WHEN a.status='present' THEN 1 ELSE 0 END) present,sum(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) absent,sum(CASE WHEN a.status='late' THEN 1 ELSE 0 END) late,sum(CASE WHEN a.status='leave' THEN 1 ELSE 0 END) on_leave FROM staff s LEFT JOIN staff_attendance a ON a.staff_id=s.id AND a.organization_id=s.organization_id AND substr(a.attendance_date,1,7)=?2 WHERE s.organization_id=?1 AND s.status='active' GROUP BY s.id ORDER BY s.first_name`,
    )
      .bind(organizationId, month)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      `SELECT x.*,s.employee_number,s.first_name,s.last_name,a.attendance_date FROM staff_attendance_corrections x JOIN staff s ON s.id=x.staff_id JOIN staff_attendance a ON a.id=x.attendance_id WHERE x.organization_id=?1 ORDER BY CASE x.status WHEN 'pending' THEN 0 ELSE 1 END,x.created_at DESC LIMIT 50`,
    )
      .bind(organizationId)
      .all<Record<string, unknown>>(),
    env.DB.prepare(
      "SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name",
    )
      .bind(organizationId)
      .all<StaffAttendanceData["campuses"][number]>(),
  ]);
  return {
    date: day,
    month,
    campusId: "",
    roster: roster.results,
    summary: summary ?? {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      on_leave: 0,
    },
    monthly: monthly.results,
    corrections: corrections.results,
    campuses: campuses.results,
    canManage: true,
    canCorrect: true,
  };
}

async function loadPayrollData(
  organizationId: string,
  permissions: Set<string>,
): Promise<PayrollData> {
  const [components, assignments, periods, staff, campuses] = await Promise.all(
    [
      env.DB.prepare(
        "SELECT * FROM salary_components WHERE organization_id=?1 AND is_active=1 ORDER BY component_type,name",
      )
        .bind(organizationId)
        .all<Record<string, unknown>>(),
      env.DB.prepare(
        `SELECT a.*,s.employee_number,s.first_name,s.last_name,s.designation,c.name campus_name,coalesce(sum(CASE WHEN sc.component_type='earning' THEN x.value ELSE 0 END),0) earnings,coalesce(sum(CASE WHEN sc.component_type='deduction' THEN x.value ELSE 0 END),0) deductions FROM staff_salary_assignments a JOIN staff s ON s.id=a.staff_id JOIN campuses c ON c.id=a.campus_id LEFT JOIN staff_salary_components x ON x.salary_assignment_id=a.id LEFT JOIN salary_components sc ON sc.id=x.component_id WHERE a.organization_id=?1 AND a.status='active' GROUP BY a.id ORDER BY s.first_name`,
      )
        .bind(organizationId)
        .all<Record<string, unknown>>(),
      env.DB.prepare(
        `SELECT p.*,u.display_name approved_by_name,count(i.id) staff_count,coalesce(sum(i.net_salary),0) net_total FROM payroll_periods p LEFT JOIN users u ON u.id=p.approved_by LEFT JOIN payroll_items i ON i.payroll_period_id=p.id WHERE p.organization_id=?1 GROUP BY p.id ORDER BY p.period_month DESC LIMIT 24`,
      )
        .bind(organizationId)
        .all<Record<string, unknown>>(),
      env.DB.prepare(
        "SELECT id,employee_number,first_name,last_name,designation,campus_id FROM staff WHERE organization_id=?1 AND status='active' ORDER BY first_name,last_name",
      )
        .bind(organizationId)
        .all<Record<string, unknown>>(),
      env.DB.prepare(
        "SELECT id,name FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name",
      )
        .bind(organizationId)
        .all<Record<string, unknown>>(),
    ],
  );
  const selectedPeriodId = String(periods.results[0]?.id ?? ""),
    items = selectedPeriodId
      ? await env.DB.prepare(
          `SELECT i.*,s.employee_number,s.first_name,s.last_name,s.designation,c.name campus_name FROM payroll_items i JOIN staff s ON s.id=i.staff_id JOIN campuses c ON c.id=i.campus_id WHERE i.organization_id=?1 AND i.payroll_period_id=?2 ORDER BY c.name,s.first_name`,
        )
          .bind(organizationId, selectedPeriodId)
          .all<Record<string, unknown>>()
      : { results: [] };
  return {
    components: components.results,
    assignments: assignments.results,
    periods: periods.results,
    items: items.results,
    staff: staff.results,
    campuses: campuses.results,
    selectedPeriodId,
    canConfigure: permissions.has("payroll.configure"),
    canGenerate: permissions.has("payroll.generate"),
    canApprove: permissions.has("payroll.approve"),
  };
}

async function loadAcademicsData(
  organizationId: string,
  permissions: Set<string>,
): Promise<AcademicsData> {
  const [
    academicYears,
    terms,
    grades,
    classes,
    sections,
    campuses,
    subjects,
    curriculumMappings,
  ] = await Promise.all([
    env.DB.prepare(
      "SELECT id,name,starts_on,ends_on,is_current,status FROM academic_years WHERE organization_id=?1 ORDER BY starts_on DESC",
    )
      .bind(organizationId)
      .all<AcademicsData["academicYears"][number]>(),
    env.DB.prepare(
      "SELECT t.*,y.name academic_year_name FROM academic_terms t JOIN academic_years y ON y.id=t.academic_year_id WHERE t.organization_id=?1 ORDER BY y.starts_on DESC,t.sort_order",
    )
      .bind(organizationId)
      .all<AcademicsData["terms"][number]>(),
    env.DB.prepare(
      "SELECT g.*,p.name promotion_to_name FROM grade_levels g LEFT JOIN grade_levels p ON p.id=g.promotion_to_grade_id WHERE g.organization_id=?1 ORDER BY g.sort_order,g.name",
    )
      .bind(organizationId)
      .all<AcademicsData["grades"][number]>(),
    env.DB.prepare(
      "SELECT cl.*,c.name campus_name,y.name academic_year_name,g.name grade_name,(SELECT count(*) FROM sections s WHERE s.class_id=cl.id AND s.status='active') section_count,(SELECT count(*) FROM enrollments e WHERE e.class_id=cl.id AND e.status='active') student_count FROM classes cl LEFT JOIN campuses c ON c.id=cl.campus_id LEFT JOIN academic_years y ON y.id=cl.academic_year_id LEFT JOIN grade_levels g ON g.id=cl.grade_level_id WHERE cl.organization_id=?1 ORDER BY cl.sort_order,cl.name",
    )
      .bind(organizationId)
      .all<AcademicsData["classes"][number]>(),
    env.DB.prepare(
      "SELECT s.*,cl.name class_name,c.name campus_name,(SELECT count(*) FROM enrollments e WHERE e.section_id=s.id AND e.status='active') student_count FROM sections s JOIN classes cl ON cl.id=s.class_id JOIN campuses c ON c.id=s.campus_id WHERE s.organization_id=?1 ORDER BY cl.sort_order,s.name",
    )
      .bind(organizationId)
      .all<AcademicsData["sections"][number]>(),
    env.DB.prepare(
      "SELECT id,name,code,is_main,'active' status FROM campuses WHERE organization_id=?1 AND status='active' ORDER BY is_main DESC,name",
    )
      .bind(organizationId)
      .all<AcademicsData["campuses"][number]>(),
    env.DB.prepare(
      "SELECT s.*,(SELECT count(*) FROM curriculum_mappings m WHERE m.subject_id=s.id AND m.organization_id=s.organization_id AND m.status='active') mapping_count,(SELECT count(DISTINCT a.staff_id) FROM teacher_subject_assignments a WHERE a.subject_id=s.id AND a.organization_id=s.organization_id AND a.status='active') teacher_count FROM subjects s WHERE s.organization_id=?1 ORDER BY s.name",
    )
      .bind(organizationId)
      .all<AcademicsData["subjects"][number]>(),
    env.DB.prepare(
      "SELECT m.*,y.name academic_year_name,c.name campus_name,g.name grade_name,cl.name class_name,s.name subject_name,s.code subject_code,s.color FROM curriculum_mappings m JOIN academic_years y ON y.id=m.academic_year_id LEFT JOIN campuses c ON c.id=m.campus_id JOIN grade_levels g ON g.id=m.grade_level_id LEFT JOIN classes cl ON cl.id=m.class_id JOIN subjects s ON s.id=m.subject_id WHERE m.organization_id=?1 ORDER BY y.starts_on DESC,g.sort_order,s.name",
    )
      .bind(organizationId)
      .all<AcademicsData["curriculumMappings"][number]>(),
  ]);
  return {
    academicYears: academicYears.results,
    terms: terms.results,
    grades: grades.results,
    classes: classes.results,
    sections: sections.results,
    campuses: campuses.results,
    subjects: subjects.results,
    curriculumMappings: curriculumMappings.results,
    canManage: permissions.has("academics.manage"),
    canManageCurriculum: permissions.has("curriculum.manage"),
  };
}

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user)
    return (
      <main className="welcome-page">
        <section className="welcome-card">
          <img
            src="/tms-original-logo-transparent.png"
            alt="The Mentor School logo"
          />
          <span className="welcome-kicker">SCHOOL MANAGEMENT SYSTEM</span>
          <h1>One secure workspace for your entire school.</h1>
          <p>
            Manage campuses, people, academics and operations with
            organization-isolated data and role-based access.
          </p>
          <a className="chatgpt-signin" href={chatGPTSignInPath("/")}>
            ✦ Continue with ChatGPT
          </a>
          <small>Temporary authentication for the development phase</small>
        </section>
      </main>
    );
  await acceptPendingInvitation(user.email, user.displayName);
  const access = await authorize();
  if (!access) {
    const schools = await getOrganizationChoices();
    if (schools.length > 1)
      return (
        <SchoolSelectionPanel schools={schools} userName={user.displayName} />
      );
    return (
      <RegistrationForm email={user.email} displayName={user.displayName} />
    );
  }
  await ensureDefaultRoles(access.organizationId);
  await ensureConfigurationAccess(access.organizationId);
  await ensureSecurityAccess(access.organizationId);
  await ensureStudentAccess(access.organizationId);
  await ensureAdmissionAccess(access.organizationId);
  await ensureStaffAccess(access.organizationId);
  await ensureTimetableAccess(access.organizationId);
  const refreshedAccess = (await authorize())!;
  const canViewAccess =
    refreshedAccess.organizationWide &&
    (refreshedAccess.permissions.has("users.view") ||
      refreshedAccess.permissions.has("roles.view"));
  const canViewConfiguration =
    refreshedAccess.organizationWide &&
    (refreshedAccess.permissions.has("settings.view") ||
      refreshedAccess.permissions.has("academic_years.view"));
  const canViewSecurity =
    refreshedAccess.organizationWide &&
    (refreshedAccess.permissions.has("audit.view") ||
      refreshedAccess.permissions.has("security.view"));
  const canViewStudents = refreshedAccess.permissions.has("students.view");
  const canViewAdmissions = refreshedAccess.permissions.has("admissions.view");
  const canViewStaff = refreshedAccess.permissions.has("staff.view");
  const canViewTeachers =
    refreshedAccess.organizationWide &&
    refreshedAccess.permissions.has("teacher_assignments.view");
  const canViewStaffAttendance =
    refreshedAccess.organizationWide &&
    refreshedAccess.permissions.has("staff_attendance.view");
  const canViewPayroll =
    refreshedAccess.organizationWide &&
    refreshedAccess.permissions.has("payroll.view");
  const canViewAcademics =
    refreshedAccess.organizationWide &&
    refreshedAccess.permissions.has("academics.view");
  const [
    accessData,
    configurationData,
    securityData,
    studentDirectoryData,
    admissionsData,
    staffDirectoryData,
    teachersData,
    staffAttendanceData,
    payrollData,
    academicsData,
  ] = await Promise.all([
    canViewAccess
      ? loadAccessData(refreshedAccess.organizationId)
      : Promise.resolve(null),
    canViewConfiguration
      ? loadConfigurationData(refreshedAccess.organizationId)
      : Promise.resolve(null),
    canViewSecurity
      ? loadSecurityData(refreshedAccess.organizationId)
      : Promise.resolve(null),
    canViewStudents
      ? loadStudentDirectoryData(
          refreshedAccess.organizationId,
          refreshedAccess.activeCampusId,
        )
      : Promise.resolve(null),
    canViewAdmissions
      ? loadAdmissionsData(
          refreshedAccess.organizationId,
          refreshedAccess.activeCampusId,
        )
      : Promise.resolve(null),
    canViewStaff
      ? loadStaffDirectoryData(
          refreshedAccess.organizationId,
          refreshedAccess.permissions.has("staff.financial"),
          refreshedAccess.activeCampusId,
        )
      : Promise.resolve(null),
    canViewTeachers
      ? loadTeachersData(refreshedAccess.organizationId)
      : Promise.resolve(null),
    canViewStaffAttendance
      ? loadStaffAttendanceData(refreshedAccess.organizationId)
      : Promise.resolve(null),
    canViewPayroll
      ? loadPayrollData(
          refreshedAccess.organizationId,
          refreshedAccess.permissions,
        )
      : Promise.resolve(null),
    canViewAcademics
      ? loadAcademicsData(
          refreshedAccess.organizationId,
          refreshedAccess.permissions,
        )
      : Promise.resolve(null),
  ]);
  if (staffAttendanceData) {
    staffAttendanceData.canManage = refreshedAccess.permissions.has(
      "staff_attendance.manage",
    );
    staffAttendanceData.canCorrect = refreshedAccess.permissions.has(
      "staff_attendance.correct",
    );
  }
  return (
    <DashboardShell
      schoolName={refreshedAccess.schoolName}
      activeCampusId={refreshedAccess.activeCampusId}
      campuses={refreshedAccess.campuses}
      organizationWide={refreshedAccess.organizationWide}
      canViewPromotions={refreshedAccess.permissions.has("promotions.view")}
      canViewStudentAttendance={refreshedAccess.permissions.has(
        "student_attendance.view",
      )}
      canViewTimetable={refreshedAccess.permissions.has("timetable.view")}
      userName={user.displayName}
      accessData={accessData}
      configurationData={configurationData}
      securityData={securityData}
      studentDirectoryData={studentDirectoryData}
      admissionsData={admissionsData}
      staffDirectoryData={staffDirectoryData}
      teachersData={teachersData}
      staffAttendanceData={staffAttendanceData}
      payrollData={payrollData}
      academicsData={academicsData}
    />
  );
}
