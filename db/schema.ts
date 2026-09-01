import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const ts = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    abbreviation: text("abbreviation"),
    institutionType: text("institution_type").notNull().default("school"),
    status: text("status").notNull().default("active"),
    ownerUserId: text("owner_user_id"),
    ...ts,
  },
  (t) => [
    uniqueIndex("organizations_slug_uq").on(t.slug),
    index("organizations_status_idx").on(t.status),
  ],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    phone: text("phone"),
    status: text("status").notNull().default("invited"),
    emailVerifiedAt: integer("email_verified_at", { mode: "timestamp_ms" }),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    ...ts,
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    index("users_status_idx").on(t.status),
  ],
);

export const userIdentities = sqliteTable(
  "user_identities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    passwordHash: text("password_hash"),
    ...ts,
  },
  (t) => [
    uniqueIndex("identities_provider_subject_uq").on(
      t.provider,
      t.providerSubject,
    ),
    index("identities_user_idx").on(t.userId),
  ],
);

export const campuses = sqliteTable(
  "campuses",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    abbreviation: text("abbreviation"),
    isMain: integer("is_main", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("active"),
    ...ts,
  },
  (t) => [
    uniqueIndex("campuses_org_code_uq").on(t.organizationId, t.code),
    index("campuses_org_status_idx").on(t.organizationId, t.status),
  ],
);

export const organizationMemberships = sqliteTable(
  "organization_memberships",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("invited"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" }),
    ...ts,
  },
  (t) => [
    uniqueIndex("memberships_org_user_uq").on(t.organizationId, t.userId),
    index("memberships_user_status_idx").on(t.userId, t.status),
  ],
);

export const campusMemberships = sqliteTable(
  "campus_memberships",
  {
    membershipId: text("membership_id")
      .notNull()
      .references(() => organizationMemberships.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    ...ts,
  },
  (t) => [
    primaryKey({ columns: [t.membershipId, t.campusId] }),
    index("campus_memberships_campus_idx").on(t.campusId),
  ],
);

export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    scope: text("scope").notNull().default("organization"),
    isSystem: integer("is_system", { mode: "boolean" })
      .notNull()
      .default(false),
    ...ts,
  },
  (t) => [
    uniqueIndex("roles_org_key_uq").on(t.organizationId, t.key),
    index("roles_org_idx").on(t.organizationId),
  ],
);

export const permissions = sqliteTable(
  "permissions",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    module: text("module").notNull(),
    action: text("action").notNull(),
    description: text("description"),
    sensitive: integer("sensitive", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => [
    uniqueIndex("permissions_code_uq").on(t.code),
    index("permissions_module_idx").on(t.module),
  ],
);

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index("role_permissions_permission_idx").on(t.permissionId),
  ],
);

export const membershipRoles = sqliteTable(
  "membership_roles",
  {
    membershipId: text("membership_id")
      .notNull()
      .references(() => organizationMemberships.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    assignedBy: text("assigned_by").references(() => users.id),
    assignedAt: integer("assigned_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    primaryKey({ columns: [t.membershipId, t.roleId] }),
    index("membership_roles_campus_idx").on(t.campusId),
  ],
);

export const academicYears = sqliteTable(
  "academic_years",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    isCurrent: integer("is_current", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull().default("draft"),
    submittedBy: text("submitted_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    submittedAt: integer("submitted_at"),
    approvedBy: text("approved_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    approvedAt: integer("approved_at"),
    publishedBy: text("published_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    publishedAt: integer("published_at"),
    approvalRemarks: text("approval_remarks"),
    ...ts,
  },
  (t) => [
    uniqueIndex("academic_years_org_name_uq").on(t.organizationId, t.name),
    index("academic_years_org_current_idx").on(t.organizationId, t.isCurrent),
  ],
);

export const classes = sqliteTable(
  "classes",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").notNull().default("active"),
    ...ts,
  },
  (t) => [
    uniqueIndex("classes_org_campus_code_uq").on(
      t.organizationId,
      t.campusId,
      t.code,
    ),
    index("classes_org_status_idx").on(t.organizationId, t.status),
  ],
);

export const sections = sqliteTable(
  "sections",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    capacity: integer("capacity"),
    status: text("status").notNull().default("active"),
    ...ts,
  },
  (t) => [
    uniqueIndex("sections_campus_class_code_uq").on(
      t.campusId,
      t.classId,
      t.code,
    ),
    index("sections_org_status_idx").on(t.organizationId, t.status),
  ],
);

export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    subjectType: text("subject_type").notNull().default("academic"),
    color: text("color").notNull().default("#7456de"),
    status: text("status").notNull().default("active"),
    ...ts,
  },
  (t) => [
    uniqueIndex("subjects_org_code_uq").on(t.organizationId, t.code),
    index("subjects_org_status_idx").on(t.organizationId, t.status),
  ],
);

export const teacherSubjectAssignments = sqliteTable(
  "teacher_subject_assignments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sectionId: text("section_id").references(() => sections.id, {
      onDelete: "cascade",
    }),
    weeklyPeriods: integer("weekly_periods").notNull().default(1),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull().default("active"),
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("teacher_subject_assignment_uq").on(
      t.academicYearId,
      t.staffId,
      t.subjectId,
      t.classId,
      t.sectionId,
    ),
    index("teacher_subject_teacher_idx").on(
      t.organizationId,
      t.staffId,
      t.academicYearId,
    ),
    index("teacher_subject_class_idx").on(
      t.organizationId,
      t.classId,
      t.sectionId,
      t.academicYearId,
    ),
  ],
);

export const classTeacherAssignments = sqliteTable(
  "class_teacher_assignments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sectionId: text("section_id").references(() => sections.id, {
      onDelete: "cascade",
    }),
    scopeKey: text("scope_key").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("class_teacher_scope_uq").on(
      t.organizationId,
      t.academicYearId,
      t.scopeKey,
    ),
    index("class_teacher_staff_idx").on(
      t.organizationId,
      t.staffId,
      t.academicYearId,
    ),
  ],
);

