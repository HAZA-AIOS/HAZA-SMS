CREATE TABLE `admission_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`application_id` text NOT NULL,
	`assessment_type` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`venue` text,
	`max_score` integer,
	`score` integer,
	`result` text DEFAULT 'scheduled' NOT NULL,
	`remarks` text,
	`conducted_by` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `admission_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`conducted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `admission_assessments_app_idx` ON `admission_assessments` (`organization_id`,`application_id`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `admission_assessments_result_idx` ON `admission_assessments` (`organization_id`,`result`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `admission_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`application_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	`verification_notes` text,
	`verified_by` text,
	`verified_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `admission_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `storage_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `admission_documents_app_idx` ON `admission_documents` (`organization_id`,`application_id`,`document_type`);--> statement-breakpoint
CREATE INDEX `admission_documents_status_idx` ON `admission_documents` (`organization_id`,`verification_status`);--> statement-breakpoint
CREATE UNIQUE INDEX `admission_documents_asset_uq` ON `admission_documents` (`asset_id`);--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `guardian_relationship` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `guardian_national_id` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `guardian_occupation` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `alternate_phone` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `address` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `city` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `previous_school` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `previous_class` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `medical_notes` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `special_needs` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `declaration_accepted` integer DEFAULT false NOT NULL;