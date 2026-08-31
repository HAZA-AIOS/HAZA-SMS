CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`family_code` text NOT NULL,
	`family_name` text NOT NULL,
	`address` text,
	`city` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `families_org_code_uq` ON `families` (`organization_id`,`family_code`);--> statement-breakpoint
CREATE INDEX `families_org_name_idx` ON `families` (`organization_id`,`family_name`);--> statement-breakpoint
CREATE TABLE `guardians` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`family_id` text,
	`first_name` text NOT NULL,
	`last_name` text,
	`national_id` text,
	`occupation` text,
	`employer` text,
	`primary_phone` text NOT NULL,
	`alternate_phone` text,
	`email` text,
	`address` text,
	`city` text,
	`preferred_language` text DEFAULT 'English' NOT NULL,
	`communication_opt_in` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `guardians_org_phone_idx` ON `guardians` (`organization_id`,`primary_phone`);--> statement-breakpoint
CREATE INDEX `guardians_family_idx` ON `guardians` (`family_id`);--> statement-breakpoint
CREATE INDEX `guardians_org_email_idx` ON `guardians` (`organization_id`,`email`);--> statement-breakpoint
CREATE TABLE `student_guardians` (
	`student_id` text NOT NULL,
	`guardian_id` text NOT NULL,
	`relationship` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`lives_with_student` integer DEFAULT false NOT NULL,
	`legal_guardian` integer DEFAULT false NOT NULL,
	`pickup_authorized` integer DEFAULT false NOT NULL,
	`receives_academic` integer DEFAULT true NOT NULL,
	`receives_financial` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`student_id`, `guardian_id`),
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `student_guardians_guardian_idx` ON `student_guardians` (`guardian_id`);--> statement-breakpoint
CREATE INDEX `student_guardians_primary_idx` ON `student_guardians` (`student_id`,`is_primary`);