export const admissionEnquiries = sqliteTable(
  "admission_enquiries",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    enquiryNumber: text("enquiry_number").notNull(),
    childFirstName: text("child_first_name").notNull(),
    childLastName: text("child_last_name"),
    dateOfBirth: text("date_of_birth"),
    gender: text("gender"),
    applyingClassId: text("applying_class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    desiredAcademicYearId: text("desired_academic_year_id").references(
      () => academicYears.id,
      { onDelete: "set null" },
    ),
    guardianName: text("guardian_name").notNull(),
    relationship: text("relationship"),
    primaryPhone: text("primary_phone").notNull(),
    email: text("email"),
    source: text("source"),
    status: text("status").notNull().default("new"),
    priority: text("priority").notNull().default("normal"),
    nextFollowUpOn: text("next_follow_up_on"),
    notes: text("notes"),
    assignedTo: text("assigned_to").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("admission_enquiries_org_number_uq").on(
      t.organizationId,
      t.enquiryNumber,
    ),
    index("admission_enquiries_org_status_idx").on(
      t.organizationId,
      t.status,
      t.createdAt,
    ),
    index("admission_enquiries_campus_followup_idx").on(
      t.campusId,
      t.nextFollowUpOn,
    ),
  ],
);

export const admissionApplications = sqliteTable(
  "admission_applications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    enquiryId: text("enquiry_id").references(() => admissionEnquiries.id, {
      onDelete: "set null",
    }),
    applicationNumber: text("application_number").notNull(),
    childFirstName: text("child_first_name").notNull(),
    childLastName: text("child_last_name"),
    dateOfBirth: text("date_of_birth"),
    gender: text("gender"),
    applyingClassId: text("applying_class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    academicYearId: text("academic_year_id").references(
      () => academicYears.id,
      { onDelete: "set null" },
    ),
    guardianName: text("guardian_name").notNull(),
    guardianRelationship: text("guardian_relationship"),
    guardianNationalId: text("guardian_national_id"),
    guardianOccupation: text("guardian_occupation"),
    primaryPhone: text("primary_phone").notNull(),
    alternatePhone: text("alternate_phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    previousSchool: text("previous_school"),
    previousClass: text("previous_class"),
    medicalNotes: text("medical_notes"),
    specialNeeds: text("special_needs"),
    status: text("status").notNull().default("draft"),
    submittedOn: text("submitted_on"),
    declarationAccepted: integer("declaration_accepted", { mode: "boolean" })
      .notNull()
      .default(false),
    decisionNotes: text("decision_notes"),
    decidedBy: text("decided_by").references(() => users.id, {
      onDelete: "set null",
    }),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    notes: text("notes"),
    studentId: text("student_id"),
    convertedBy: text("converted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    convertedAt: integer("converted_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("admission_applications_org_number_uq").on(
      t.organizationId,
      t.applicationNumber,
    ),
    uniqueIndex("admission_applications_enquiry_uq").on(t.enquiryId),
    index("admission_applications_org_status_idx").on(
      t.organizationId,
      t.status,
      t.createdAt,
    ),
    index("admission_applications_campus_class_idx").on(
      t.campusId,
      t.applyingClassId,
    ),
  ],
);

export const admissionFeePackages = sqliteTable(
  "admission_fee_packages",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    classId: text("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    admissionFee: integer("admission_fee").notNull().default(0),
    registrationFee: integer("registration_fee").notNull().default(0),
    securityDeposit: integer("security_deposit").notNull().default(0),
    monthlyTuition: integer("monthly_tuition").notNull().default(0),
    annualCharges: integer("annual_charges").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("admission_fee_packages_org_code_uq").on(
      t.organizationId,
      t.code,
    ),
    index("admission_fee_packages_scope_idx").on(
      t.organizationId,
      t.campusId,
      t.classId,
      t.status,
    ),
  ],
);

export const applicationFeeAssignments = sqliteTable(
  "application_fee_assignments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    applicationId: text("application_id")
      .notNull()
      .references(() => admissionApplications.id, { onDelete: "cascade" }),
    feePackageId: text("fee_package_id")
      .notNull()
      .references(() => admissionFeePackages.id, { onDelete: "restrict" }),
    discountAmount: integer("discount_amount").notNull().default(0),
    discountReason: text("discount_reason"),
    notes: text("notes"),
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("application_fee_assignments_app_uq").on(t.applicationId),
    index("application_fee_assignments_org_package_idx").on(
      t.organizationId,
      t.feePackageId,
    ),
  ],
);

export const admissionAssessments = sqliteTable(
  "admission_assessments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    applicationId: text("application_id")
      .notNull()
      .references(() => admissionApplications.id, { onDelete: "cascade" }),
    assessmentType: text("assessment_type").notNull(),
    scheduledAt: text("scheduled_at").notNull(),
    venue: text("venue"),
    maxScore: integer("max_score"),
    score: integer("score"),
    result: text("result").notNull().default("scheduled"),
    remarks: text("remarks"),
    conductedBy: text("conducted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    index("admission_assessments_app_idx").on(
      t.organizationId,
      t.applicationId,
      t.scheduledAt,
    ),
    index("admission_assessments_result_idx").on(
      t.organizationId,
      t.result,
      t.scheduledAt,
    ),
  ],
);

