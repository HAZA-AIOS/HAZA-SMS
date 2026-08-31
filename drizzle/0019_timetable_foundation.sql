CREATE TABLE `school_schedules` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
  `name` text NOT NULL,
  `season` text NOT NULL,
  `starts_on` text NOT NULL,
  `ends_on` text NOT NULL,
  `school_starts_at` text NOT NULL,
  `school_ends_at` text NOT NULL,
  `break_starts_at` text NOT NULL,
  `break_ends_at` text NOT NULL,
  `working_days` text DEFAULT '1,2,3,4,5,6' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_schedules_campus_season_uq` ON `school_schedules` (`organization_id`,`campus_id`,`season`);
--> statement-breakpoint
CREATE INDEX `school_schedules_org_campus_idx` ON `school_schedules` (`organization_id`,`campus_id`,`status`);
--> statement-breakpoint
CREATE TABLE `timetable_periods` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
  `schedule_id` text NOT NULL REFERENCES `school_schedules`(`id`) ON DELETE cascade,
  `name` text NOT NULL,
  `period_number` integer NOT NULL,
  `starts_at` text NOT NULL,
  `ends_at` text NOT NULL,
  `is_break` integer DEFAULT 0 NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timetable_period_schedule_number_uq` ON `timetable_periods` (`schedule_id`,`period_number`);
--> statement-breakpoint
CREATE INDEX `timetable_period_org_campus_idx` ON `timetable_periods` (`organization_id`,`campus_id`,`schedule_id`);
--> statement-breakpoint
CREATE TABLE `timetable_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `academic_year_id` text NOT NULL REFERENCES `academic_years`(`id`) ON DELETE restrict,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
  `class_id` text NOT NULL REFERENCES `classes`(`id`) ON DELETE cascade,
  `section_id` text REFERENCES `sections`(`id`) ON DELETE cascade,
  `schedule_id` text NOT NULL REFERENCES `school_schedules`(`id`) ON DELETE cascade,
  `period_id` text NOT NULL REFERENCES `timetable_periods`(`id`) ON DELETE cascade,
  `weekday` integer NOT NULL,
  `subject_id` text REFERENCES `subjects`(`id`) ON DELETE set null,
  `staff_id` text REFERENCES `staff`(`id`) ON DELETE set null,
  `room_name` text,
  `status` text DEFAULT 'active' NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timetable_entry_class_slot_uq` ON `timetable_entries` (`academic_year_id`,`campus_id`,`class_id`,`section_id`,`schedule_id`,`weekday`,`period_id`);
--> statement-breakpoint
CREATE INDEX `timetable_entry_teacher_slot_idx` ON `timetable_entries` (`organization_id`,`staff_id`,`schedule_id`,`weekday`,`period_id`);
--> statement-breakpoint
CREATE INDEX `timetable_entry_class_idx` ON `timetable_entries` (`organization_id`,`campus_id`,`academic_year_id`,`class_id`,`section_id`);
