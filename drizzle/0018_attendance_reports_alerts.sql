CREATE TABLE `student_attendance_correction_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE restrict,
  `attendance_record_id` text NOT NULL REFERENCES `student_attendance_records`(`id`) ON DELETE cascade,
  `requested_status` text NOT NULL,
  `reason` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `requested_by` text NOT NULL REFERENCES `users`(`id`),
  `reviewed_by` text REFERENCES `users`(`id`),
  `review_notes` text,
  `reviewed_at` integer,
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `student_attendance_requests_status_idx` ON `student_attendance_correction_requests` (`organization_id`,`campus_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_attendance_request_pending_uq` ON `student_attendance_correction_requests` (`attendance_record_id`,`status`);
--> statement-breakpoint
CREATE TABLE `attendance_alerts` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE restrict,
  `student_id` text NOT NULL REFERENCES `students`(`id`) ON DELETE cascade,
  `attendance_record_id` text NOT NULL REFERENCES `student_attendance_records`(`id`) ON DELETE cascade,
  `alert_type` text NOT NULL,
  `status` text DEFAULT 'queued' NOT NULL,
  `recipient_count` integer DEFAULT 0 NOT NULL,
  `sent_at` integer,
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_alert_record_type_uq` ON `attendance_alerts` (`attendance_record_id`,`alert_type`);
--> statement-breakpoint
CREATE INDEX `attendance_alert_org_status_idx` ON `attendance_alerts` (`organization_id`,`campus_id`,`status`,`created_at`);
