CREATE TABLE `timetable_substitutions` (
  `id` text PRIMARY KEY NOT NULL,
  `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
  `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
  `timetable_entry_id` text NOT NULL REFERENCES `timetable_entries`(`id`) ON DELETE cascade,
  `substitution_date` text NOT NULL,
  `original_staff_id` text NOT NULL REFERENCES `staff`(`id`) ON DELETE restrict,
  `substitute_staff_id` text NOT NULL REFERENCES `staff`(`id`) ON DELETE restrict,
  `reason` text NOT NULL,
  `notes` text,
  `status` text DEFAULT 'scheduled' NOT NULL,
  `created_by` text NOT NULL REFERENCES `users`(`id`),
  `created_at` integer DEFAULT (unixepoch()*1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()*1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timetable_substitution_entry_date_uq` ON `timetable_substitutions` (`timetable_entry_id`,`substitution_date`);
--> statement-breakpoint
CREATE INDEX `timetable_substitution_teacher_date_idx` ON `timetable_substitutions` (`organization_id`,`substitute_staff_id`,`substitution_date`,`status`);
--> statement-breakpoint
CREATE INDEX `timetable_substitution_campus_date_idx` ON `timetable_substitutions` (`organization_id`,`campus_id`,`substitution_date`,`status`);