export const students = sqliteTable(
  "students",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    homeCampusId: text("home_campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    admissionNumber: text("admission_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    preferredName: text("preferred_name"),
    gender: text("gender"),
    dateOfBirth: text("date_of_birth"),
    bloodGroup: text("blood_group"),
    nationality: text("nationality"),
    religion: text("religion"),
    nationalId: text("national_id"),
    placeOfBirth: text("place_of_birth"),
    motherTongue: text("mother_tongue"),
    domicileDistrict: text("domicile_district"),
    identityMark: text("identity_mark"),
    admissionCategory: text("admission_category"),
    admissionSource: text("admission_source"),
    previousAdmissionNumber: text("previous_admission_number"),
    phone: text("phone"),
    email: text("email"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    province: text("province"),
    postalCode: text("postal_code"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    emergencyContactRelation: text("emergency_contact_relation"),
    medicalNotes: text("medical_notes"),
    allergies: text("allergies"),
    dietaryRequirements: text("dietary_requirements"),
    specialNeeds: text("special_needs"),
    accessibilityNotes: text("accessibility_notes"),
    doctorName: text("doctor_name"),
    doctorPhone: text("doctor_phone"),
    vaccinationNotes: text("vaccination_notes"),
    previousSchool: text("previous_school"),
    previousClass: text("previous_class"),
    profileNotes: text("profile_notes"),
    enrollmentStatus: text("enrollment_status").notNull().default("active"),
    photoAssetId: text("photo_asset_id").references(() => storageAssets.id, {
      onDelete: "set null",
    }),
    admittedOn: text("admitted_on"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    archivedBy: text("archived_by").references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("students_org_admission_uq").on(
      t.organizationId,
      t.admissionNumber,
    ),
    index("students_org_status_name_idx").on(
      t.organizationId,
      t.enrollmentStatus,
      t.firstName,
      t.lastName,
    ),
    index("students_campus_status_idx").on(t.homeCampusId, t.enrollmentStatus),
  ],
);

export const staff = sqliteTable(
  "staff",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    employeeNumber: text("employee_number").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    preferredName: text("preferred_name"),
    gender: text("gender"),
    dateOfBirth: text("date_of_birth"),
    nationalId: text("national_id"),
    nationality: text("nationality"),
    religion: text("religion"),
    bloodGroup: text("blood_group"),
    maritalStatus: text("marital_status"),
    phone: text("phone").notNull(),
    alternatePhone: text("alternate_phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    province: text("province"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    emergencyContactRelation: text("emergency_contact_relation"),
    department: text("department"),
    designation: text("designation").notNull(),
    employmentType: text("employment_type").notNull().default("full_time"),
    staffCategory: text("staff_category").notNull().default("teaching"),
    qualificationSummary: text("qualification_summary"),
    experienceYears: integer("experience_years").notNull().default(0),
    joinedOn: text("joined_on").notNull(),
    confirmedOn: text("confirmed_on"),
    probationEndsOn: text("probation_ends_on"),
    leftOn: text("left_on"),
    leavingReason: text("leaving_reason"),
    status: text("status").notNull().default("active"),
    bankName: text("bank_name"),
    bankAccountTitle: text("bank_account_title"),
    bankAccountNumber: text("bank_account_number"),
    taxNumber: text("tax_number"),
    baseSalary: integer("base_salary"),
    payrollNotes: text("payroll_notes"),
    profileNotes: text("profile_notes"),
    photoAssetId: text("photo_asset_id").references(() => storageAssets.id, {
      onDelete: "set null",
    }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    archivedBy: text("archived_by").references(() => users.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("staff_org_employee_uq").on(t.organizationId, t.employeeNumber),
    index("staff_org_status_name_idx").on(
      t.organizationId,
      t.status,
      t.firstName,
      t.lastName,
    ),
    index("staff_campus_status_idx").on(t.campusId, t.status),
    index("staff_org_designation_idx").on(t.organizationId, t.designation),
  ],
);

export const staffQualifications = sqliteTable(
  "staff_qualifications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    degree: text("degree").notNull(),
    institution: text("institution"),
    fieldOfStudy: text("field_of_study"),
    completedOn: text("completed_on"),
    grade: text("grade"),
    notes: text("notes"),
    ...ts,
  },
  (t) => [
    index("staff_qualifications_staff_idx").on(t.organizationId, t.staffId),
  ],
);

export const staffExperience = sqliteTable(
  "staff_experience",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    employer: text("employer").notNull(),
    jobTitle: text("job_title").notNull(),
    startedOn: text("started_on"),
    endedOn: text("ended_on"),
    responsibilities: text("responsibilities"),
    ...ts,
  },
  (t) => [index("staff_experience_staff_idx").on(t.organizationId, t.staffId)],
);

export const staffDocuments = sqliteTable(
  "staff_documents",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => storageAssets.id, { onDelete: "restrict" }),
    documentType: text("document_type").notNull(),
    title: text("title").notNull(),
    issuedOn: text("issued_on"),
    expiresOn: text("expires_on"),
    verificationStatus: text("verification_status")
      .notNull()
      .default("pending"),
    notes: text("notes"),
    ...ts,
  },
  (t) => [
    index("staff_documents_staff_idx").on(
      t.organizationId,
      t.staffId,
      t.createdAt,
    ),
  ],
);

export const enrollments = sqliteTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    classId: text("class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    sectionId: text("section_id").references(() => sections.id, {
      onDelete: "set null",
    }),
    rollNumber: text("roll_number"),
    status: text("status").notNull().default("active"),
    enrolledOn: text("enrolled_on"),
    endedOn: text("ended_on"),
    ...ts,
  },
  (t) => [
    uniqueIndex("enrollments_student_year_uq").on(
      t.studentId,
      t.academicYearId,
    ),
    index("enrollments_org_year_class_idx").on(
      t.organizationId,
      t.academicYearId,
      t.classId,
    ),
    index("enrollments_campus_section_idx").on(t.campusId, t.sectionId),
  ],
);

export const enrollmentEvents = sqliteTable(
  "enrollment_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id").references(() => enrollments.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    fromCampusId: text("from_campus_id").references(() => campuses.id, {
      onDelete: "set null",
    }),
    toCampusId: text("to_campus_id").references(() => campuses.id, {
      onDelete: "set null",
    }),
    fromClassId: text("from_class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    toClassId: text("to_class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    effectiveOn: text("effective_on").notNull(),
    reason: text("reason"),
    notes: text("notes"),
    performedBy: text("performed_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("enrollment_events_student_idx").on(
      t.organizationId,
      t.studentId,
      t.createdAt,
    ),
    index("enrollment_events_type_idx").on(
      t.organizationId,
      t.eventType,
      t.effectiveOn,
    ),
  ],
);

export const promotionRules = sqliteTable(
  "promotion_rules",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    sourceClassId: text("source_class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    targetClassId: text("target_class_id").references(() => classes.id, {
      onDelete: "set null",
    }),
    targetSectionId: text("target_section_id").references(() => sections.id, {
      onDelete: "set null",
    }),
    defaultOutcome: text("default_outcome").notNull().default("promote"),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("promotion_rules_scope_uq").on(
      t.organizationId,
      t.campusId,
      t.sourceClassId,
    ),
    index("promotion_rules_org_status_idx").on(t.organizationId, t.status),
  ],
);

