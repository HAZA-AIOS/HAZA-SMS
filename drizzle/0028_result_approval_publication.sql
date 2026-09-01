ALTER TABLE `assessments` ADD `submitted_by` text REFERENCES `users`(`id`) ON DELETE restrict;
ALTER TABLE `assessments` ADD `submitted_at` integer;
ALTER TABLE `assessments` ADD `approved_by` text REFERENCES `users`(`id`) ON DELETE restrict;
ALTER TABLE `assessments` ADD `approved_at` integer;
ALTER TABLE `assessments` ADD `published_by` text REFERENCES `users`(`id`) ON DELETE restrict;
ALTER TABLE `assessments` ADD `published_at` integer;
ALTER TABLE `assessments` ADD `approval_remarks` text;
CREATE INDEX `assessments_publication_idx` ON `assessments` (`organization_id`,`campus_id`,`status`,`published_at`);

CREATE TABLE `result_publications` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text NOT NULL REFERENCES `campuses`(`id`) ON DELETE cascade,
 `assessment_id` text NOT NULL REFERENCES `assessments`(`id`) ON DELETE cascade,
 `action` text NOT NULL,
 `remarks` text,
 `acted_by` text NOT NULL REFERENCES `users`(`id`) ON DELETE restrict,
 `acted_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `result_publications_assessment_idx` ON `result_publications` (`organization_id`,`campus_id`,`assessment_id`,`acted_at`);
