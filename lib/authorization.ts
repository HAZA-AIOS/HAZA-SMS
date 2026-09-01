import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getChatGPTUser } from "../app/chatgpt-auth";

export type OrganizationChoice = {
  organizationId: string;
  membershipId: string;
  schoolName: string;
};
export type CampusChoice = { id: string; name: string; isMain: number };
export type AuthzContext = {
  userId: string;
  email: string;
  membershipId: string;
  organizationId: string;
  schoolName: string;
  permissions: Set<string>;
  organizationWide: boolean;
  allowedCampusIds: Set<string>;
  activeCampusId: string | null;
  campuses: CampusChoice[];
};

async function identityMemberships(
  email: string,
): Promise<OrganizationChoice[]> {
  const rows = await env.DB.prepare(
    `
    SELECT om.id membership_id,om.organization_id,o.name school_name
    FROM users u JOIN organization_memberships om ON om.user_id=u.id AND om.status='active'
    JOIN organizations o ON o.id=om.organization_id AND o.status='active'
    WHERE lower(u.email)=lower(?1)
    ORDER BY o.name,om.organization_id
  `,
  )
    .bind(email)
    .all<{
      membership_id: string;
      organization_id: string;
      school_name: string;
    }>();
  return rows.results.map((row) => ({
    membershipId: row.membership_id,
    organizationId: row.organization_id,
    schoolName: row.school_name,
  }));
}

export async function getOrganizationChoices(): Promise<OrganizationChoice[]> {
  const identity = await getChatGPTUser();
  if (!identity || !env.DB) return [];
  return identityMemberships(identity.email);
}

export async function authorize(
  required?: string,
): Promise<AuthzContext | null> {
  const identity = await getChatGPTUser();
  if (!identity || !env.DB) return null;
  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE lower(email)=lower(?1) AND status='active'",
  )
    .bind(identity.email)
    .first<{ id: string }>();
  if (!user) return null;
  const memberships = await identityMemberships(identity.email);
  const cookieStore = await cookies();
  const selectedOrganization = cookieStore.get(
    "sms_active_organization",
  )?.value;
  const member =
    memberships.length === 1
      ? memberships[0]
      : memberships.find(
          (item) => item.organizationId === selectedOrganization,
        );
  if (!member) return null;
  const rows = await env.DB.prepare(
    `
    SELECT DISTINCT p.code,r.scope,mr.campus_id FROM membership_roles mr
    JOIN roles r ON r.id=mr.role_id AND (r.organization_id=?1 OR r.organization_id IS NULL)
    JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
    WHERE mr.membership_id=?2
  `,
  )
    .bind(member.organizationId, member.membershipId)
    .all<{ code: string; scope: string; campus_id: string | null }>();
  const permissions = new Set(rows.results.map((v) => v.code));
  if (required && !permissions.has(required)) return null;
  const organizationWide = rows.results.some(
    (row) => row.scope === "organization" && !row.campus_id,
  );
  const campusRows = await env.DB.prepare(
    `
    SELECT DISTINCT c.id,c.name,c.is_main isMain FROM campuses c
    LEFT JOIN campus_memberships cm ON cm.campus_id=c.id AND cm.membership_id=?2
    LEFT JOIN membership_roles mr ON mr.campus_id=c.id AND mr.membership_id=?2
    WHERE c.organization_id=?1 AND c.status='active' AND (?3=1 OR cm.membership_id IS NOT NULL OR mr.membership_id IS NOT NULL)
    ORDER BY c.is_main DESC,c.name
  `,
  )
    .bind(member.organizationId, member.membershipId, organizationWide ? 1 : 0)
    .all<CampusChoice>();
  const campuses = campusRows.results;
  const allowedCampusIds = new Set(campuses.map((campus) => campus.id));
  const selectedCampus = cookieStore.get("sms_active_campus")?.value;
  const activeCampusId =
    selectedCampus === "all" && organizationWide
      ? null
      : allowedCampusIds.has(selectedCampus ?? "")
        ? selectedCampus!
        : (campuses[0]?.id ?? null);
  return {
    userId: user.id,
    email: identity.email,
    membershipId: member.membershipId,
    organizationId: member.organizationId,
    schoolName: member.schoolName,
    permissions,
    organizationWide,
    allowedCampusIds,
    activeCampusId,
    campuses,
  };
}