export const promotionBatches = sqliteTable(
  "promotion_batches",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    sourceAcademicYearId: text("source_academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    targetAcademicYearId: text("target_academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    sourceClassId: text("source_class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    effectiveOn: text("effective_on").notNull(),
    status: text("status").notNull().default("draft"),
    studentCount: integer("student_count").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    appliedBy: text("applied_by").references(() => users.id),
    appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
    ...ts,
  },
  (t) => [
    index("promotion_batches_org_status_idx").on(
      t.organizationId,
      t.status,
      t.createdAt,
    ),
    index("promotion_batches_scope_idx").on(
      t.organizationId,
      t.campusId,
      t.sourceAcademicYearId,
      t.sourceClassId,
    ),
  ],
);

export const promotionDecisions = sqliteTable(
  "promotion_decisions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    batchId: text("batch_id")
      .notNull()
      .references(() => promotionBatches.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    currentEnrollmentId: text("current_enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict" }),
    outcome: text("outcome").notNull().default("promote"),
    targetCampusId: text("target_campus_id").references(() => campuses.id, {
      onDelete: "restrict",
    }),
    targetClassId: text("target_class_id").references(() => classes.id, {
      onDelete: "restrict",
    }),
    targetSectionId: text("target_section_id").references(() => sections.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
    status: text("status").notNull().default("draft"),
    ...ts,
  },
  (t) => [
    uniqueIndex("promotion_decisions_batch_student_uq").on(
      t.batchId,
      t.studentId,
    ),
    index("promotion_decisions_org_batch_idx").on(
      t.organizationId,
      t.batchId,
      t.status,
    ),
  ],
);

export const studentAttendanceSessions = sqliteTable(
  "student_attendance_sessions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "restrict" }),
    sectionId: text("section_id").references(() => sections.id, {
      onDelete: "restrict",
    }),
    scopeKey: text("scope_key").notNull(),
    attendanceDate: text("attendance_date").notNull(),
    status: text("status").notNull().default("draft"),
    studentCount: integer("student_count").notNull().default(0),
    presentCount: integer("present_count").notNull().default(0),
    absentCount: integer("absent_count").notNull().default(0),
    lateCount: integer("late_count").notNull().default(0),
    leaveCount: integer("leave_count").notNull().default(0),
    halfDayCount: integer("half_day_count").notNull().default(0),
    markedBy: text("marked_by")
      .notNull()
      .references(() => users.id),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
    ...ts,
  },
  (t) => [
    uniqueIndex("student_attendance_session_scope_uq").on(
      t.organizationId,
      t.academicYearId,
      t.campusId,
      t.scopeKey,
      t.attendanceDate,
    ),
    index("student_attendance_session_date_idx").on(
      t.organizationId,
      t.campusId,
      t.attendanceDate,
    ),
  ],
);

export const studentAttendanceRecords = sqliteTable(
  "student_attendance_records",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => studentAttendanceSessions.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict" }),
    attendanceDate: text("attendance_date").notNull(),
    status: text("status").notNull().default("present"),
    remarks: text("remarks"),
    markedBy: text("marked_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("student_attendance_session_student_uq").on(
      t.sessionId,
      t.studentId,
    ),
    uniqueIndex("student_attendance_student_date_uq").on(
      t.organizationId,
      t.studentId,
      t.attendanceDate,
    ),
    index("student_attendance_student_history_idx").on(
      t.organizationId,
      t.studentId,
      t.attendanceDate,
    ),
  ],
);

export const schoolSchedules = sqliteTable(
  "school_schedules",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    season: text("season").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    schoolStartsAt: text("school_starts_at").notNull(),
    schoolEndsAt: text("school_ends_at").notNull(),
    breakStartsAt: text("break_starts_at").notNull(),
    breakEndsAt: text("break_ends_at").notNull(),
    workingDays: text("working_days").notNull().default("1,2,3,4,5,6"),
    status: text("status").notNull().default("active"),
    ...ts,
  },
  (t) => [
    uniqueIndex("school_schedules_campus_season_uq").on(
      t.organizationId,
      t.campusId,
      t.season,
    ),
    index("school_schedules_org_campus_idx").on(
      t.organizationId,
      t.campusId,
      t.status,
    ),
  ],
);

export const timetablePeriods = sqliteTable(
  "timetable_periods",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => schoolSchedules.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    periodNumber: integer("period_number").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    isBreak: integer("is_break", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("active"),
    ...ts,
  },
  (t) => [
    uniqueIndex("timetable_period_schedule_number_uq").on(
      t.scheduleId,
      t.periodNumber,
    ),
    index("timetable_period_org_campus_idx").on(
      t.organizationId,
      t.campusId,
      t.scheduleId,
    ),
  ],
);

export const timetableEntries = sqliteTable(
  "timetable_entries",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sectionId: text("section_id").references(() => sections.id, {
      onDelete: "cascade",
    }),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => schoolSchedules.id, { onDelete: "cascade" }),
    periodId: text("period_id")
      .notNull()
      .references(() => timetablePeriods.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    subjectId: text("subject_id").references(() => subjects.id, {
      onDelete: "set null",
    }),
    staffId: text("staff_id").references(() => staff.id, {
      onDelete: "set null",
    }),
    roomName: text("room_name"),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("timetable_entry_class_slot_uq").on(
      t.academicYearId,
      t.campusId,
      t.classId,
      t.sectionId,
      t.scheduleId,
      t.weekday,
      t.periodId,
    ),
    index("timetable_entry_teacher_slot_idx").on(
      t.organizationId,
      t.staffId,
      t.scheduleId,
      t.weekday,
      t.periodId,
    ),
    index("timetable_entry_class_idx").on(
      t.organizationId,
      t.campusId,
      t.academicYearId,
      t.classId,
      t.sectionId,
    ),
  ],
);

