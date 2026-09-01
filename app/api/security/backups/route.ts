import { env } from "cloudflare:workers";
import { authorize } from "../../../../lib/authorization";
import { enforceRateLimit, requireSameOrigin } from "../../../../lib/security";

export const dynamic = "force-dynamic";
const tenantTables = [
  "organizations",
  "organization_settings",
  "campuses",
  "campus_settings",
  "academic_years",
  "academic_terms",
  "grade_levels",
  "classes",
  "sections",
  "subjects",
  "curriculum_mappings",
  "school_schedules",
  "timetable_periods",
  "timetable_entries",
  "timetable_substitutions",
  "examination_timetable_entries",
  "school_events",
  "examination_types",
  "grading_schemes",
  "grade_boundaries",
  "assessments",
  "assessment_marks",
  "result_publications",
  "fee_categories",
  "fee_structures",
  "fee_structure_items",
  "student_fee_assignments",
  "fee_invoices",
  "fee_invoice_items",
  "fee_payments",
  "late_fee_rules",
  "fee_late_fee_applications",
  "expense_categories",
  "expenses",
  "financial_accounts",
  "financial_approval_requests",
  "admission_enquiries",
  "admission_applications",
  "admission_documents",
  "admission_assessments",
  "admission_fee_packages",
  "application_fee_assignments",
  "students",
  "staff",
  "staff_qualifications",
  "staff_experience",
  "staff_documents",
  "teacher_subject_assignments",
  "class_teacher_assignments",
  "staff_attendance",
  "staff_attendance_corrections",
  "student_attendance_sessions",
  "student_attendance_records",
  "student_attendance_corrections",
  "student_attendance_correction_requests",
  "attendance_alerts",
  "leave_types",
  "staff_leave_balances",
  "staff_leave_requests",
  "salary_components",
  "staff_salary_assignments",
  "staff_salary_components",
  "payroll_periods",
  "payroll_items",
  "enrollments",
  "enrollment_events",
  "families",
  "guardians",
  "student_documents",
  "organization_memberships",
  "roles",
  "storage_assets",
  "setting_revisions",
  "audit_logs",
] as const;
export async function POST(request: Request) {
  const sameOrigin = requireSameOrigin(request);
  if (sameOrigin) return sameOrigin;
  const auth = await authorize("backups.create");
  if (!auth)
    return Response.json(
      { error: "You do not have permission to create backups." },
      { status: 403 },
    );
  if (!(await enforceRateLimit(auth, "backup.create", 3, 3600)))
    return Response.json(
      { error: "Backup limit reached. Try again later." },
      { status: 429 },
    );
  const id = crypto.randomUUID(),
    createdAt = Date.now(),
    key = `organizations/${auth.organizationId}/backups/${new Date(createdAt).toISOString().replace(/[:.]/g, "-")}-${id}.json`;
  await env.DB.prepare(
    "INSERT INTO backup_runs (id,organization_id,requested_by,status) VALUES (?1,?2,?3,'running')",
  )
    .bind(id, auth.organizationId, auth.userId)
    .run();
  try {
    const snapshot: Record<string, unknown> = {
      manifest: {
        version: 1,
        organizationId: auth.organizationId,
        createdAt: new Date(createdAt).toISOString(),
        tables: [...tenantTables],
      },
      tables: {},
    };
    const tables = snapshot.tables as Record<string, unknown>;
    for (const table of tenantTables) {
      const orgColumn =
        table === "organizations"
          ? "id"
          : table === "campus_settings"
            ? null
            : "organization_id";
      if (table === "campus_settings")
        tables[table] = (
          await env.DB.prepare(
            "SELECT cs.* FROM campus_settings cs JOIN campuses c ON c.id=cs.campus_id WHERE c.organization_id=?1",
          )
            .bind(auth.organizationId)
            .all()
        ).results;
      else
        tables[table] = (
          await env.DB.prepare(`SELECT * FROM ${table} WHERE ${orgColumn}=?1`)
            .bind(auth.organizationId)
            .all()
        ).results;
    }
    tables.student_guardians = (
      await env.DB.prepare(
        "SELECT sg.* FROM student_guardians sg JOIN students s ON s.id=sg.student_id WHERE s.organization_id=?1",
      )
        .bind(auth.organizationId)
        .all()
    ).results;
    (snapshot.manifest as { tables: string[] }).tables.push(
      "student_guardians",
    );
    const body = JSON.stringify(snapshot),
      bytes = new TextEncoder().encode(body).byteLength;
    await env.BUCKET.put(key, body, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { organizationId: auth.organizationId, backupId: id },
    });
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE backup_runs SET status='completed',r2_key=?1,manifest_json=?2,size_bytes=?3,completed_at=unixepoch()*1000 WHERE id=?4 AND organization_id=?5",
      ).bind(
        key,
        JSON.stringify(snapshot.manifest),
        bytes,
        id,
        auth.organizationId,
      ),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,?3,'backup.create','backup_run',?4,'success',?5)",
      ).bind(
        crypto.randomUUID(),
        auth.organizationId,
        auth.userId,
        id,
        JSON.stringify({ sizeBytes: bytes }),
      ),
    ]);
    return Response.json({ ok: true, id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 300) : "Backup failed";
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE backup_runs SET status='failed',error_message=?1,completed_at=unixepoch()*1000 WHERE id=?2 AND organization_id=?3",
      ).bind(message, id, auth.organizationId),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'backup.create','backup_run',?4,'failed')",
      ).bind(crypto.randomUUID(), auth.organizationId, auth.userId, id),
    ]);
    return Response.json(
      { error: "Backup could not be created." },
      { status: 500 },
    );
  }
}
