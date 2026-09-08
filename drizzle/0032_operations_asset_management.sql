CREATE TABLE `operation_records` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL,
  `campus_id` text,
  `category` text NOT NULL,
  `title` text NOT NULL,
  `reference_code` text,
  `person_name` text,
  `assigned_to` text,
  `status` text DEFAULT 'open' NOT NULL,
  `priority` text DEFAULT 'normal' NOT NULL,
  `due_on` text,
  `quantity` integer,
  `amount` real,
  `notes` text,
  `details_json` text DEFAULT '{}' NOT NULL,
  `created_by` text NOT NULL,
  `closed_at` integer,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE INDEX `operation_records_org_category_status_idx` ON `operation_records` (`organization_id`,`category`,`status`);
CREATE INDEX `operation_records_org_campus_idx` ON `operation_records` (`organization_id`,`campus_id`);
CREATE INDEX `operation_records_due_idx` ON `operation_records` (`organization_id`,`due_on`);
PRAGMA optimize;