export const timetableSubstitutions = sqliteTable(
  "timetable_substitutions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    timetableEntryId: text("timetable_entry_id")
      .notNull()
      .references(() => timetableEntries.id, { onDelete: "cascade" }),
    substitutionDate: text("substitution_date").notNull(),
    originalStaffId: text("original_staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    substituteStaffId: text("substitute_staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("scheduled"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("timetable_substitution_entry_date_uq").on(
      t.timetableEntryId,
      t.substitutionDate,
    ),
    index("timetable_substitution_teacher_date_idx").on(
      t.organizationId,
      t.substituteStaffId,
      t.substitutionDate,
      t.status,
    ),
    index("timetable_substitution_campus_date_idx").on(
      t.organizationId,
      t.campusId,
      t.substitutionDate,
      t.status,
    ),
  ],
);

export const examinationTimetableEntries = sqliteTable(
  "examination_timetable_entries",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    termId: text("term_id").references(() => academicTerms.id, {
      onDelete: "set null",
    }),
    examName: text("exam_name").notNull(),
    examType: text("exam_type").notNull().default("term"),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sectionId: text("section_id").references(() => sections.id, {
      onDelete: "cascade",
    }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    examDate: text("exam_date").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    roomName: text("room_name"),
    invigilatorStaffId: text("invigilator_staff_id").references(
      () => staff.id,
      { onDelete: "set null" },
    ),
    maximumMarks: integer("maximum_marks").notNull().default(100),
    status: text("status").notNull().default("scheduled"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("exam_timetable_class_subject_date_uq").on(
      t.academicYearId,
      t.campusId,
      t.classId,
      t.sectionId,
      t.subjectId,
      t.examDate,
      t.startsAt,
    ),
    index("exam_timetable_campus_date_idx").on(
      t.organizationId,
      t.campusId,
      t.examDate,
      t.status,
    ),
    index("exam_timetable_invigilator_idx").on(
      t.organizationId,
      t.invigilatorStaffId,
      t.examDate,
      t.startsAt,
      t.endsAt,
    ),
  ],
);

export const examinationTypes = sqliteTable(
  "examination_types",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    assessmentMode: text("assessment_mode").notNull().default("written"),
    defaultWeightage: integer("default_weightage").notNull().default(100),
    requiresApproval: integer("requires_approval", { mode: "boolean" })
      .notNull()
      .default(true),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("examination_types_org_code_uq").on(t.organizationId, t.code),
  ],
);

export const gradingSchemes = sqliteTable(
  "grading_schemes",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id").references(
      () => academicYears.id,
      { onDelete: "restrict" },
    ),
    name: text("name").notNull(),
    code: text("code").notNull(),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("grading_schemes_org_code_uq").on(t.organizationId, t.code),
    index("grading_schemes_year_idx").on(
      t.organizationId,
      t.academicYearId,
      t.status,
    ),
  ],
);

export const gradeBoundaries = sqliteTable(
  "grade_boundaries",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    gradingSchemeId: text("grading_scheme_id")
      .notNull()
      .references(() => gradingSchemes.id, { onDelete: "cascade" }),
    gradeLabel: text("grade_label").notNull(),
    minimumPercentage: integer("minimum_percentage").notNull(),
    maximumPercentage: integer("maximum_percentage").notNull(),
    gradePoint: real("grade_point"),
    remarks: text("remarks"),
    isPassing: integer("is_passing", { mode: "boolean" })
      .notNull()
      .default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...ts,
  },
  (t) => [
    uniqueIndex("grade_boundaries_scheme_label_uq").on(
      t.gradingSchemeId,
      t.gradeLabel,
    ),
    index("grade_boundaries_range_idx").on(
      t.organizationId,
      t.gradingSchemeId,
      t.minimumPercentage,
      t.maximumPercentage,
    ),
  ],
);

export const assessments = sqliteTable(
  "assessments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    termId: text("term_id").references(() => academicTerms.id, {
      onDelete: "set null",
    }),
    examinationTypeId: text("examination_type_id")
      .notNull()
      .references(() => examinationTypes.id, { onDelete: "restrict" }),
    gradingSchemeId: text("grading_scheme_id").references(
      () => gradingSchemes.id,
      { onDelete: "restrict" },
    ),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    sectionId: text("section_id").references(() => sections.id, {
      onDelete: "cascade",
    }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    assessmentDate: text("assessment_date").notNull(),
    maximumMarks: integer("maximum_marks").notNull().default(100),
    passingMarks: integer("passing_marks").notNull().default(40),
    weightage: integer("weightage").notNull().default(100),
    status: text("status").notNull().default("draft"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("assessments_scope_title_uq").on(
      t.academicYearId,
      t.campusId,
      t.classId,
      t.sectionId,
      t.subjectId,
      t.title,
    ),
    index("assessments_campus_date_idx").on(
      t.organizationId,
      t.campusId,
      t.assessmentDate,
      t.status,
    ),
    index("assessments_class_subject_idx").on(
      t.organizationId,
      t.academicYearId,
      t.classId,
      t.sectionId,
      t.subjectId,
    ),
    index("assessments_publication_idx").on(
      t.organizationId,
      t.campusId,
      t.status,
      t.publishedAt,
    ),
  ],
);

export const resultPublications = sqliteTable(
  "result_publications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").notNull().references(() => campuses.id, { onDelete: "cascade" }),
    assessmentId: text("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    remarks: text("remarks"),
    actedBy: text("acted_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    actedAt: integer("acted_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("result_publications_assessment_idx").on(t.organizationId, t.campusId, t.assessmentId, t.actedAt)],
);

export const assessmentMarks = sqliteTable(
  "assessment_marks",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessments.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict" }),
    obtainedMarks: real("obtained_marks"),
    percentage: real("percentage"),
    gradeLabel: text("grade_label"),
    gradePoint: real("grade_point"),
    isPassing: integer("is_passing", { mode: "boolean" }),
    isAbsent: integer("is_absent", { mode: "boolean" })
      .notNull()
      .default(false),
    teacherRemarks: text("teacher_remarks"),
    enteredBy: text("entered_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("assessment_marks_student_uq").on(t.assessmentId, t.studentId),
    index("assessment_marks_scope_idx").on(
      t.organizationId,
      t.campusId,
      t.assessmentId,
    ),
    index("assessment_marks_student_idx").on(
      t.organizationId,
      t.studentId,
      t.assessmentId,
    ),
  ],
);

export const schoolEvents = sqliteTable(
  "school_events",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    academicYearId: text("academic_year_id").references(
      () => academicYears.id,
      { onDelete: "set null" },
    ),
    title: text("title").notNull(),
    eventType: text("event_type").notNull().default("school"),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    location: text("location"),
    description: text("description"),
    audience: text("audience").notNull().default("all"),
    status: text("status").notNull().default("scheduled"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    index("school_events_scope_date_idx").on(
      t.organizationId,
      t.campusId,
      t.startsOn,
      t.status,
    ),
  ],
);

