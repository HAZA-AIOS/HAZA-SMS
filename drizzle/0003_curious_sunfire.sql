CREATE TABLE `student_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`student_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`expires_on` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `storage_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `student_documents_student_idx` ON `student_documents` (`organization_id`,`student_id`,`document_type`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_documents_asset_uq` ON `student_documents` (`asset_id`);--> statement-breakpoint
ALTER TABLE `students` ADD `blood_group` text;--> statement-breakpoint
ALTER TABLE `students` ADD `nationality` text;--> statement-breakpoint
ALTER TABLE `students` ADD `religion` text;--> statement-breakpoint
ALTER TABLE `students` ADD `national_id` text;--> statement-breakpoint
ALTER TABLE `students` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `students` ADD `email` text;--> statement-breakpoint
ALTER TABLE `students` ADD `address_line1` text;--> statement-breakpoint
ALTER TABLE `students` ADD `address_line2` text;--> statement-breakpoint
ALTER TABLE `students` ADD `city` text;--> statement-breakpoint
ALTER TABLE `students` ADD `province` text;--> statement-breakpoint
ALTER TABLE `students` ADD `postal_code` text;--> statement-breakpoint
ALTER TABLE `students` ADD `emergency_contact_name` text;--> statement-breakpoint
ALTER TABLE `students` ADD `emergency_contact_phone` text;--> statement-breakpoint
ALTER TABLE `students` ADD `emergency_contact_relation` text;--> statement-breakpoint
ALTER TABLE `students` ADD `medical_notes` text;--> statement-breakpoint
ALTER TABLE `students` ADD `allergies` text;--> statement-breakpoint
ALTER TABLE `students` ADD `previous_school` text;--> statement-breakpoint
ALTER TABLE `students` ADD `previous_class` text;--> statement-breakpoint
ALTER TABLE `students` ADD `profile_notes` text;