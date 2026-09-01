CREATE TABLE `financial_accounts` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text REFERENCES `campuses`(`id`) ON DELETE cascade,
 `name` text NOT NULL,
 `code` text NOT NULL,
 `account_type` text NOT NULL,
 `bank_name` text,
 `account_number_masked` text,
 `opening_balance` integer NOT NULL DEFAULT 0,
 `status` text NOT NULL DEFAULT 'active',
 `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `financial_accounts_org_code_uq` ON `financial_accounts` (`organization_id`,`code`);
CREATE INDEX `financial_accounts_scope_idx` ON `financial_accounts` (`organization_id`,`campus_id`,`account_type`,`status`);

ALTER TABLE `fee_payments` ADD COLUMN `financial_account_id` text REFERENCES `financial_accounts`(`id`) ON DELETE restrict;
ALTER TABLE `expenses` ADD COLUMN `financial_account_id` text REFERENCES `financial_accounts`(`id`) ON DELETE restrict;

CREATE TABLE `financial_approval_requests` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `entity_type` text NOT NULL,
 `entity_id` text NOT NULL,
 `amount` integer NOT NULL,
 `status` text NOT NULL DEFAULT 'pending',
 `requested_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `decided_by` text REFERENCES `users`(`id`) ON DELETE restrict,
 `decision_notes` text,
 `decided_at` integer,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `financial_approval_entity_uq` ON `financial_approval_requests` (`organization_id`,`entity_type`,`entity_id`);
CREATE INDEX `financial_approval_scope_status_idx` ON `financial_approval_requests` (`organization_id`,`campus_id`,`status`,`created_at`);
CREATE INDEX `fee_payments_account_date_idx` ON `fee_payments` (`organization_id`,`campus_id`,`financial_account_id`,`payment_date`);
CREATE INDEX `expenses_account_date_idx` ON `expenses` (`organization_id`,`campus_id`,`financial_account_id`,`expense_date`,`status`);