export const feeCategories = sqliteTable(
  "fee_categories",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    frequency: text("frequency").notNull().default("monthly"),
    refundable: integer("refundable", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("fee_categories_org_code_uq").on(t.organizationId, t.code),
  ],
);

export const feeStructures = sqliteTable(
  "fee_structures",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    classId: text("class_id").references(() => classes.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    dueDay: integer("due_day").notNull().default(10),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("fee_structures_org_code_uq").on(t.organizationId, t.code),
    index("fee_structures_scope_idx").on(
      t.organizationId,
      t.campusId,
      t.academicYearId,
      t.classId,
      t.status,
    ),
  ],
);

export const feeStructureItems = sqliteTable(
  "fee_structure_items",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    feeStructureId: text("fee_structure_id")
      .notNull()
      .references(() => feeStructures.id, { onDelete: "cascade" }),
    feeCategoryId: text("fee_category_id")
      .notNull()
      .references(() => feeCategories.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull().default(0),
    mandatory: integer("mandatory", { mode: "boolean" })
      .notNull()
      .default(true),
    ...ts,
  },
  (t) => [
    uniqueIndex("fee_structure_item_category_uq").on(
      t.feeStructureId,
      t.feeCategoryId,
    ),
  ],
);

export const studentFeeAssignments = sqliteTable(
  "student_fee_assignments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    feeStructureId: text("fee_structure_id")
      .notNull()
      .references(() => feeStructures.id, { onDelete: "restrict" }),
    discountType: text("discount_type").notNull().default("none"),
    discountValue: integer("discount_value").notNull().default(0),
    discountReason: text("discount_reason"),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on"),
    status: text("status").notNull().default("active"),
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("student_fee_assignment_year_uq").on(
      t.academicYearId,
      t.studentId,
    ),
    index("student_fee_assignment_campus_idx").on(
      t.organizationId,
      t.campusId,
      t.academicYearId,
      t.status,
    ),
  ],
);

export const feeInvoices = sqliteTable(
  "fee_invoices",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    academicYearId: text("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    feeAssignmentId: text("fee_assignment_id")
      .notNull()
      .references(() => studentFeeAssignments.id, { onDelete: "restrict" }),
    invoiceNumber: text("invoice_number").notNull(),
    billingMonth: text("billing_month").notNull(),
    issuedOn: text("issued_on").notNull(),
    dueOn: text("due_on").notNull(),
    subtotal: integer("subtotal").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    lateFee: integer("late_fee").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    balanceAmount: integer("balance_amount").notNull().default(0),
    status: text("status").notNull().default("unpaid"),
    notes: text("notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("fee_invoice_student_month_uq").on(
      t.academicYearId,
      t.studentId,
      t.billingMonth,
    ),
    uniqueIndex("fee_invoice_org_number_uq").on(
      t.organizationId,
      t.invoiceNumber,
    ),
    index("fee_invoice_campus_status_idx").on(
      t.organizationId,
      t.campusId,
      t.billingMonth,
      t.status,
    ),
  ],
);

export const feeInvoiceItems = sqliteTable(
  "fee_invoice_items",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => feeInvoices.id, { onDelete: "cascade" }),
    feeCategoryId: text("fee_category_id")
      .notNull()
      .references(() => feeCategories.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    amount: integer("amount").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("fee_invoice_items_invoice_idx").on(t.organizationId, t.invoiceId),
  ],
);

export const feePayments = sqliteTable(
  "fee_payments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => feeInvoices.id, { onDelete: "restrict" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    receiptNumber: text("receipt_number").notNull(),
    amount: integer("amount").notNull(),
    paymentDate: text("payment_date").notNull(),
    paymentMethod: text("payment_method").notNull().default("cash"),
    referenceNumber: text("reference_number"),
    financialAccountId: text("financial_account_id"),
    notes: text("notes"),
    receivedBy: text("received_by")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("posted"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("fee_payment_org_receipt_uq").on(
      t.organizationId,
      t.receiptNumber,
    ),
    index("fee_payment_invoice_idx").on(
      t.organizationId,
      t.invoiceId,
      t.paymentDate,
    ),
  ],
);

export const lateFeeRules = sqliteTable(
  "late_fee_rules",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    academicYearId: text("academic_year_id").references(
      () => academicYears.id,
      { onDelete: "restrict" },
    ),
    name: text("name").notNull(),
    calculationType: text("calculation_type").notNull().default("fixed"),
    value: integer("value").notNull().default(0),
    graceDays: integer("grace_days").notNull().default(0),
    maximumAmount: integer("maximum_amount"),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    index("late_fee_rules_scope_idx").on(
      t.organizationId,
      t.campusId,
      t.academicYearId,
      t.status,
    ),
  ],
);

export const feeLateFeeApplications = sqliteTable(
  "fee_late_fee_applications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => feeInvoices.id, { onDelete: "cascade" }),
    ruleId: text("rule_id")
      .notNull()
      .references(() => lateFeeRules.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull(),
    appliedOn: text("applied_on").notNull(),
    appliedBy: text("applied_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    uniqueIndex("fee_late_fee_invoice_rule_uq").on(t.invoiceId, t.ruleId),
    index("fee_late_fee_scope_idx").on(
      t.organizationId,
      t.campusId,
      t.appliedOn,
    ),
  ],
);

export const expenseCategories = sqliteTable(
  "expense_categories",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("expense_categories_org_code_uq").on(t.organizationId, t.code),
  ],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "restrict" }),
    expenseDate: text("expense_date").notNull(),
    amount: integer("amount").notNull(),
    payee: text("payee").notNull(),
    description: text("description").notNull(),
    paymentMethod: text("payment_method").notNull().default("cash"),
    referenceNumber: text("reference_number"),
    financialAccountId: text("financial_account_id"),
    status: text("status").notNull().default("posted"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    index("expenses_scope_date_idx").on(
      t.organizationId,
      t.campusId,
      t.expenseDate,
      t.status,
    ),
    index("expenses_category_date_idx").on(
      t.organizationId,
      t.categoryId,
      t.expenseDate,
    ),
  ],
);

