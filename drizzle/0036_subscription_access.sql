CREATE TABLE `organization_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`plan` text NOT NULL,
	`status` text NOT NULL,
	`amount_pkr` integer DEFAULT 0 NOT NULL,
	`trial_starts_at` integer,
	`trial_ends_at` integer,
	`starts_at` integer,
	`ends_at` integer,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_subscriptions_org_uq` ON `organization_subscriptions` (`organization_id`);
--> statement-breakpoint
CREATE INDEX `organization_subscriptions_status_idx` ON `organization_subscriptions` (`status`,`ends_at`);
--> statement-breakpoint
CREATE TABLE `subscription_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`plan` text NOT NULL,
	`amount_pkr` integer NOT NULL,
	`payment_method` text NOT NULL,
	`payment_reference` text NOT NULL,
	`payer_name` text NOT NULL,
	`receipt_r2_key` text NOT NULL,
	`receipt_name` text NOT NULL,
	`receipt_content_type` text NOT NULL,
	`receipt_size_bytes` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_note` text,
	`submitted_by` text NOT NULL,
	`reviewed_by` text,
	`submitted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`reviewed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `organization_subscriptions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `subscription_payments_org_status_idx` ON `subscription_payments` (`organization_id`,`status`,`submitted_at`);
--> statement-breakpoint
CREATE INDEX `subscription_payments_status_idx` ON `subscription_payments` (`status`,`submitted_at`);
--> statement-breakpoint
INSERT INTO `organization_subscriptions` (`id`,`organization_id`,`plan`,`status`,`amount_pkr`,`starts_at`,`created_at`,`updated_at`)
SELECT 'legacy:' || `id`,`id`,'legacy','active',0,`created_at`,unixepoch() * 1000,unixepoch() * 1000 FROM `organizations`;
