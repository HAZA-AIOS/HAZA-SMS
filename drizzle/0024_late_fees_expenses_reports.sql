CREATE TABLE `late_fee_rules` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text REFERENCES `campuses`(`id`) ON DELETE cascade,
 `academic_year_id` text REFERENCES `academic_years`(`id`) ON DELETE restrict,
 `name` text NOT NULL,
 `calculation_type` text NOT NULL DEFAULT 'fixed',
 `value` integer NOT NULL DEFAULT 0,
 `grace_days` integer NOT NULL DEFAULT 0,
 `maximum_amount` integer,
 `status` text NOT NULL DEFAULT 'active',
 `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `late_fee_rules_scope_idx` ON `late_fee_rules` (`organization_id`,`campus_id`,`academic_year_id`,`status`);

CREATE TABLE `fee_late_fee_applications` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `invoice_id` text NOT NULL REFERENCES `fee_invoices`(`id`) ON DELETE cascade,
 `rule_id` text NOT NULL REFERENCES `late_fee_rules`(`id`) ON DELETE restrict,
 `amount` integer NOT NULL,
 `applied_on` text NOT NULL,
 `applied_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `fee_late_fee_invoice_rule_uq` ON `fee_late_fee_applications` (`invoice_id`,`rule_id`);
CREATE INDEX `fee_late_fee_scope_idx` ON `fee_late_fee_applications` (`organization_id`,`campus_id`,`applied_on`);

CREATE TABLE `expense_categories` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `name` text NOT NULL,
 `code` text NOT NULL,
 `status` text NOT NULL DEFAULT 'active',
 `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `expense_categories_org_code_uq` ON `expense_categories` (`organization_id`,`code`);

CREATE TABLE `expenses` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `category_id` text NOT NULL REFERENCES `expense_categories`(`id`) ON DELETE restrict,
 `expense_date` text NOT NULL,
 `amount` integer NOT NULL,
 `payee` text NOT NULL,
 `description` text NOT NULL,
 `payment_method` text NOT NULL DEFAULT 'cash',
 `reference_number` text,
 `status` text NOT NULL DEFAULT 'posted',
 `created_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `expenses_scope_date_idx` ON `expenses` (`organization_id`,`campus_id`,`expense_date`,`status`);
CREATE INDEX `expenses_category_date_idx` ON `expenses` (`organization_id`,`category_id`,`expense_date`);
