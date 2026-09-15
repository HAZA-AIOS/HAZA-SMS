CREATE TABLE `operational_check_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`status` text NOT NULL,
	`application_status` text NOT NULL,
	`database_status` text NOT NULL,
	`storage_status` text NOT NULL,
	`database_latency_ms` integer,
	`storage_latency_ms` integer,
	`triggered_by` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`triggered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `operational_check_runs_org_created_idx` ON `operational_check_runs` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `operational_check_runs_org_status_idx` ON `operational_check_runs` (`organization_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `monitoring_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`source` text NOT NULL,
	`severity` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_by` text NOT NULL,
	`acknowledged_by` text,
	`acknowledged_at` integer,
	`resolved_by` text,
	`resolved_at` integer,
	`resolution_note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `monitoring_incidents_org_status_idx` ON `monitoring_incidents` (`organization_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `monitoring_incidents_org_source_idx` ON `monitoring_incidents` (`organization_id`,`source`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
