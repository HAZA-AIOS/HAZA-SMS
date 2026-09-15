ALTER TABLE `operational_check_runs` ADD `trigger_type` text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
CREATE TABLE `operational_automation_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`interval_minutes` integer DEFAULT 15 NOT NULL,
	`failure_threshold` integer DEFAULT 2 NOT NULL,
	`notify_recovery` integer DEFAULT true NOT NULL,
	`updated_by` text NOT NULL,
	`last_evaluated_at` integer,
	`last_result` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operational_automation_policies_org_uq` ON `operational_automation_policies` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `operational_automation_policies_due_idx` ON `operational_automation_policies` (`enabled`,`last_evaluated_at`);
--> statement-breakpoint
PRAGMA optimize;
