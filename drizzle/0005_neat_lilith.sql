CREATE TABLE `enrollment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`student_id` text NOT NULL,
	`enrollment_id` text,
	`event_type` text NOT NULL,
	`from_campus_id` text,
	`to_campus_id` text,
	`from_class_id` text,
	`to_class_id` text,
	`effective_on` text NOT NULL,
	`reason` text,
	`notes` text,
	`performed_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`from_campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`from_class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`performed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `enrollment_events_student_idx` ON `enrollment_events` (`organization_id`,`student_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `enrollment_events_type_idx` ON `enrollment_events` (`organization_id`,`event_type`,`effective_on`);--> statement-breakpoint
ALTER TABLE `student_documents` ADD `issued_on` text;--> statement-breakpoint
ALTER TABLE `student_documents` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `student_documents` ADD `verification_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `student_documents` ADD `is_required` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `student_documents` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `student_documents` ADD `verified_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `student_documents` ADD `verified_at` integer;--> statement-breakpoint
ALTER TABLE `student_documents` ADD `archived_at` integer;--> statement-breakpoint
CREATE INDEX `student_documents_status_idx` ON `student_documents` (`organization_id`,`verification_status`,`expires_on`);