export function canAccessCampus(
  auth: AuthzContext,
  campusId: string | null | undefined,
) {
  return (
    !!campusId && (auth.organizationWide || auth.allowedCampusIds.has(campusId))
  );
}

export async function requireCampusAccess(
  auth: AuthzContext,
  campusId: string | null | undefined,
  action = "campus.access",
): Promise<Response | null> {
  if (canAccessCampus(auth, campusId)) return null;
  await env.DB.prepare(
    "INSERT INTO audit_logs (id,organization_id,campus_id,actor_user_id,action,entity_type,entity_id,outcome,metadata_json) VALUES (?1,?2,NULL,?3,?4,'campus',?5,'denied',?6)",
  )
    .bind(
      crypto.randomUUID(),
      auth.organizationId,
      auth.userId,
      action,
      campusId || "missing",
      JSON.stringify({ reason: "campus_scope_denied" }),
    )
    .run();
  return Response.json(
    { error: "You do not have access to this campus." },
    { status: 403, headers: { "cache-control": "private, no-store" } },
  );
}

export async function acceptPendingInvitation(
  email: string,
  displayName: string,
) {
  if (!env.DB) return;
  const pending = await env.DB.prepare(
    `
    SELECT u.id user_id,om.id membership_id,om.organization_id FROM users u
    JOIN organization_memberships om ON om.user_id=u.id AND om.status='invited'
    WHERE lower(u.email)=lower(?1) ORDER BY om.created_at
  `,
  )
    .bind(email)
    .all<{ user_id: string; membership_id: string; organization_id: string }>();
  if (!pending.results.length) return;
  const userId = pending.results[0].user_id;
  const statements = [
    env.DB.prepare(
      "UPDATE users SET display_name=?1,status='active',email_verified_at=COALESCE(email_verified_at,unixepoch()*1000),updated_at=unixepoch()*1000 WHERE id=?2",
    ).bind(displayName, userId),
    env.DB.prepare(
      "INSERT OR IGNORE INTO user_identities (id,user_id,provider,provider_subject) VALUES (?1,?2,'chatgpt',?3)",
    ).bind(crypto.randomUUID(), userId, email.toLowerCase()),
  ];
  for (const invitation of pending.results)
    statements.push(
      env.DB.prepare(
        "UPDATE organization_memberships SET status='active',joined_at=unixepoch()*1000,updated_at=unixepoch()*1000 WHERE id=?1",
      ).bind(invitation.membership_id),
      env.DB.prepare(
        "INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,outcome) VALUES (?1,?2,?3,'membership.accept','organization_membership',?4,'success')",
      ).bind(
        crypto.randomUUID(),
        invitation.organization_id,
        userId,
        invitation.membership_id,
      ),
    );
  await env.DB.batch(statements);
}

const roleTemplates = [
  ["principal", "Principal", "organization"],
  ["school_administrator", "School Administrator", "organization"],
  ["accountant", "Accountant", "organization"],
  ["teacher", "Teacher", "class"],
  ["receptionist", "Receptionist", "campus"],
  ["examination_officer", "Examination Officer", "organization"],
  ["librarian", "Librarian", "campus"],
  ["parent", "Parent", "self"],
  ["student", "Student", "self"],
  ["read_only_auditor", "Read-only Auditor", "organization"],
] as const;

