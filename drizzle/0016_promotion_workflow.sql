CREATE TABLE `promotion_rules` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
  `source_class_id` text NOT NULL REFERENCES `classes`(`id`) ON DELETE cascade,
  `target_class_id` text REFERENCES `classes`(`id`) ON DELETE set null,
  `target_section_id` text REFERENCES `sections`(`id`) ON DELETE set null,
  `default_outcome` text DEFAULT 'promote' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promotion_rules_scope_uq` ON `promotion_rules` (`organization_id`,`campus_id`,`source_class_id`);
--> statement-breakpoint
CREATE INDEX `promotion_rules_org_status_idx` ON `promotion_rules` (`organization_id`,`status`);
--> statement-breakpoint
CREATE TABLE `promotion_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE restrict,
  `source_academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`) ON DELETE restrict,
  `target_academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`) ON DELETE restrict,
  `source_class_id` text NOT NULL REFERENCES `classes`(`id`) ON DELETE restrict,
  `effective_on` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `student_count` integer DEFAULT 0 NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `applied_by` text REFERENCES `users`(`id`),
  `applied_at` integer,
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `promotion_batches_org_status_idx` ON `promotion_batches` (`organization_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `promotion_batches_scope_idx` ON `promotion_batches` (`organization_id`,`campus_id`,`source_academic_year_id`,`source_class_id`);
--> statement-breakpoint
CREATE TABLE `promotion_decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `batch_id` text NOT NULL REFERENCES `promotion_batches`(`id`) ON DELETE cascade,
  `student_id` text NOT NULL REFERENCES `students`(`id`) ON DELETE cascade,
  `current_enrollment_id` text NOT NULL REFERENCES `enrollments`(`id`) ON DELETE restrict,
  `outcome` text DEFAULT 'promote' NOT NULL,
  `target_campus_id` text REFERENCES `campuses`(`id`) ON DELETE restrict,
  `target_class_id` text REFERENCES `classes`(`id`) ON DELETE restrict,
  `target_section_id` text REFERENCES `sections`(`id`) ON DELETE set null,
  `reason` text,
  `status` text DEFAULT 'draft' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promotion_decisions_batch_student_uq` ON `promotion_decisions` (`batch_id`,`student_id`);
--> statement-breakpoint
CREATE INDEX `promotion_decisions_org_batch_idx` ON `promotion_decisions` (`organization_id`,`batch_id`,`status`);
