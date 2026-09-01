CREATE TABLE `examination_types` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `name` text NOT NULL,
 `code` text NOT NULL,
 `assessment_mode` text NOT NULL DEFAULT 'written',
 `default_weightage` integer NOT NULL DEFAULT 100,
 `requires_approval` integer NOT NULL DEFAULT 1,
 `status` text NOT NULL DEFAULT 'active',
 `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `examination_types_org_code_uq` ON `examination_types` (`organization_id`,`code`);

CREATE TABLE `grading_schemes` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `academic_year_id` text REFERENCES `academic_years`(`id`) ON DELETE restrict,
 `name` text NOT NULL,
 `code` text NOT NULL,
 `is_default` integer NOT NULL DEFAULT 0,
 `status` text NOT NULL DEFAULT 'active',
 `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `grading_schemes_org_code_uq` ON `grading_schemes` (`organization_id`,`code`);
CREATE INDEX `grading_schemes_year_idx` ON `grading_schemes` (`organization_id`,`academic_year_id`,`status`);

CREATE TABLE `grade_boundaries` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `grading_scheme_id` text NOT NULL REFERENCES `grading_schemes`(`id`) ON DELETE cascade,
 `grade_label` text NOT NULL,
 `minimum_percentage` integer NOT NULL,
 `maximum_percentage` integer NOT NULL,
 `grade_point` real,
 `remarks` text,
 `is_passing` integer NOT NULL DEFAULT 1,
 `sort_order` integer NOT NULL DEFAULT 0,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `grade_boundaries_scheme_label_uq` ON `grade_boundaries` (`grading_scheme_id`,`grade_label`);
CREATE INDEX `grade_boundaries_range_idx` ON `grade_boundaries` (`organization_id`,`grading_scheme_id`,`minimum_percentage`,`maximum_percentage`);

CREATE TABLE `assessments` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`) ON DELETE restrict,
 `term_id` text REFERENCES `academic_terms`(`id`) ON DELETE set null,
 `examination_type_id` text NOT NULL REFERENCES `examination_types`(`id`) ON DELETE restrict,
 `grading_scheme_id` text REFERENCES `grading_schemes`(`id`) ON DELETE restrict,
 `class_id` text NOT NULL REFERENCES `classes`(`id`) ON DELETE cascade,
 `section_id` text REFERENCES `sections`(`id`) ON DELETE cascade,
 `subject_id` text NOT NULL REFERENCES `subjects`(`id`) ON DELETE cascade,
 `title` text NOT NULL,
 `assessment_date` text NOT NULL,
 `maximum_marks` integer NOT NULL DEFAULT 100,
 `passing_marks` integer NOT NULL DEFAULT 40,
 `weightage` integer NOT NULL DEFAULT 100,
 `status` text NOT NULL DEFAULT 'draft',
 `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `assessments_scope_title_uq` ON `assessments` (`academic_year_id`,`campus_id`,`class_id`,`section_id`,`subject_id`,`title`);
CREATE INDEX `assessments_campus_date_idx` ON `assessments` (`organization_id`,`campus_id`,`assessment_date`,`status`);
CREATE INDEX `assessments_class_subject_idx` ON `assessments` (`organization_id`,`academic_year_id`,`class_id`,`section_id`,`subject_id`);
