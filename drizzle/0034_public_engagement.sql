CREATE TABLE `parent_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `parent_feedback_org_status_created_idx` ON `parent_feedback` (`organization_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `public_form_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