export async function ensureDefaultRoles(organizationId: string) {
  if (!env.DB) return;
  const statements = roleTemplates.map(([key, name, scope]) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO roles (id,organization_id,key,name,scope,is_system) VALUES (?1,?2,?3,?4,?5,1)",
    ).bind(`role:${organizationId}:${key}`, organizationId, key, name, scope),
  );
  const grants: Record<string, string[]> = {
    principal: [
      "organization.view",
      "organization.edit",
      "campus.view",
      "campus.create",
      "campus.edit",
      "users.view",
      "users.create",
      "users.edit",
      "roles.view",
      "audit.view",
    ],
    school_administrator: [
      "organization.view",
      "campus.view",
      "campus.create",
      "campus.edit",
      "users.view",
      "users.create",
      "users.edit",
      "roles.view",
    ],
    accountant: ["organization.view", "campus.view"],
    teacher: ["organization.view", "campus.view"],
    receptionist: ["organization.view", "campus.view", "users.view"],
    examination_officer: ["organization.view", "campus.view"],
    librarian: ["organization.view", "campus.view"],
    parent: ["organization.view"],
    student: ["organization.view"],
    read_only_auditor: [
      "organization.view",
      "campus.view",
      "users.view",
      "roles.view",
      "audit.view",
    ],
  };
  for (const [roleKey, codes] of Object.entries(grants))
    for (const code of codes)
      statements.push(
        env.DB.prepare(
          "INSERT OR IGNORE INTO role_permissions (role_id,permission_id) SELECT ?1,id FROM permissions WHERE code=?2",
        ).bind(`role:${organizationId}:${roleKey}`, code),
      );
  await env.DB.batch(statements);
}

export async function ensureConfigurationAccess(organizationId: string) {
  if (!env.DB) return;
  const definitions = [
    ["permission:settings.view", "settings.view", "settings", "view", 0],
    ["permission:settings.edit", "settings.edit", "settings", "edit", 1],
    [
      "permission:academic_years.view",
      "academic_years.view",
      "academic_years",
      "view",
      0,
    ],
    [
      "permission:academic_years.manage",
      "academic_years.manage",
      "academic_years",
      "manage",
      1,
    ],
    ["permission:academics.view", "academics.view", "academics", "view", 0],
    [
      "permission:academics.manage",
      "academics.manage",
      "academics",
      "manage",
      1,
    ],
    [
      "permission:curriculum.view",
      "curriculum.view",
      "academics",
      "view_curriculum",
      0,
    ],
    [
      "permission:curriculum.manage",
      "curriculum.manage",
      "academics",
      "manage_curriculum",
      1,
    ],
  ] as const;
  const statements = definitions.map((v) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO permissions (id,code,module,action,sensitive) VALUES (?1,?2,?3,?4,?5)",
    ).bind(...v),
  );
  const grants: Record<string, string[]> = {
    super_administrator: definitions.map((v) => v[1]),
    principal: definitions.map((v) => v[1]),
    school_administrator: [
      "settings.view",
      "settings.edit",
      "academic_years.view",
      "academic_years.manage",
      "academics.view",
      "academics.manage",
      "curriculum.view",
      "curriculum.manage",
    ],
    accountant: ["settings.view", "academic_years.view", "academics.view"],
    teacher: [
      "settings.view",
      "academic_years.view",
      "academics.view",
      "curriculum.view",
    ],
    receptionist: ["settings.view", "academic_years.view"],
    examination_officer: [
      "settings.view",
      "academic_years.view",
      "academics.view",
      "curriculum.view",
    ],
    librarian: ["settings.view", "academic_years.view"],
    parent: ["academic_years.view"],
    student: ["academic_years.view"],
    read_only_auditor: [
      "settings.view",
      "academic_years.view",
      "academics.view",
      "curriculum.view",
    ],
  };
  for (const [roleKey, codes] of Object.entries(grants))
    for (const code of codes) {
      const roleId =
        roleKey === "super_administrator"
          ? (
              await env.DB.prepare(
                "SELECT id FROM roles WHERE organization_id=?1 AND key='super_administrator' LIMIT 1",
              )
                .bind(organizationId)
                .first<{ id: string }>()
            )?.id
          : `role:${organizationId}:${roleKey}`;
      if (roleId)
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO role_permissions (role_id,permission_id) SELECT ?1,id FROM permissions WHERE code=?2",
          ).bind(roleId, code),
        );
    }
  await env.DB.batch(statements);
}

