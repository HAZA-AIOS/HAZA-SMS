ALTER TABLE `backup_runs` ADD `checksum_sha256` text;
--> statement-breakpoint
ALTER TABLE `backup_runs` ADD `integrity_status` text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE `backup_runs` ADD `verified_at` integer;
--> statement-breakpoint
CREATE TABLE `operational_monitoring_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`database_budget_bytes` integer DEFAULT 536870912 NOT NULL,
	`storage_budget_bytes` integer DEFAULT 5368709120 NOT NULL,
	`capacity_warning_percent` integer DEFAULT 80 NOT NULL,
	`slow_request_threshold_ms` integer DEFAULT 1000 NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operational_monitoring_settings_org_uq` ON `operational_monitoring_settings` (`organization_id`);
--> statement-breakpoint
CREATE TABLE `capacity_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`database_logical_bytes` integer,
	`storage_bytes` integer DEFAULT 0 NOT NULL,
	`storage_object_count` integer DEFAULT 0 NOT NULL,
	`database_budget_bytes` integer NOT NULL,
	`storage_budget_bytes` integer NOT NULL,
	`warning_percent` integer NOT NULL,
	`triggered_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`triggered_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `capacity_snapshots_org_created_idx` ON `capacity_snapshots` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `api_performance_samples` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text,
	`route` text NOT NULL,
	`module` text NOT NULL,
	`method` text NOT NULL,
	`status_code` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`is_slow` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `api_performance_samples_org_created_idx` ON `api_performance_samples` (`organization_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `api_performance_samples_org_module_idx` ON `api_performance_samples` (`organization_id`,`module`,`created_at`);
--> statement-breakpoint
CREATE INDEX `api_performance_samples_org_slow_idx` ON `api_performance_samples` (`organization_id`,`is_slow`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;
