CREATE TABLE `admission_fee_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`campus_id` text,
	`class_id` text,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`admission_fee` integer DEFAULT 0 NOT NULL,
	`registration_fee` integer DEFAULT 0 NOT NULL,
	`security_deposit` integer DEFAULT 0 NOT NULL,
	`monthly_tuition` integer DEFAULT 0 NOT NULL,
	`annual_charges` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campus_id`) REFERENCES `campuses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admission_fee_packages_org_code_uq` ON `admission_fee_packages` (`organization_id`,`code`);--> statement-breakpoint
CREATE INDEX `admission_fee_packages_scope_idx` ON `admission_fee_packages` (`organization_id`,`campus_id`,`class_id`,`status`);--> statement-breakpoint
CREATE TABLE `application_fee_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`application_id` text NOT NULL,
	`fee_package_id` text NOT NULL,
	`discount_amount` integer DEFAULT 0 NOT NULL,
	`discount_reason` text,
	`notes` text,
	`assigned_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`application_id`) REFERENCES `admission_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fee_package_id`) REFERENCES `admission_fee_packages`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_fee_assignments_app_uq` ON `application_fee_assignments` (`application_id`);--> statement-breakpoint
CREATE INDEX `application_fee_assignments_org_package_idx` ON `application_fee_assignments` (`organization_id`,`fee_package_id`);--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `decision_notes` text;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `decided_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `decided_at` integer;--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `converted_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `admission_applications` ADD `converted_at` integer;