export async function ensureSecurityAccess(organizationId: string) {
  if (!env.DB) return;
  const definitions = [
    ["permission:security.view", "security.view", "security", "view", 1],
    ["permission:backups.view", "backups.view", "backups", "view", 1],
    ["permission:backups.create", "backups.create", "backups", "create", 1],
    ["permission:assets.download", "assets.download", "assets", "download", 1],
  ] as const;
  const statements = definitions.map((v) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO permissions (id,code,module,action,sensitive) VALUES (?1,?2,?3,?4,?5)",
    ).bind(...v),
  );
  const superRole = await env.DB.prepare(
    "SELECT id FROM roles WHERE organization_id=?1 AND key='super_administrator' LIMIT 1",
  )
    .bind(organizationId)
    .first<{ id: string }>();
  const grants: Record<string, string[]> = {
    super_administrator: definitions.map((v) => v[1]),
    principal: definitions.map((v) => v[1]),
    school_administrator: [
      "security.view",
      "backups.view",
      "backups.create",
      "assets.download",
    ],
    read_only_auditor: ["security.view", "backups.view"],
    accountant: ["assets.download"],
    teacher: ["assets.download"],
    receptionist: ["assets.download"],
    examination_officer: ["assets.download"],
    librarian: ["assets.download"],
  };
  for (const [key, codes] of Object.entries(grants))
    for (const code of codes) {
      const roleId =
        key === "super_administrator"
          ? superRole?.id
          : `role:${organizationId}:${key}`;
      if (roleId)
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO role_permissions (role_id,permission_id) SELECT ?1,id FROM permissions WHERE code=?2",
          ).bind(roleId, code),
        );
    }
  await env.DB.batch(statements);
}

export async function ensureStudentAccess(organizationId: string) {
  if (!env.DB) return;
  const definitions = [
    ["permission:students.view", "students.view", "students", "view", 1],
    ["permission:students.create", "students.create", "students", "create", 1],
    ["permission:students.edit", "students.edit", "students", "edit", 1],
    [
      "permission:students.archive",
      "students.archive",
      "students",
      "archive",
      1,
    ],
    [
      "permission:students.restore",
      "students.restore",
      "students",
      "restore",
      1,
    ],
    ["permission:students.export", "students.export", "students", "export", 1],
    ["permission:students.import", "students.import", "students", "import", 1],
    ["permission:guardians.view", "guardians.view", "guardians", "view", 1],
    [
      "permission:guardians.manage",
      "guardians.manage",
      "guardians",
      "manage",
      1,
    ],
    [
      "permission:student_documents.verify",
      "student_documents.verify",
      "student_documents",
      "verify",
      1,
    ],
    [
      "permission:enrollments.manage",
      "enrollments.manage",
      "enrollments",
      "manage",
      1,
    ],
    ["permission:promotions.view", "promotions.view", "promotions", "view", 1],
    [
      "permission:promotions.manage",
      "promotions.manage",
      "promotions",
      "manage",
      1,
    ],
    [
      "permission:promotions.apply",
      "promotions.apply",
      "promotions",
      "apply",
      1,
    ],
    [
      "permission:student_attendance.view",
      "student_attendance.view",
      "student_attendance",
      "view",
      1,
    ],
    [
      "permission:student_attendance.manage",
      "student_attendance.manage",
      "student_attendance",
      "manage",
      1,
    ],
    [
      "permission:student_attendance.correct",
      "student_attendance.correct",
      "student_attendance",
      "correct",
      1,
    ],
    [
      "permission:student_attendance.report",
      "student_attendance.report",
      "student_attendance",
      "report",
      1,
    ],
    [
      "permission:student_attendance.request_correction",
      "student_attendance.request_correction",
      "student_attendance",
      "request_correction",
      1,
    ],
    [
      "permission:student_attendance.approve_correction",
      "student_attendance.approve_correction",
      "student_attendance",
      "approve_correction",
      1,
    ],
    [
      "permission:student_attendance.alerts",
      "student_attendance.alerts",
      "student_attendance",
      "alerts",
      1,
    ],
  ] as const;
  const statements = definitions.map((v) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO permissions (id,code,module,action,sensitive) VALUES (?1,?2,?3,?4,?5)",
    ).bind(...v),
  );
  const superRole = await env.DB.prepare(
    "SELECT id FROM roles WHERE organization_id=?1 AND key='super_administrator' LIMIT 1",
  )
    .bind(organizationId)
    .first<{ id: string }>();
  const grants: Record<string, string[]> = {
    super_administrator: definitions.map((v) => v[1]),
    principal: definitions.map((v) => v[1]),
    school_administrator: definitions.map((v) => v[1]),
    receptionist: [
      "students.view",
      "students.create",
      "students.edit",
      "students.import",
      "guardians.view",
      "guardians.manage",
      "enrollments.manage",
      "student_attendance.view",
      "student_attendance.report",
    ],
    teacher: [
      "students.view",
      "guardians.view",
      "student_attendance.view",
      "student_attendance.manage",
      "student_attendance.report",
      "student_attendance.request_correction",
    ],
    examination_officer: [
      "students.view",
      "guardians.view",
      "student_documents.verify",
      "promotions.view",
      "student_attendance.view",
      "student_attendance.report",
    ],
    accountant: ["students.view", "guardians.view"],
    librarian: ["students.view"],
    parent: [
      "student_attendance.view",
      "student_attendance.report",
      "student_attendance.request_correction",
    ],
    student: [
      "student_attendance.view",
      "student_attendance.report",
      "student_attendance.request_correction",
    ],
    read_only_auditor: [
      "students.view",
      "students.export",
      "guardians.view",
      "promotions.view",
      "student_attendance.view",
      "student_attendance.report",
    ],
  };
  for (const [key, codes] of Object.entries(grants))
    for (const code of codes) {
      const roleId =
        key === "super_administrator"
          ? superRole?.id
          : `role:${organizationId}:${key}`;
      if (roleId)
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO role_permissions (role_id,permission_id) SELECT ?1,id FROM permissions WHERE code=?2",
          ).bind(roleId, code),
        );
    }
  await env.DB.batch(statements);
}

