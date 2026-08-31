CREATE TABLE `admission_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`campus_id` text NOT NULL,
	`enquiry_id` text,
	`application_number` text NOT NULL,
	`child_first_name` text NOT NULL,
	`child_last_name` text,
	`date_of_birth` text,
	`gender` text,
	`applying_class_id` text,
	`academic_year_id` text,
	`guardian_name` text NOT NULL,
	`primary_phone` text NOT NULL,
	`email` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_on` text,
	`notes` text,
	`student_id` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`enquiry_id`) REFERENCES `admission_enquiries`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`applying_class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admission_applications_org_number_uq` ON `admission_applications` (`organization_id`,`application_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `admission_applications_enquiry_uq` ON `admission_applications` (`enquiry_id`);--> statement-breakpoint
CREATE INDEX `admission_applications_org_status_idx` ON `admission_applications` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `admission_applications_campus_class_idx` ON `admission_applications` (`campus_id`,`applying_class_id`);--> statement-breakpoint
CREATE TABLE `admission_enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`campus_id` text NOT NULL,
	`enquiry_number` text NOT NULL,
	`child_first_name` text NOT NULL,
	`child_last_name` text,
	`date_of_birth` text,
	`gender` text,
	`applying_class_id` text,
	`desired_academic_year_id` text,
	`guardian_name` text NOT NULL,
	`relationship` text,
	`primary_phone` text NOT NULL,
	`email` text,
	`source` text,
	`status` text DEFAULT 'new' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`next_follow_up_on` text,
	`notes` text,
	`assigned_to` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`applying_class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`desired_academic_year_id`) REFERENCES `academic_years`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admission_enquiries_org_number_uq` ON `admission_enquiries` (`organization_id`,`enquiry_number`);--> statement-breakpoint
CREATE INDEX `admission_enquiries_org_status_idx` ON `admission_enquiries` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `admission_enquiries_campus_followup_idx` ON `admission_enquiries` (`campus_id`,`next_follow_up_on`);