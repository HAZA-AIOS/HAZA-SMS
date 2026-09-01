CREATE TABLE `assessment_marks` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `assessment_id` text NOT NULL REFERENCES `assessments`(`id`) ON DELETE cascade,
 `student_id` text NOT NULL REFERENCES `students`(`id`) ON DELETE cascade,
 `enrollment_id` text NOT NULL REFERENCES `enrollments`(`id`) ON DELETE restrict,
 `obtained_marks` real,
 `percentage` real,
 `grade_label` text,
 `grade_point` real,
 `is_passing` integer,
 `is_absent` integer NOT NULL DEFAULT 0,
 `teacher_remarks` text,
 `entered_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX `assessment_marks_student_uq` ON `assessment_marks` (`assessment_id`,`student_id`);
CREATE INDEX `assessment_marks_scope_idx` ON `assessment_marks` (`organization_id`,`campus_id`,`assessment_id`);
CREATE INDEX `assessment_marks_student_idx` ON `assessment_marks` (`organization_id`,`student_id`,`assessment_id`);