export async function ensureAdmissionAccess(organizationId: string) {
  if (!env.DB) return;
  const definitions = [
    ["permission:admissions.view", "admissions.view", "admissions", "view", 1],
    [
      "permission:admissions.create",
      "admissions.create",
      "admissions",
      "create",
      1,
    ],
    ["permission:admissions.edit", "admissions.edit", "admissions", "edit", 1],
    [
      "permission:admissions.convert",
      "admissions.convert",
      "admissions",
      "convert",
      1,
    ],
    [
      "permission:admissions.documents",
      "admissions.documents",
      "admissions",
      "upload_documents",
      1,
    ],
    [
      "permission:admissions.verify_documents",
      "admissions.verify_documents",
      "admissions",
      "verify_documents",
      1,
    ],
    [
      "permission:admissions.assessments",
      "admissions.assessments",
      "admissions",
      "manage_assessments",
      1,
    ],
    [
      "permission:admissions.approve",
      "admissions.approve",
      "admissions",
      "approve",
      1,
    ],
    [
      "permission:admissions.fee_packages",
      "admissions.fee_packages",
      "admissions",
      "manage_fee_packages",
      1,
    ],
    [
      "permission:admissions.assign_fee",
      "admissions.assign_fee",
      "admissions",
      "assign_fee",
      1,
    ],
    [
      "permission:admissions.enroll",
      "admissions.enroll",
      "admissions",
      "convert_to_student",
      1,
    ],
    [
      "permission:admissions.print",
      "admissions.print",
      "admissions",
      "print",
      1,
    ],
    [
      "permission:admissions.report",
      "admissions.report",
      "admissions",
      "report",
      1,
    ],
    [
      "permission:admissions.export",
      "admissions.export",
      "admissions",
      "export",
      1,
    ],
  ] as const;
  const statements = definitions.map((v) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO permissions (id,code,module,action,sensitive) VALUES (?1,?2,?3,?4,?5)",
    ).bind(...v),
  );
  const superRole = await env.DB.prepare(
    "SELECT id FROM roles WHERE organization_id=?1 AND key='super_administrator' LIMIT 1",
  )
    .bind(organizationId)
    .first<{ id: string }>();
  const grants: Record<string, string[]> = {
    super_administrator: definitions.map((v) => v[1]),
    principal: definitions.map((v) => v[1]),
    school_administrator: definitions.map((v) => v[1]),
    receptionist: [
      "admissions.view",
      "admissions.create",
      "admissions.edit",
      "admissions.convert",
      "admissions.documents",
      "admissions.assessments",
      "admissions.assign_fee",
      "admissions.print",
      "admissions.report",
    ],
    examination_officer: [
      "admissions.view",
      "admissions.verify_documents",
      "admissions.assessments",
      "admissions.print",
      "admissions.report",
    ],
    read_only_auditor: [
      "admissions.view",
      "admissions.report",
      "admissions.export",
    ],
    accountant: ["admissions.view", "admissions.report", "admissions.export"],
  };
  for (const [key, codes] of Object.entries(grants))
    for (const code of codes) {
      const roleId =
        key === "super_administrator"
          ? superRole?.id
          : `role:${organizationId}:${key}`;
      if (roleId)
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO role_permissions (role_id,permission_id) SELECT ?1,id FROM permissions WHERE code=?2",
          ).bind(roleId, code),
        );
    }
  await env.DB.batch(statements);
}

