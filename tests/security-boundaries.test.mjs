import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("protected asset downloads are tenant-scoped", async () => {
  const source = await read("app/api/assets/[id]/route.ts");
  assert.match(source, /authorize\("assets\.download"\)/);
  assert.match(source, /organization_id=\?2/);
  assert.match(source, /cache-control":"private, no-store"/);
});

test("multi-school identity resolution is explicit and fail-closed", async () => {
  const authorization = await read("lib/authorization.ts");
  const context = await read("app/api/session/context/route.ts");
  const page = await read("app/page.tsx");
  assert.match(authorization, /sms_active_organization/);
  assert.match(authorization, /memberships\.length\s*===\s*1/);
  assert.match(
    authorization,
    /memberships\.find\([\s\S]{0,120}item\.organizationId\s*===\s*selectedOrganization/,
  );
  assert.doesNotMatch(
    authorization,
    /organization_memberships[\s\S]{0,260}LIMIT 1/,
  );
  assert.match(
    context,
    /choices\.some\(choice=>choice\.organizationId===organizationId\)/,
  );
  assert.match(context, /httpOnly:true,sameSite:"strict",secure:true/);
  assert.match(page, /SchoolSelectionPanel/);
});

test("campus membership is part of server authorization and denied access is audited", async () => {
  const authorization = await read("lib/authorization.ts");
  const invitations = await read("app/api/access/users/route.ts");
  assert.match(authorization, /campus_memberships/);
  assert.match(authorization, /allowedCampusIds/);
  assert.match(authorization, /organizationWide/);
  assert.match(authorization, /requireCampusAccess/);
  assert.match(authorization, /campus_scope_denied/);
  assert.match(invitations, /role\.scope!=="organization"&&!campusId/);
  assert.match(invitations, /INSERT INTO campus_memberships/);
});

test("student, admission and staff boundaries enforce active campus scope", async () => {
  const students = await read("app/api/students/route.ts");
  const studentProfile = await read("app/api/students/[id]/route.ts");
  const admissions = await read("app/api/admissions/route.ts");
  const staff = await read("app/api/staff/route.ts");
  assert.match(
    students,
    /requireCampusAccess\(auth,campusId,"students\.list"\)/,
  );
  assert.match(students, /requireCampusAccess\(auth,student\.home_campus_id/);
  assert.match(
    studentProfile,
    /requireCampusAccess\(auth,\(student as \{home_campus_id:string\}\)\.home_campus_id/,
  );
  assert.match(
    admissions,
    /requireCampusAccess\(auth,campusId,"admissions\.list"\)/,
  );
  assert.match(admissions, /\(\?2='' OR a\.campus_id=\?2\)/);
  assert.match(staff, /requireCampusAccess\(auth,campusId,"staff\.list"\)/);
  assert.match(staff, /\(\?2='' OR campus_id=\?2\)/);
});

test("dashboard loaders follow the selected campus without losing organization scope", async () => {
  const page = await read("app/page.tsx");
  const shell = await read("app/DashboardShell.tsx");
  assert.match(
    page,
    /loadStudentDirectoryData\([\s\S]{0,100}refreshedAccess\.organizationId,[\s\S]{0,100}refreshedAccess\.activeCampusId/,
  );
  assert.match(
    page,
    /loadAdmissionsData\([\s\S]{0,100}refreshedAccess\.organizationId,[\s\S]{0,100}refreshedAccess\.activeCampusId/,
  );
  assert.match(
    page,
    /canViewConfiguration =[\s\S]{0,100}refreshedAccess\.organizationWide/,
  );
  assert.match(
    page,
    /canViewSecurity =[\s\S]{0,100}refreshedAccess\.organizationWide/,
  );
  assert.match(page, /\(\?2 IS NULL OR s\.home_campus_id=\?2\)/);
  assert.match(page, /\(\?2 IS NULL OR e\.campus_id=\?2\)/);
  assert.match(shell, /chooseCampus/);
  assert.match(shell, /All campuses/);
});

test("backup snapshots use organization-scoped R2 keys and rate limits", async () => {
  const source = await read("app/api/security/backups/route.ts");
  assert.match(source, /organizations\/\$\{auth\.organizationId\}\/backups/);
  assert.match(source, /enforceRateLimit\(auth,\s*"backup\.create"/);
  assert.match(source, /requireSameOrigin\(request\)/);
});

test("academic structure is permission protected and tenant scoped", async () => {
  const source = await read("app/api/academics/route.ts");
  const panel = await read("app/AcademicsPanel.tsx");
  const permissions = await read("lib/authorization.ts");
  const backup = await read("app/api/security/backups/route.ts");
  assert.match(source, /authorize\("academics\.view"\)/);
  assert.match(source, /authorize\("academics\.manage"\)/);
  assert.match(source, /organization_id=\?1/);
  assert.match(source, /organization_id=\?2/);
  assert.match(source, /owned\("academic_years"/);
  assert.match(source, /owned\("campuses"/);
  assert.match(source, /academic\.term\.create/);
  assert.match(source, /academic\.section\.create/);
  assert.match(panel, /action: "Add term"/);
  assert.match(panel, /action: "Add grade level"/);
  assert.match(panel, /action: "Add class \/ batch"/);
  assert.match(panel, /action: "Add section"/);
  assert.match(panel, /No terms added yet/);
  assert.match(permissions, /academics\.manage/);
  assert.match(backup, /academic_terms/);
  assert.match(backup, /grade_levels/);
});

test("curriculum mapping and teacher coverage are protected and tenant scoped", async () => {
  const academics = await read("app/api/academics/route.ts");
  const teachers = await read("app/api/teachers/route.ts");
  const permissions = await read("lib/authorization.ts");
  const backup = await read("app/api/security/backups/route.ts");
  assert.match(academics, /curriculumAction \? "curriculum\.manage"/);
  assert.match(academics, /owned\("subjects"/);
  assert.match(academics, /owned\("grade_levels"/);
  assert.match(academics, /owned\("academic_years"/);
  assert.match(academics, /curriculum\.mapping\.create/);
  assert.match(academics, /m\.organization_id=\?1/);
  assert.match(teachers, /curriculum_mappings/);
  assert.match(teachers, /a\.organization_id=m\.organization_id/);
  assert.match(permissions, /curriculum\.view/);
  assert.match(permissions, /curriculum\.manage/);
  assert.match(backup, /curriculum_mappings/);
});

test("audit queries always bind organization ownership", async () => {
  const source = await read("app/api/security/audit/route.ts");
  assert.match(source, /a\.organization_id=\?1/);
  assert.match(source, /FROM campuses WHERE id=\?1 AND organization_id=\?2/);
});

test("student directory operations are permission and tenant scoped", async () => {
  const source = await read("app/api/students/route.ts");
  assert.match(source, /authorize\("students\.view"\)/);
  assert.match(source, /s\.organization_id=\?1/);
  assert.match(source, /FROM campuses WHERE id=\?1 AND organization_id=\?2/);
  assert.match(source, /WHERE id=\?1 AND organization_id=\?2/);
  assert.match(source, /students\.archive/);
  assert.match(source, /students\.restore/);
});

test("complete student profiles and files remain tenant scoped", async () => {
  const profile = await read("app/api/students/[id]/route.ts");
  const assets = await read("app/api/students/[id]/assets/route.ts");
  assert.match(profile, /authorize\("students\.view"\)/);
  assert.match(profile, /authorize\("students\.edit"\)/);
  assert.match(profile, /s\.organization_id=\?2/);
  assert.match(profile, /student\.profile\.update/);
  assert.match(assets, /authorize\("students\.edit"\)/);
  assert.match(
    assets,
    /organizations\/\$\{auth\.organizationId\}\/students\/\$\{studentId\}/,
  );
  assert.match(assets, /student\.document\.upload/);
});

test("guardian and family management is permission and tenant scoped", async () => {
  const source = await read("app/api/students/[id]/guardians/route.ts");
  assert.match(source, /authorize\("guardians\.view"\)/);
  assert.match(source, /authorize\("guardians\.manage"\)/);
  assert.match(source, /g\.organization_id=\?2/);
  assert.match(source, /student_guardians/);
  assert.match(source, /guardian\.link/);
  assert.match(source, /guardian\.unlink/);
});

test("document verification and enrollment lifecycle are protected", async () => {
  const documents = await read(
    "app/api/students/[id]/documents/[documentId]/route.ts",
  );
  const enrollments = await read("app/api/students/[id]/enrollments/route.ts");
  assert.match(documents, /student_documents\.verify/);
  assert.match(documents, /d\.organization_id=\?3/);
  assert.match(documents, /student\.document\.\$\{action\}/);
  assert.match(enrollments, /authorize\("enrollments\.manage"\)/);
  assert.match(enrollments, /organization_id=\?2/);
  assert.match(enrollments, /INSERT INTO enrollment_events/);
  assert.match(enrollments, /student\.enrollment\.\$\{action\}/);
});

test("bulk student import and export validate and isolate school data", async () => {
  const importer = await read("app/api/students/import/route.ts");
  const exporter = await read("app/api/students/export/route.ts");
  assert.match(importer, /authorize\("students\.import"\)/);
  assert.match(importer, /mode!=="commit"\|\|errors\.length/);
  assert.match(importer, /campuses WHERE organization_id=\?1/);
  assert.match(importer, /student\.bulk_import/);
  assert.match(exporter, /authorize\("students\.export"\)/);
  assert.match(exporter, /s\.organization_id=\?1/);
  assert.match(exporter, /cache-control":"private, no-store"/);
});

test("admission enquiry and application workflow is permission and tenant scoped", async () => {
  const source = await read("app/api/admissions/route.ts");
  const authorization = await read("lib/authorization.ts");
  assert.match(source, /authorize\("admissions\.view"\)/);
  assert.match(
    source,
    /authorize\(action==="convert"\?"admissions\.convert":"admissions\.edit"\)/,
  );
  assert.match(
    source,
    /admission_enquiries WHERE id=\?1 AND organization_id=\?2/,
  );
  assert.match(source, /FROM campuses WHERE id=\?1 AND organization_id=\?2/);
  assert.match(source, /admission\.enquiry\.convert/);
  assert.match(source, /requireSameOrigin\(request\)/);
  assert.match(source, /enforceRateLimit\(auth,"admission\.enquiry\.create"/);
  assert.match(authorization, /"admissions\.convert"/);
});

test("complete admission applications, documents and assessments are protected", async () => {
  const application = await read("app/api/admissions/[id]/route.ts");
  const upload = await read("app/api/admissions/[id]/documents/route.ts");
  const verify = await read(
    "app/api/admissions/[id]/documents/[documentId]/route.ts",
  );
  const assessments = await read(
    "app/api/admissions/[id]/assessments/route.ts",
  );
  assert.match(application, /authorize\("admissions\.view"\)/);
  assert.match(application, /a\.id=\?1 AND a\.organization_id=\?2/);
  assert.match(application, /admission\.application\.submit/);
  assert.match(upload, /authorize\("admissions\.documents"\)/);
  assert.match(
    upload,
    /organizations\/\$\{auth\.organizationId\}\/admissions\/\$\{id\}/,
  );
  assert.match(upload, /application\.campus_id/);
  assert.match(verify, /authorize\("admissions\.verify_documents"\)/);
  assert.match(verify, /d\.organization_id=\?3 AND a\.organization_id=\?3/);
  assert.match(assessments, /authorize\("admissions\.assessments"\)/);
  assert.match(
    assessments,
    /x\.organization_id=\?3 AND a\.organization_id=\?3/,
  );
  assert.match(assessments, /admission\.assessment\.result/);
});

test("admission approval, fee assignment and student conversion are atomic and tenant scoped", async () => {
  const decision = await read("app/api/admissions/[id]/decision/route.ts");
  const fees = await read("app/api/admissions/fee-packages/route.ts");
  assert.match(fees, /authorize\("admissions\.fee_packages"\)/);
  assert.match(fees, /organization_id=\?2/);
  assert.match(fees, /admission\.fee_package\.create/);
  assert.match(decision, /"admissions\.assign_fee"/);
  assert.match(decision, /"admissions\.approve"/);
  assert.match(decision, /"admissions\.enroll"/);
  assert.match(
    decision,
    /admission_applications WHERE id=\?1 AND organization_id=\?2/,
  );
  assert.match(
    decision,
    /application_fee_assignments WHERE application_id=\?1 AND organization_id=\?2/,
  );
  assert.match(decision, /sections WHERE id=\?1 AND organization_id=\?2/);
  assert.match(decision, /INSERT INTO students/);
  assert.match(decision, /INSERT INTO enrollments/);
  assert.match(decision, /INSERT INTO student_guardians/);
  assert.match(decision, /await env\.DB\.batch\(statements\)/);
  assert.match(decision, /admission\.application\.enroll/);
});

test("printable admission records and reporting remain permission and tenant scoped", async () => {
  const printable = await read("app/api/admissions/[id]/print/route.ts");
  const reports = await read("app/api/admissions/reports/route.ts");
  const authorization = await read("lib/authorization.ts");
  assert.match(printable, /authorize\("admissions\.print"\)/);
  assert.match(printable, /a\.id=\?1 AND a\.organization_id=\?2/);
  assert.match(printable, /admission\.form\.print/);
  assert.match(printable, /admission\.letter\.print/);
  assert.match(reports, /"admissions\.export":"admissions\.report"/);
  assert.match(reports, /a\.organization_id=\?1/);
  assert.match(reports, /admission\.report\.export/);
  assert.match(authorization, /"admissions\.print"/);
  assert.match(authorization, /"admissions\.report"/);
  assert.match(authorization, /"admissions\.export"/);
});

test("staff profiles, protected finances, files and bulk tools are tenant scoped", async () => {
  const staff = await read("app/api/staff/route.ts");
  const profile = await read("app/api/staff/[id]/route.ts");
  const assets = await read("app/api/staff/[id]/assets/route.ts");
  const importer = await read("app/api/staff/import/route.ts");
  const exporter = await read("app/api/staff/export/route.ts");
  const authorization = await read("lib/authorization.ts");
  assert.match(staff, /authorize\("staff\.view"\)/);
  assert.match(staff, /s\.organization_id=\?1/);
  assert.match(staff, /staff\.create/);
  assert.match(profile, /s\.id=\?1 AND s\.organization_id=\?2/);
  assert.match(profile, /staff\.financial/);
  assert.match(profile, /staff\.archive/);
  assert.match(assets, /authorize\("staff\.documents"\)/);
  assert.match(
    assets,
    /organizations\/\$\{auth\.organizationId\}\/staff\/\$\{id\}/,
  );
  assert.match(importer, /authorize\("staff\.import"\)/);
  assert.match(importer, /campuses WHERE organization_id=\?1/);
  assert.match(exporter, /authorize\("staff\.export"\)/);
  assert.match(exporter, /WHERE s\.organization_id=\?1/);
  assert.match(authorization, /"staff\.financial"/);
});

test("teacher subject, class and class-teacher assignments are validated and tenant scoped", async () => {
  const teachers = await read("app/api/teachers/route.ts");
  const authorization = await read("lib/authorization.ts");
  const backup = await read("app/api/security/backups/route.ts");
  assert.match(teachers, /authorize\("teacher_assignments\.view"\)/);
  assert.match(teachers, /"subjects\.manage"/);
  assert.match(teachers, /"teacher_assignments\.manage"/);
  assert.match(teachers, /a\.organization_id=\?1/);
  assert.match(
    teachers,
    /staff WHERE id=\?1 AND organization_id=\?2 AND campus_id=\?3/,
  );
  assert.match(
    teachers,
    /sections WHERE id=\?1 AND organization_id=\?2 AND campus_id=\?3 AND class_id=\?4/,
  );
  assert.match(
    teachers,
    /teacher_subject_assignments WHERE organization_id=\?1/,
  );
  assert.match(teachers, /teacher\.subject\.assign/);
  assert.match(teachers, /teacher\.class\.assign/);
  assert.match(teachers, /teacher\.assignment\.remove/);
  assert.match(authorization, /"teacher_assignments\.view"/);
  assert.match(authorization, /"teacher_assignments\.manage"/);
  assert.match(backup, /"teacher_subject_assignments"/);
  assert.match(backup, /"class_teacher_assignments"/);
});

test("staff attendance, corrections and leave approvals are tenant scoped and audited", async () => {
  const attendance = await read("app/api/staff-attendance/route.ts");
  const leave = await read("app/api/staff-leave/route.ts");
  const authorization = await read("lib/authorization.ts");
  const backup = await read("app/api/security/backups/route.ts");
  assert.match(attendance, /authorize\("staff_attendance\.view"\)/);
  assert.match(attendance, /authorize\("staff_attendance\.manage"\)/);
  assert.match(attendance, /organization_id=\?1/);
  assert.match(attendance, /staff\.attendance\.bulk_save/);
  assert.match(attendance, /staff\.attendance\.correction/);
  assert.match(leave, /authorize\("staff_leave\.request"\)/);
  assert.match(leave, /authorize\("staff_leave\.approve"\)/);
  assert.match(leave, /overlapping leave request/);
  assert.match(leave, /leave balance is insufficient/);
  assert.match(authorization, /"staff_attendance\.manage"/);
  assert.match(authorization, /"staff_leave\.approve"/);
  assert.match(backup, /"staff_attendance"/);
  assert.match(backup, /"staff_leave_requests"/);
});

test("salary configuration and payroll generation are protected and tenant scoped", async () => {
  const payroll = await read("app/api/payroll/route.ts");
  const authorization = await read("lib/authorization.ts");
  const backup = await read("app/api/security/backups/route.ts");
  assert.match(payroll, /authorize\("payroll\.view"\)/);
  assert.match(payroll, /authorize\("payroll\.configure"\)/);
  assert.match(payroll, /authorize\("payroll\.generate"\)/);
  assert.match(payroll, /authorize\("payroll\.approve"\)/);
  assert.match(payroll, /organization_id=\?1/);
  assert.match(payroll, /staff_attendance WHERE organization_id=\?1/);
  assert.match(payroll, /payroll\.salary\.assign/);
  assert.match(payroll, /payroll\.generate/);
  assert.match(authorization, /"payroll\.approve"/);
  assert.match(backup, /"payroll_periods"/);
  assert.match(backup, /"payroll_items"/);
});

test("promotion rules and enrollment conversion are protected, tenant scoped and historical", async () => {
  const promotions = await read("app/api/promotions/route.ts");
  const authorization = await read("lib/authorization.ts");
  const schema = await read("db/schema.ts");
  const migration = await read("drizzle/0016_promotion_workflow.sql");
  const shell = await read("app/DashboardShell.tsx");
  assert.match(promotions, /authorize\("promotions\.view"\)/);
  assert.match(
    promotions,
    /authorize\(action==="apply_batch"\?"promotions\.apply":"promotions\.manage"\)/,
  );
  assert.match(
    promotions,
    /requireCampusAccess\(auth,campusId,"promotion\.batch\.preview"\)/,
  );
  assert.match(promotions, /WHERE id=\?1 AND organization_id=\?2/);
  assert.match(promotions, /target-year enrollment now exists/);
  assert.match(promotions, /INSERT INTO enrollments/);
  assert.match(promotions, /INSERT INTO enrollment_events/);
  assert.match(promotions, /await env\.DB\.batch\(statements\)/);
  assert.match(authorization, /"promotions\.apply"/);
  assert.match(
    schema,
    /promotionRules\s*=\s*sqliteTable\(\s*"promotion_rules"/,
  );
  assert.match(
    schema,
    /promotionBatches\s*=\s*sqliteTable\(\s*"promotion_batches"/,
  );
  assert.match(
    schema,
    /promotionDecisions\s*=\s*sqliteTable\(\s*"promotion_decisions"/,
  );
  assert.match(migration, /CREATE TABLE `promotion_rules`/);
  assert.match(migration, /CREATE TABLE `promotion_batches`/);
  assert.match(migration, /CREATE TABLE `promotion_decisions`/);
  assert.match(shell, /\["⬆️",\s*"Promotions"\]/);
});

test("daily student attendance is assignment limited, tenant scoped and correction audited", async () => {
  const attendance = await read("app/api/student-attendance/route.ts");
  const authorization = await read("lib/authorization.ts");
  const schema = await read("db/schema.ts");
  const migration = await read("drizzle/0017_student_attendance.sql");
  const backup = await read("app/api/security/backups/route.ts");
  const shell = await read("app/DashboardShell.tsx");
  assert.match(attendance, /authorize\("student_attendance\.view"\)/);
  assert.match(attendance, /authorize\("student_attendance\.manage"\)/);
  assert.match(
    attendance,
    /requireCampusAccess\(auth,campusId,"student\.attendance\.save"\)/,
  );
  assert.match(
    attendance,
    /class_teacher_assignments WHERE organization_id=\?1/,
  );
  assert.match(
    attendance,
    /Teachers may only mark attendance for their assigned class or section/,
  );
  assert.match(
    attendance,
    /Teachers may only view attendance history for students in their assigned class or section/,
  );
  assert.match(
    attendance,
    /FROM enrollments WHERE organization_id=\?1 AND academic_year_id=\?2 AND campus_id=\?3 AND class_id=\?4/,
  );
  assert.match(
    attendance,
    /Submitted attendance can only be changed by an authorized correction user/,
  );
  assert.match(attendance, /A correction reason is required/);
  assert.match(attendance, /INSERT INTO student_attendance_corrections/);
  assert.match(attendance, /student\.attendance\.submit/);
  assert.match(authorization, /"student_attendance\.correct"/);
  assert.match(
    schema,
    /studentAttendanceSessions\s*=\s*sqliteTable\(\s*"student_attendance_sessions"/,
  );
  assert.match(
    schema,
    /studentAttendanceRecords\s*=\s*sqliteTable\(\s*"student_attendance_records"/,
  );
  assert.match(
    schema,
    /studentAttendanceCorrections\s*=\s*sqliteTable\(\s*"student_attendance_corrections"/,
  );
  assert.match(migration, /student_attendance_session_scope_uq/);
  assert.match(migration, /student_attendance_student_date_uq/);
  assert.match(backup, /"student_attendance_sessions"/);
  assert.match(shell, /\["📅",\s*"Student Attendance"\]/);
});

test("attendance reports, linked-parent visibility, correction approval and alert queues are protected", async () => {
  const reports = await read("app/api/student-attendance/reports/route.ts");
  const attendance = await read("app/api/student-attendance/route.ts");
  const authorization = await read("lib/authorization.ts");
  const schema = await read("db/schema.ts");
  const migration = await read("drizzle/0018_attendance_reports_alerts.sql");
  const backup = await read("app/api/security/backups/route.ts");
  assert.match(reports, /authorize\("student_attendance\.report"\)/);
  assert.match(
    reports,
    /lower\(s\.email\)=lower\(\?2\) OR lower\(g\.email\)=lower\(\?2\)/,
  );
  assert.match(
    reports,
    /You may only request corrections for your linked student record/,
  );
  assert.match(reports, /student_attendance\.approve_correction/);
  assert.match(reports, /INSERT INTO student_attendance_corrections/);
  assert.match(
    reports,
    /UPDATE student_attendance_sessions SET present_count=/,
  );
  assert.match(attendance, /INSERT OR IGNORE INTO attendance_alerts/);
  assert.match(attendance, /g\.communication_opt_in=1/);
  assert.match(authorization, /"student_attendance\.alerts"/);
  assert.match(
    schema,
    /studentAttendanceCorrectionRequests\s*=\s*sqliteTable\(\s*"student_attendance_correction_requests"/,
  );
  assert.match(
    schema,
    /attendanceAlerts\s*=\s*sqliteTable\(\s*"attendance_alerts"/,
  );
  assert.match(migration, /attendance_alert_record_type_uq/);
  assert.match(backup, /"attendance_alerts"/);
});

test("seasonal schedules, periods and timetable entries are tenant and campus scoped", async () => {
  const source = await read("app/api/timetable/route.ts");
  const authorization = await read("lib/authorization.ts");
  const panel = await read("app/TimetablePanel.tsx");
  const migration = await read("drizzle/0019_timetable_foundation.sql");
  assert.match(source, /authorize\("timetable\.view"\)/);
  assert.match(source, /authorize\("timetable\.manage"\)/);
  assert.match(source, /requireCampusAccess\(auth,\s*campusId/);
  assert.match(source, /organization_id=\?1 AND campus_id=\?2/);
  assert.match(source, /This teacher is already assigned during that period/);
  assert.match(authorization, /timetable\.manage/);
  assert.match(source, /'Winter schedule'/);
  assert.match(panel, /Class timetable/);
  assert.match(migration, /school_schedules_campus_season_uq/);
  assert.match(migration, /timetable_entry_teacher_slot_idx/);
});

test("teacher timetables, room conflicts and substitutions are protected and tenant scoped", async () => {
  const source = await read("app/api/timetable/route.ts");
  const panel = await read("app/TimetablePanel.tsx");
  const schema = await read("db/schema.ts");
  const migration = await read(
    "drizzle/0020_teacher_timetable_substitutions.sql",
  );
  const backup = await read("app/api/security/backups/route.ts");
  assert.match(source, /staff WHERE organization_id=\?1 AND campus_id=\?2/);
  assert.doesNotMatch(
    source,
    /staff WHERE organization_id=\?1 AND home_campus_id/,
  );
  assert.match(source, /That room is already in use during this period/);
  assert.match(source, /action === "create_substitution"/);
  assert.match(
    source,
    /The substitute teacher is already teaching in this period/,
  );
  assert.match(source, /timetable\.substitution\.create/);
  assert.match(source, /organization_id=\?1 AND campus_id=\?2/);
  assert.match(panel, /Teacher timetables/);
  assert.match(panel, /Schedule a substitution/);
  assert.match(panel, /Conflict centre/);
  assert.match(schema, /timetableSubstitutions\s*=\s*sqliteTable/);
  assert.match(migration, /timetable_substitution_entry_date_uq/);
  assert.match(backup, /"timetable_substitutions"/);
});

test("examination timetables and events are permission protected, conflict checked and campus scoped", async () => {
  const source = await read("app/api/examination-schedule/route.ts");
  const panel = await read("app/ExaminationSchedulePanel.tsx");
  const schema = await read("db/schema.ts");
  const migration = await read("drizzle/0021_examination_timetable_events.sql");
  const backup = await read("app/api/security/backups/route.ts");
  const auth = await read("lib/authorization.ts");
  assert.match(source, /authorize\("examinations\.view"\)/);
  assert.match(source, /requireCampusAccess\(auth,\s*campusId,\s*permission\)/);
  assert.match(
    source,
    /This invigilator already has an examination during that time/,
  );
  assert.match(source, /This room is already assigned during that time/);
  assert.match(source, /examination\.timetable\.create/);
  assert.match(source, /school\.event\.create/);
  assert.match(panel, /Examination timetable/);
  assert.match(panel, /Events calendar/);
  assert.match(schema, /examinationTimetableEntries\s*=\s*sqliteTable/);
  assert.match(schema, /schoolEvents\s*=\s*sqliteTable/);
  assert.match(migration, /exam_timetable_campus_date_idx/);
  assert.match(migration, /school_events_scope_date_idx/);
  assert.match(backup, /"examination_timetable_entries"/);
  assert.match(auth, /"examinations\.manage"/);
});

test("fee structures and student assignments are financial-permission and campus scoped", async () => {
  const source = await read("app/api/fees/route.ts"),
    panel = await read("app/FeesPanel.tsx"),
    schema = await read("db/schema.ts"),
    migration = await read("drizzle/0022_fee_structures_assignments.sql"),
    backup = await read("app/api/security/backups/route.ts"),
    auth = await read("lib/authorization.ts");
  assert.match(source, /authorize\("fees\.view"\)/);
  assert.match(source, /requireCampusAccess\(auth,\s*campusId/);
  assert.match(source, /fees\.financial/);
  assert.match(
    source,
    /The selected structure does not match this student's enrollment/,
  );
  assert.match(source, /student\.fee\.assign/);
  assert.match(panel, /Fee structures and student assignments/);
  assert.match(schema, /feeStructures\s*=\s*sqliteTable/);
  assert.match(schema, /studentFeeAssignments\s*=\s*sqliteTable/);
  assert.match(migration, /fee_structures_scope_idx/);
  assert.match(migration, /student_fee_assignment_year_uq/);
  assert.match(backup, /"student_fee_assignments"/);
  assert.match(auth, /"fees\.assign"/);
});
