CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`campus_id` text,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_org_campus_code_uq` ON `classes` (`organization_id`,`campus_id`,`code`);--> statement-breakpoint
CREATE INDEX `classes_org_status_idx` ON `classes` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`student_id` text NOT NULL,
	`academic_year_id` text NOT NULL,
	`campus_id` text NOT NULL,
	`class_id` text,
	`section_id` text,
	`roll_number` text,
	`status` text DEFAULT 'active' NOT NULL,
	`enrolled_on` text,
	`ended_on` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_student_year_uq` ON `enrollments` (`student_id`,`academic_year_id`);--> statement-breakpoint
CREATE INDEX `enrollments_org_year_class_idx` ON `enrollments` (`organization_id`,`academic_year_id`,`class_id`);--> statement-breakpoint
CREATE INDEX `enrollments_campus_section_idx` ON `enrollments` (`campus_id`,`section_id`);--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`campus_id` text NOT NULL,
	`class_id` text NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`capacity` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sections_campus_class_code_uq` ON `sections` (`campus_id`,`class_id`,`code`);--> statement-breakpoint
CREATE INDEX `sections_org_status_idx` ON `sections` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`home_campus_id` text NOT NULL,
	`admission_number` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text,
	`preferred_name` text,
	`gender` text,
	`date_of_birth` text,
	`enrollment_status` text DEFAULT 'active' NOT NULL,
	`photo_asset_id` text,
	`admitted_on` text,
	`archived_at` integer,
	`archived_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`photo_asset_id`) REFERENCES `storage_assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`archived_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_org_admission_uq` ON `students` (`organization_id`,`admission_number`);--> statement-breakpoint
CREATE INDEX `students_org_status_name_idx` ON `students` (`organization_id`,`enrollment_status`,`first_name`,`last_name`);--> statement-breakpoint
CREATE INDEX `students_campus_status_idx` ON `students` (`home_campus_id`,`enrollment_status`);