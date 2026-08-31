CREATE TABLE `student_attendance_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`) ON DELETE restrict,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE restrict,
  `class_id` text NOT NULL REFERENCES `classes`(`id`) ON DELETE restrict,
  `section_id` text REFERENCES `sections`(`id`) ON DELETE restrict,
  `scope_key` text NOT NULL,
  `attendance_date` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `student_count` integer DEFAULT 0 NOT NULL,
  `present_count` integer DEFAULT 0 NOT NULL,
  `absent_count` integer DEFAULT 0 NOT NULL,
  `late_count` integer DEFAULT 0 NOT NULL,
  `leave_count` integer DEFAULT 0 NOT NULL,
  `half_day_count` integer DEFAULT 0 NOT NULL,
  `marked_by` text NOT NULL REFERENCES `users`(`id`),
  `submitted_at` integer,
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_attendance_session_scope_uq` ON `student_attendance_sessions` (`organization_id`,`academic_year_id`,`campus_id`,`scope_key`,`attendance_date`);
--> statement-breakpoint
CREATE INDEX `student_attendance_session_date_idx` ON `student_attendance_sessions` (`organization_id`,`campus_id`,`attendance_date`);
--> statement-breakpoint
CREATE TABLE `student_attendance_records` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `session_id` text NOT NULL REFERENCES `student_attendance_sessions`(`id`) ON DELETE cascade,
  `student_id` text NOT NULL REFERENCES `students`(`id`) ON DELETE cascade,
  `enrollment_id` text NOT NULL REFERENCES `enrollments`(`id`) ON DELETE restrict,
  `attendance_date` text NOT NULL,
  `status` text DEFAULT 'present' NOT NULL,
  `remarks` text,
  `marked_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_attendance_session_student_uq` ON `student_attendance_records` (`session_id`,`student_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `student_attendance_student_date_uq` ON `student_attendance_records` (`organization_id`,`student_id`,`attendance_date`);
--> statement-breakpoint
CREATE INDEX `student_attendance_student_history_idx` ON `student_attendance_records` (`organization_id`,`student_id`,`attendance_date`);
--> statement-breakpoint
CREATE TABLE `student_attendance_corrections` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `attendance_record_id` text NOT NULL REFERENCES `student_attendance_records`(`id`) ON DELETE cascade,
  `previous_status` text NOT NULL,
  `new_status` text NOT NULL,
  `previous_remarks` text,
  `new_remarks` text,
  `reason` text NOT NULL,
  `corrected_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `student_attendance_correction_record_idx` ON `student_attendance_corrections` (`organization_id`,`attendance_record_id`,`created_at`);