export const financialAccounts = sqliteTable(
  "financial_accounts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    accountType: text("account_type").notNull(),
    bankName: text("bank_name"),
    accountNumberMasked: text("account_number_masked"),
    openingBalance: integer("opening_balance").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("financial_accounts_org_code_uq").on(t.organizationId, t.code),
    index("financial_accounts_scope_idx").on(
      t.organizationId,
      t.campusId,
      t.accountType,
      t.status,
    ),
  ],
);

export const financialApprovalRequests = sqliteTable(
  "financial_approval_requests",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    amount: integer("amount").notNull(),
    status: text("status").notNull().default("pending"),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id),
    decidedBy: text("decided_by").references(() => users.id),
    decisionNotes: text("decision_notes"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    ...ts,
  },
  (t) => [
    uniqueIndex("financial_approval_entity_uq").on(
      t.organizationId,
      t.entityType,
      t.entityId,
    ),
    index("financial_approval_scope_status_idx").on(
      t.organizationId,
      t.campusId,
      t.status,
      t.createdAt,
    ),
  ],
);

export const studentAttendanceCorrections = sqliteTable(
  "student_attendance_corrections",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    attendanceRecordId: text("attendance_record_id")
      .notNull()
      .references(() => studentAttendanceRecords.id, { onDelete: "cascade" }),
    previousStatus: text("previous_status").notNull(),
    newStatus: text("new_status").notNull(),
    previousRemarks: text("previous_remarks"),
    newRemarks: text("new_remarks"),
    reason: text("reason").notNull(),
    correctedBy: text("corrected_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("student_attendance_correction_record_idx").on(
      t.organizationId,
      t.attendanceRecordId,
      t.createdAt,
    ),
  ],
);

export const studentAttendanceCorrectionRequests = sqliteTable(
  "student_attendance_correction_requests",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    attendanceRecordId: text("attendance_record_id")
      .notNull()
      .references(() => studentAttendanceRecords.id, { onDelete: "cascade" }),
    requestedStatus: text("requested_status").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id),
    reviewedBy: text("reviewed_by").references(() => users.id),
    reviewNotes: text("review_notes"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    ...ts,
  },
  (t) => [
    index("student_attendance_requests_status_idx").on(
      t.organizationId,
      t.campusId,
      t.status,
      t.createdAt,
    ),
    uniqueIndex("student_attendance_request_pending_uq").on(
      t.attendanceRecordId,
      t.status,
    ),
  ],
);

export const attendanceAlerts = sqliteTable(
  "attendance_alerts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id")
      .notNull()
      .references(() => campuses.id, { onDelete: "restrict" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    attendanceRecordId: text("attendance_record_id")
      .notNull()
      .references(() => studentAttendanceRecords.id, { onDelete: "cascade" }),
    alertType: text("alert_type").notNull(),
    status: text("status").notNull().default("queued"),
    recipientCount: integer("recipient_count").notNull().default(0),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }),
    ...ts,
  },
  (t) => [
    uniqueIndex("attendance_alert_record_type_uq").on(
      t.attendanceRecordId,
      t.alertType,
    ),
    index("attendance_alert_org_status_idx").on(
      t.organizationId,
      t.campusId,
      t.status,
      t.createdAt,
    ),
  ],
);

export const families = sqliteTable(
  "families",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    familyCode: text("family_code").notNull(),
    familyName: text("family_name").notNull(),
    address: text("address"),
    city: text("city"),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    ...ts,
  },
  (t) => [
    uniqueIndex("families_org_code_uq").on(t.organizationId, t.familyCode),
    index("families_org_name_idx").on(t.organizationId, t.familyName),
  ],
);

export const guardians = sqliteTable(
  "guardians",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    familyId: text("family_id").references(() => families.id, {
      onDelete: "set null",
    }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    nationalId: text("national_id"),
    occupation: text("occupation"),
    employer: text("employer"),
    primaryPhone: text("primary_phone").notNull(),
    alternatePhone: text("alternate_phone"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    preferredLanguage: text("preferred_language").notNull().default("English"),
    communicationOptIn: integer("communication_opt_in", { mode: "boolean" })
      .notNull()
      .default(true),
    status: text("status").notNull().default("active"),
    ...ts,
  },
  (t) => [
    index("guardians_org_phone_idx").on(t.organizationId, t.primaryPhone),
    index("guardians_family_idx").on(t.familyId),
    index("guardians_org_email_idx").on(t.organizationId, t.email),
  ],
);

export const studentGuardians = sqliteTable(
  "student_guardians",
  {
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    guardianId: text("guardian_id")
      .notNull()
      .references(() => guardians.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull(),
    isPrimary: integer("is_primary", { mode: "boolean" })
      .notNull()
      .default(false),
    livesWithStudent: integer("lives_with_student", { mode: "boolean" })
      .notNull()
      .default(false),
    legalGuardian: integer("legal_guardian", { mode: "boolean" })
      .notNull()
      .default(false),
    pickupAuthorized: integer("pickup_authorized", { mode: "boolean" })
      .notNull()
      .default(false),
    receivesAcademic: integer("receives_academic", { mode: "boolean" })
      .notNull()
      .default(true),
    receivesFinancial: integer("receives_financial", { mode: "boolean" })
      .notNull()
      .default(false),
    ...ts,
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.guardianId] }),
    index("student_guardians_guardian_idx").on(t.guardianId),
    index("student_guardians_primary_idx").on(t.studentId, t.isPrimary),
  ],
);

export const organizationSettings = sqliteTable("organization_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  tagline: text("tagline"),
  address: text("address"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  timezone: text("timezone").notNull().default("Asia/Karachi"),
  currency: text("currency").notNull().default("PKR"),
  dateInputFormat: text("date_input_format").notNull().default("DD-MM-YYYY"),
  dateDisplayFormat: text("date_display_format")
    .notNull()
    .default("DD-MM-YYYY"),
  admissionBehaviorJson: text("admission_behavior_json")
    .notNull()
    .default("{}"),
  feeControlsJson: text("fee_controls_json").notNull().default("{}"),
  attendanceRulesJson: text("attendance_rules_json").notNull().default("{}"),
  leaveRulesJson: text("leave_rules_json").notNull().default("{}"),
  appControlsJson: text("app_controls_json").notNull().default("{}"),
  ...ts,
});

