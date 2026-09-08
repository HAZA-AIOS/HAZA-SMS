CREATE TABLE `learning_resources` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text REFERENCES `campuses`(`id`) ON DELETE set null,
 `academic_year_id` text REFERENCES `academic_years`(`id`) ON DELETE set null,
 `class_id` text REFERENCES `classes`(`id`) ON DELETE set null,
 `section_id` text REFERENCES `sections`(`id`) ON DELETE set null,
 `subject_id` text REFERENCES `subjects`(`id`) ON DELETE set null,
 `title` text NOT NULL,
 `description` text,
 `resource_type` text NOT NULL DEFAULT 'link',
 `external_url` text,
 `asset_id` text REFERENCES `storage_assets`(`id`) ON DELETE set null,
 `status` text NOT NULL DEFAULT 'draft',
 `published_at` integer,
 `created_by` text NOT NULL REFERENCES `users`(`id`),
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `learning_resources_org_status_idx` ON `learning_resources` (`organization_id`,`status`,`published_at`);
CREATE INDEX `learning_resources_target_idx` ON `learning_resources` (`organization_id`,`campus_id`,`class_id`,`subject_id`);

CREATE TABLE `assignments` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`),
 `class_id` text NOT NULL REFERENCES `classes`(`id`),
 `section_id` text REFERENCES `sections`(`id`) ON DELETE set null,
 `subject_id` text NOT NULL REFERENCES `subjects`(`id`),
 `title` text NOT NULL,
 `instructions` text,
 `assigned_on` text NOT NULL,
 `due_at` integer,
 `max_points` real NOT NULL DEFAULT 100,
 `status` text NOT NULL DEFAULT 'draft',
 `published_at` integer,
 `created_by` text NOT NULL REFERENCES `users`(`id`),
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `assignments_org_status_due_idx` ON `assignments` (`organization_id`,`status`,`due_at`);
CREATE INDEX `assignments_target_idx` ON `assignments` (`organization_id`,`campus_id`,`class_id`,`section_id`,`subject_id`);

CREATE TABLE `assignment_resources` (
 `assignment_id` text NOT NULL REFERENCES `assignments`(`id`) ON DELETE cascade,
 `resource_id` text NOT NULL REFERENCES `learning_resources`(`id`) ON DELETE cascade,
 PRIMARY KEY (`assignment_id`,`resource_id`)
);
CREATE INDEX `assignment_resources_resource_idx` ON `assignment_resources` (`resource_id`);
PRAGMA optimize;