export async function ensureStaffAccess(organizationId: string) {
  if (!env.DB) return;
  const definitions = [
    ["permission:staff.view", "staff.view", "staff", "view", 1],
    ["permission:staff.create", "staff.create", "staff", "create", 1],
    ["permission:staff.edit", "staff.edit", "staff", "edit", 1],
    ["permission:staff.archive", "staff.archive", "staff", "archive", 1],
    [
      "permission:staff.documents",
      "staff.documents",
      "staff",
      "upload_documents",
      1,
    ],
    [
      "permission:staff.verify_documents",
      "staff.verify_documents",
      "staff",
      "verify_documents",
      1,
    ],
    [
      "permission:staff.financial",
      "staff.financial",
      "staff",
      "view_financial",
      1,
    ],
    ["permission:staff.import", "staff.import", "staff", "import", 1],
    ["permission:staff.export", "staff.export", "staff", "export", 1],
    [
      "permission:teacher_assignments.view",
      "teacher_assignments.view",
      "teachers",
      "view_assignments",
      0,
    ],
    [
      "permission:teacher_assignments.manage",
      "teacher_assignments.manage",
      "teachers",
      "manage_assignments",
      1,
    ],
    [
      "permission:subjects.manage",
      "subjects.manage",
      "academics",
      "manage_subjects",
      1,
    ],
    [
      "permission:staff_attendance.view",
      "staff_attendance.view",
      "attendance",
      "view",
      0,
    ],
    [
      "permission:staff_attendance.manage",
      "staff_attendance.manage",
      "attendance",
      "manage",
      1,
    ],
    [
      "permission:staff_attendance.correct",
      "staff_attendance.correct",
      "attendance",
      "correct",
      1,
    ],
    ["permission:staff_leave.view", "staff_leave.view", "leave", "view", 0],
    [
      "permission:staff_leave.request",
      "staff_leave.request",
      "leave",
      "request",
      0,
    ],
    [
      "permission:staff_leave.approve",
      "staff_leave.approve",
      "leave",
      "approve",
      1,
    ],
    [
      "permission:leave_types.manage",
      "leave_types.manage",
      "leave",
      "manage_types",
      1,
    ],
    ["permission:payroll.view", "payroll.view", "payroll", "view", 1],
    [
      "permission:payroll.configure",
      "payroll.configure",
      "payroll",
      "configure",
      1,
    ],
    [
      "permission:payroll.generate",
      "payroll.generate",
      "payroll",
      "generate",
      1,
    ],
    ["permission:payroll.approve", "payroll.approve", "payroll", "approve", 1],
    [
      "permission:payslips.view",
      "payslips.view",
      "payroll",
      "view_payslips",
      1,
    ],
  ] as const;
  const statements = definitions.map((v) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO permissions (id,code,module,action,sensitive) VALUES (?1,?2,?3,?4,?5)",
    ).bind(...v),
  );
  const superRole = await env.DB.prepare(
    "SELECT id FROM roles WHERE organization_id=?1 AND key='super_administrator' LIMIT 1",
  )
    .bind(organizationId)
    .first<{ id: string }>();
  const grants: Record<string, string[]> = {
    super_administrator: definitions.map((v) => v[1]),
    principal: definitions.map((v) => v[1]),
    school_administrator: definitions.map((v) => v[1]),
    accountant: [
      "staff.view",
      "staff.financial",
      "staff.export",
      "staff_attendance.view",
      "staff_leave.view",
      "payroll.view",
      "payroll.configure",
      "payroll.generate",
      "payslips.view",
    ],
    teacher: [
      "teacher_assignments.view",
      "staff_attendance.view",
      "staff_leave.view",
      "staff_leave.request",
      "staff_attendance.correct",
    ],
    receptionist: ["staff.view", "staff_attendance.view"],
    examination_officer: [
      "staff.view",
      "teacher_assignments.view",
      "staff_attendance.view",
    ],
    read_only_auditor: [
      "staff.view",
      "staff.export",
      "teacher_assignments.view",
      "staff_attendance.view",
      "staff_leave.view",
      "payroll.view",
    ],
  };
  for (const [key, codes] of Object.entries(grants))
    for (const code of codes) {
      const roleId =
        key === "super_administrator"
          ? superRole?.id
          : `role:${organizationId}:${key}`;
      if (roleId)
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO role_permissions (role_id,permission_id) SELECT ?1,id FROM permissions WHERE code=?2",
          ).bind(roleId, code),
        );
    }
  await env.DB.batch(statements);
}

