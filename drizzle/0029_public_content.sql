CREATE TABLE `public_downloads` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text REFERENCES `campuses`(`id`) ON DELETE set null,
 `asset_id` text NOT NULL REFERENCES `storage_assets`(`id`) ON DELETE cascade,
 `title` text NOT NULL,
 `description` text,
 `status` text NOT NULL DEFAULT 'published',
 `published_at` integer,
 `created_by` text NOT NULL REFERENCES `users`(`id`),
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `public_downloads_org_status_idx` ON `public_downloads` (`organization_id`,`status`,`published_at`);
CREATE INDEX `public_downloads_campus_idx` ON `public_downloads` (`campus_id`);

CREATE TABLE `public_news_events` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text REFERENCES `campuses`(`id`) ON DELETE set null,
 `kind` text NOT NULL DEFAULT 'news',
 `title` text NOT NULL,
 `summary` text NOT NULL,
 `event_starts_at` integer,
 `event_ends_at` integer,
 `location` text,
 `status` text NOT NULL DEFAULT 'published',
 `published_at` integer,
 `created_by` text NOT NULL REFERENCES `users`(`id`),
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `public_news_events_org_status_idx` ON `public_news_events` (`organization_id`,`status`,`published_at`);
CREATE INDEX `public_news_events_campus_idx` ON `public_news_events` (`campus_id`);
CREATE INDEX `public_news_events_start_idx` ON `public_news_events` (`event_starts_at`);
