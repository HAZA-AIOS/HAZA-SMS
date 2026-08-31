CREATE TABLE `examination_timetable_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
  `academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`) ON DELETE restrict,
  `term_id` text REFERENCES `academic_terms`(`id`) ON DELETE set null,
  `exam_name` text NOT NULL,
  `exam_type` text NOT NULL DEFAULT 'term',
  `class_id` text NOT NULL REFERENCES `classes`(`id`) ON DELETE cascade,
  `section_id` text REFERENCES `sections`(`id`) ON DELETE cascade,
  `subject_id` text NOT NULL REFERENCES `subjects`(`id`) ON DELETE restrict,
  `exam_date` text NOT NULL,
  `starts_at` text NOT NULL,
  `ends_at` text NOT NULL,
  `room_name` text,
  `invigilator_staff_id` text REFERENCES `staff`(`id`) ON DELETE set null,
  `maximum_marks` integer DEFAULT 100 NOT NULL,
  `status` text DEFAULT 'scheduled' NOT NULL,
  `notes` text,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exam_timetable_class_subject_date_uq` ON `examination_timetable_entries` (`academic_year_id`,`campus_id`,`class_id`,`section_id`,`subject_id`,`exam_date`,`starts_at`);
--> statement-breakpoint
CREATE INDEX `exam_timetable_campus_date_idx` ON `examination_timetable_entries` (`organization_id`,`campus_id`,`exam_date`,`status`);
--> statement-breakpoint
CREATE INDEX `exam_timetable_invigilator_idx` ON `examination_timetable_entries` (`organization_id`,`invigilator_staff_id`,`exam_date`,`starts_at`,`ends_at`);
--> statement-breakpoint
CREATE TABLE `school_events` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `campus_id` text REFERENCES `campuses`(`id`) ON DELETE cascade,
  `academic_year_id` text REFERENCES `academic_years`(`id`) ON DELETE set null,
  `title` text NOT NULL,
  `event_type` text NOT NULL DEFAULT 'school',
  `starts_on` text NOT NULL,
  `ends_on` text NOT NULL,
  `starts_at` text,
  `ends_at` text,
  `location` text,
  `description` text,
  `audience` text DEFAULT 'all' NOT NULL,
  `status` text DEFAULT 'scheduled' NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `school_events_scope_date_idx` ON `school_events` (`organization_id`,`campus_id`,`starts_on`,`status`);