export async function ensureTimetableAccess(organizationId: string) {
  if (!env.DB) return;
  const definitions = [
    ["permission:timetable.view", "timetable.view", "timetable", "view", 0],
    [
      "permission:timetable.manage",
      "timetable.manage",
      "timetable",
      "manage",
      1,
    ],
  ] as const;
  const statements = definitions.map((v) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO permissions (id,code,module,action,sensitive) VALUES (?1,?2,?3,?4,?5)",
    ).bind(...v),
  );
  const superRole = await env.DB.prepare(
    "SELECT id FROM roles WHERE organization_id=?1 AND key='super_administrator' LIMIT 1",
  )
    .bind(organizationId)
    .first<{ id: string }>();
  const grants: Record<string, string[]> = {
    super_administrator: definitions.map((v) => v[1]),
    principal: definitions.map((v) => v[1]),
    school_administrator: definitions.map((v) => v[1]),
    teacher: ["timetable.view"],
    examination_officer: ["timetable.view"],
    receptionist: ["timetable.view"],
    student: ["timetable.view"],
    parent: ["timetable.view"],
    read_only_auditor: ["timetable.view"],
  };
  for (const [key, codes] of Object.entries(grants))
    for (const code of codes) {
      const roleId =
        key === "super_administrator"
          ? superRole?.id
          : `role:${organizationId}:${key}`;
      if (roleId)
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO role_permissions (role_id,permission_id) SELECT ?1,id FROM permissions WHERE code=?2",
          ).bind(roleId, code),
        );
    }
  await env.DB.batch(statements);
}

