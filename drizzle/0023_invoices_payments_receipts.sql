CREATE TABLE `fee_invoices` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`) ON DELETE restrict,
 `student_id` text NOT NULL REFERENCES `students`(`id`) ON DELETE cascade,
 `fee_assignment_id` text NOT NULL REFERENCES `student_fee_assignments`(`id`) ON DELETE restrict,
 `invoice_number` text NOT NULL,
 `billing_month` text NOT NULL,
 `issued_on` text NOT NULL,
 `due_on` text NOT NULL,
 `subtotal` integer DEFAULT 0 NOT NULL,
 `discount_amount` integer DEFAULT 0 NOT NULL,
 `late_fee` integer DEFAULT 0 NOT NULL,
 `total_amount` integer DEFAULT 0 NOT NULL,
 `paid_amount` integer DEFAULT 0 NOT NULL,
 `balance_amount` integer DEFAULT 0 NOT NULL,
 `status` text DEFAULT 'unpaid' NOT NULL,
 `notes` text,
 `created_by` text NOT NULL REFERENCES `users`(`id`),
 `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
 `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fee_invoice_student_month_uq` ON `fee_invoices` (`academic_year_id`,`student_id`,`billing_month`);
--> statement-breakpoint
CREATE UNIQUE INDEX `fee_invoice_org_number_uq` ON `fee_invoices` (`organization_id`,`invoice_number`);
--> statement-breakpoint
CREATE INDEX `fee_invoice_campus_status_idx` ON `fee_invoices` (`organization_id`,`campus_id`,`billing_month`,`status`);
--> statement-breakpoint
CREATE TABLE `fee_invoice_items` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `invoice_id` text NOT NULL REFERENCES `fee_invoices`(`id`) ON DELETE cascade,
 `fee_category_id` text NOT NULL REFERENCES `fee_categories`(`id`) ON DELETE restrict,
 `description` text NOT NULL,
 `amount` integer DEFAULT 0 NOT NULL,
 `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fee_invoice_items_invoice_idx` ON `fee_invoice_items` (`organization_id`,`invoice_id`);
--> statement-breakpoint
CREATE TABLE `fee_payments` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `invoice_id` text NOT NULL REFERENCES `fee_invoices`(`id`) ON DELETE restrict,
 `student_id` text NOT NULL REFERENCES `students`(`id`) ON DELETE restrict,
 `receipt_number` text NOT NULL,
 `amount` integer NOT NULL,
 `payment_date` text NOT NULL,
 `payment_method` text DEFAULT 'cash' NOT NULL,
 `reference_number` text,
 `notes` text,
 `received_by` text NOT NULL REFERENCES `users`(`id`),
 `status` text DEFAULT 'posted' NOT NULL,
 `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fee_payment_org_receipt_uq` ON `fee_payments` (`organization_id`,`receipt_number`);
--> statement-breakpoint
CREATE INDEX `fee_payment_invoice_idx` ON `fee_payments` (`organization_id`,`invoice_id`,`payment_date`);