export const campusSettings = sqliteTable("campus_settings", {
  campusId: text("campus_id")
    .primaryKey()
    .references(() => campuses.id, { onDelete: "cascade" }),
  useSchoolAddress: integer("use_school_address", { mode: "boolean" })
    .notNull()
    .default(true),
  address: text("address"),
  useSchoolBankDetails: integer("use_school_bank_details", { mode: "boolean" })
    .notNull()
    .default(true),
  bankName: text("bank_name"),
  accountNumberEncrypted: text("account_number_encrypted"),
  useSchoolLogo1: integer("use_school_logo1", { mode: "boolean" })
    .notNull()
    .default(true),
  useSchoolLogo2: integer("use_school_logo2", { mode: "boolean" })
    .notNull()
    .default(true),
  useSchoolReportHeader: integer("use_school_report_header", {
    mode: "boolean",
  })
    .notNull()
    .default(true),
  useSchoolPrincipalSignature: integer("use_school_principal_signature", {
    mode: "boolean",
  })
    .notNull()
    .default(true),
  extraFieldsJson: text("extra_fields_json").notNull().default("{}"),
  overridesJson: text("overrides_json").notNull().default("{}"),
  ...ts,
});

export const bankAccounts = sqliteTable(
  "bank_accounts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    bankName: text("bank_name").notNull(),
    accountTitle: text("account_title"),
    accountNumberEncrypted: text("account_number_encrypted").notNull(),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    ...ts,
  },
  (t) => [
    index("bank_accounts_org_campus_idx").on(t.organizationId, t.campusId),
  ],
);

export const storageAssets = sqliteTable(
  "storage_assets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    assetType: text("asset_type").notNull(),
    r2Key: text("r2_key").notNull(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id),
    ...ts,
  },
  (t) => [
    uniqueIndex("storage_assets_r2_key_uq").on(t.r2Key),
    index("storage_assets_org_type_idx").on(t.organizationId, t.assetType),
    index("storage_assets_campus_idx").on(t.campusId),
  ],
);

export const studentDocuments = sqliteTable(
  "student_documents",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => storageAssets.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
    issuedOn: text("issued_on"),
    expiresOn: text("expires_on"),
    status: text("status").notNull().default("active"),
    verificationStatus: text("verification_status")
      .notNull()
      .default("pending"),
    isRequired: integer("is_required", { mode: "boolean" })
      .notNull()
      .default(false),
    version: integer("version").notNull().default(1),
    verifiedBy: text("verified_by").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    ...ts,
  },
  (t) => [
    index("student_documents_student_idx").on(
      t.organizationId,
      t.studentId,
      t.documentType,
    ),
    index("student_documents_status_idx").on(
      t.organizationId,
      t.verificationStatus,
      t.expiresOn,
    ),
    uniqueIndex("student_documents_asset_uq").on(t.assetId),
  ],
);

export const admissionDocuments = sqliteTable(
  "admission_documents",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    applicationId: text("application_id")
      .notNull()
      .references(() => admissionApplications.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => storageAssets.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(),
    title: text("title").notNull(),
    verificationStatus: text("verification_status")
      .notNull()
      .default("pending"),
    verificationNotes: text("verification_notes"),
    verifiedBy: text("verified_by").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: integer("verified_at", { mode: "timestamp_ms" }),
    ...ts,
  },
  (t) => [
    index("admission_documents_app_idx").on(
      t.organizationId,
      t.applicationId,
      t.documentType,
    ),
    index("admission_documents_status_idx").on(
      t.organizationId,
      t.verificationStatus,
    ),
    uniqueIndex("admission_documents_asset_uq").on(t.assetId),
  ],
);

export const numberSequences = sqliteTable(
  "number_sequences",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    sequenceType: text("sequence_type").notNull(),
    prefix: text("prefix").notNull().default(""),
    nextValue: integer("next_value").notNull().default(1),
    padding: integer("padding").notNull().default(4),
    postfix: text("postfix").notNull().default(""),
    ...ts,
  },
  (t) => [
    uniqueIndex("number_sequences_scope_type_uq").on(
      t.organizationId,
      t.campusId,
      t.sequenceType,
    ),
  ],
);

export const notificationPreferences = sqliteTable(
  "notification_preferences",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    eventCode: text("event_code").notNull(),
    channel: text("channel").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    templateJson: text("template_json").notNull().default("{}"),
    ...ts,
  },
  (t) => [
    uniqueIndex("notification_preferences_scope_uq").on(
      t.organizationId,
      t.campusId,
      t.eventCode,
      t.channel,
    ),
    index("notification_preferences_campus_idx").on(t.campusId),
  ],
);

export const settingRevisions = sqliteTable(
  "setting_revisions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "cascade",
    }),
    settingGroup: text("setting_group").notNull(),
    previousValueJson: text("previous_value_json"),
    newValueJson: text("new_value_json").notNull(),
    changedBy: text("changed_by")
      .notNull()
      .references(() => users.id),
    reason: text("reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("setting_revisions_org_group_idx").on(
      t.organizationId,
      t.settingGroup,
      t.createdAt,
    ),
    index("setting_revisions_campus_idx").on(t.campusId),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    campusId: text("campus_id").references(() => campuses.id, {
      onDelete: "set null",
    }),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    outcome: text("outcome").notNull(),
    ipHash: text("ip_hash"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("audit_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_logs_entity_idx").on(
      t.organizationId,
      t.entityType,
      t.entityId,
    ),
    index("audit_logs_actor_idx").on(t.actorUserId, t.createdAt),
  ],
);

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    windowStartedAt: integer("window_started_at").notNull(),
    attempts: integer("attempts").notNull().default(1),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("rate_limits_org_action_idx").on(
      t.organizationId,
      t.action,
      t.windowStartedAt,
    ),
  ],
);

export const backupRuns = sqliteTable(
  "backup_runs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("pending"),
    r2Key: text("r2_key"),
    manifestJson: text("manifest_json").notNull().default("{}"),
    sizeBytes: integer("size_bytes"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("backup_runs_org_created_idx").on(t.organizationId, t.createdAt),
    index("backup_runs_org_status_idx").on(t.organizationId, t.status),
  ],
);