export async function ensureExaminationScheduleAccess(organizationId: string) {
  if (!env.DB) return;
  const definitions = [
    [
      "permission:examinations.view",
      "examinations.view",
      "examinations",
      "view",
      0,
    ],
    [
      "permission:examinations.manage",
      "examinations.manage",
      "examinations",
      "manage",
      1,
    ],
    ["permission:events.view", "events.view", "events", "view", 0],
    ["permission:events.manage", "events.manage", "events", "manage", 1],
    [
      "permission:examination_types.manage",
      "examination_types.manage",
      "examinations",
      "manage_types",
      1,
    ],
    [
      "permission:assessments.manage",
      "assessments.manage",
      "examinations",
      "manage_assessments",
      1,
    ],
    [
      "permission:grading.manage",
      "grading.manage",
      "examinations",
      "manage_grading",
      1,
    ],
    ["permission:marks.enter", "marks.enter", "examinations", "enter_marks", 1],
    ["permission:results.approve", "results.approve", "examinations", "approve_results", 1],
    ["permission:results.publish", "results.publish", "examinations", "publish_results", 1],
    ["permission:result_cards.print", "result_cards.print", "examinations", "print_result_cards", 1],
  ] as const;
  const statements = definitions.map((v) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO permissions (id,code,module,action,sensitive) VALUES (?1,?2,?3,?4,?5)",
    ).bind(...v),
  );
  const superRole = await env.DB.prepare(
    "SELECT id FROM roles WHERE organization_id=?1 AND key='super_administrator' LIMIT 1",
  )
    .bind(organizationId)
    .first<{ id: string }>();
  const grants: Record<string, string[]> = {
    super_administrator: definitions.map((v) => v[1]),
    principal: definitions.map((v) => v[1]),
    school_administrator: definitions.map((v) => v[1]).filter((v) => v !== "results.publish"),
    examination_officer: definitions.map((v) => v[1]).filter((v) => v !== "results.publish"),
    teacher: ["examinations.view", "events.view", "marks.enter", "result_cards.print"],
    receptionist: ["events.view"],
    parent: ["examinations.view", "events.view", "result_cards.print"],
    student: ["examinations.view", "events.view", "result_cards.print"],
    read_only_auditor: ["examinations.view", "events.view"],
  };
  for (const [key, codes] of Object.entries(grants))
    for (const code of codes) {
      const roleId =
        key === "super_administrator"
          ? superRole?.id
          : `role:${organizationId}:${key}`;
      if (roleId)
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO role_permissions (role_id,permission_id) SELECT ?1,id FROM permissions WHERE code=?2",
          ).bind(roleId, code),
        );
    }
  await env.DB.batch(statements);
}

export async function ensureFeeAccess(organizationId: string) {
  if (!env.DB) return;
  const definitions = [
    ["permission:fees.view", "fees.view", "fees", "view", 0],
    ["permission:fees.manage", "fees.manage", "fees", "manage", 1],
    ["permission:fees.assign", "fees.assign", "fees", "assign", 1],
    ["permission:fees.invoice", "fees.invoice", "fees", "create_invoice", 1],
    ["permission:fees.collect", "fees.collect", "fees", "collect", 1],
    ["permission:fees.print", "fees.print", "fees", "print", 1],
    ["permission:fees.late_fees", "fees.late_fees", "fees", "late_fees", 1],
    [
      "permission:expenses.manage",
      "expenses.manage",
      "finance",
      "manage_expenses",
      1,
    ],
    ["permission:finance.reports", "finance.reports", "finance", "reports", 1],
    [
      "permission:finance.accounts",
      "finance.accounts",
      "finance",
      "manage_accounts",
      1,
    ],
    ["permission:finance.approve", "finance.approve", "finance", "approve", 1],
    ["permission:finance.export", "finance.export", "finance", "export", 1],
    [
      "permission:fees.financial",
      "fees.financial",
      "fees",
      "view_financial",
      1,
    ],
  ] as const;
  const statements = definitions.map((v) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO permissions (id,code,module,action,sensitive) VALUES (?1,?2,?3,?4,?5)",
    ).bind(...v),
  );
  const superRole = await env.DB.prepare(
    "SELECT id FROM roles WHERE organization_id=?1 AND key='super_administrator' LIMIT 1",
  )
    .bind(organizationId)
    .first<{ id: string }>();
  const grants: Record<string, string[]> = {
    super_administrator: definitions.map((v) => v[1]),
    principal: definitions.map((v) => v[1]),
    school_administrator: [
      "fees.view",
      "fees.manage",
      "fees.assign",
      "fees.invoice",
      "fees.collect",
      "fees.print",
      "fees.late_fees",
      "expenses.manage",
      "finance.reports",
      "finance.accounts",
      "finance.export",
    ],
    accountant: definitions
      .map((v) => v[1])
      .filter((code) => code !== "finance.approve"),
    receptionist: ["fees.view"],
    read_only_auditor: ["fees.view", "fees.financial"],
  };
  for (const [key, codes] of Object.entries(grants))
    for (const code of codes) {
      const roleId =
        key === "super_administrator"
          ? superRole?.id
          : `role:${organizationId}:${key}`;
      if (roleId)
        statements.push(
          env.DB.prepare(
            "INSERT OR IGNORE INTO role_permissions (role_id,permission_id) SELECT ?1,id FROM permissions WHERE code=?2",
          ).bind(roleId, code),
        );
    }
  await env.DB.batch(statements);
}
