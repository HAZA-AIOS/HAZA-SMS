CREATE TABLE `fee_categories` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `name` text NOT NULL,
 `code` text NOT NULL,
 `frequency` text DEFAULT 'monthly' NOT NULL,
 `refundable` integer DEFAULT 0 NOT NULL,
 `status` text DEFAULT 'active' NOT NULL,
 `created_by` text NOT NULL REFERENCES `users`(`id`),
 `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
 `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fee_categories_org_code_uq` ON `fee_categories` (`organization_id`,`code`);
--> statement-breakpoint
CREATE TABLE `fee_structures` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text REFERENCES `campuses`(`id`) ON DELETE cascade,
 `academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`) ON DELETE restrict,
 `class_id` text REFERENCES `classes`(`id`) ON DELETE cascade,
 `name` text NOT NULL,
 `code` text NOT NULL,
 `effective_from` text NOT NULL,
 `due_day` integer DEFAULT 10 NOT NULL,
 `status` text DEFAULT 'active' NOT NULL,
 `created_by` text NOT NULL REFERENCES `users`(`id`),
 `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
 `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fee_structures_org_code_uq` ON `fee_structures` (`organization_id`,`code`);
--> statement-breakpoint
CREATE INDEX `fee_structures_scope_idx` ON `fee_structures` (`organization_id`,`campus_id`,`academic_year_id`,`class_id`,`status`);
--> statement-breakpoint
CREATE TABLE `fee_structure_items` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `fee_structure_id` text NOT NULL REFERENCES `fee_structures`(`id`) ON DELETE cascade,
 `fee_category_id` text NOT NULL REFERENCES `fee_categories`(`id`) ON DELETE restrict,
 `amount` integer DEFAULT 0 NOT NULL,
 `mandatory` integer DEFAULT 1 NOT NULL,
 `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
 `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fee_structure_item_category_uq` ON `fee_structure_items` (`fee_structure_id`,`fee_category_id`);
--> statement-breakpoint
CREATE TABLE `student_fee_assignments` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`) ON DELETE restrict,
 `student_id` text NOT NULL REFERENCES `students`(`id`) ON DELETE cascade,
 `fee_structure_id` text NOT NULL REFERENCES `fee_structures`(`id`) ON DELETE restrict,
 `discount_type` text DEFAULT 'none' NOT NULL,
 `discount_value` integer DEFAULT 0 NOT NULL,
 `discount_reason` text,
 `starts_on` text NOT NULL,
 `ends_on` text,
 `status` text DEFAULT 'active' NOT NULL,
 `assigned_by` text NOT NULL REFERENCES `users`(`id`),
 `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
 `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_fee_assignment_year_uq` ON `student_fee_assignments` (`academic_year_id`,`student_id`);
--> statement-breakpoint
CREATE INDEX `student_fee_assignment_campus_idx` ON `student_fee_assignments` (`organization_id`,`campus_id`,`academic_year_id`,`status`);
