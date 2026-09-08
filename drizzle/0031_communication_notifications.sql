CREATE TABLE `communication_announcements` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text REFERENCES `campuses`(`id`) ON DELETE set null,
 `title` text NOT NULL,
 `body` text NOT NULL,
 `priority` text NOT NULL DEFAULT 'normal',
 `audience` text NOT NULL DEFAULT 'all',
 `status` text NOT NULL DEFAULT 'draft',
 `scheduled_at` integer,
 `published_at` integer,
 `expires_at` integer,
 `created_by` text NOT NULL REFERENCES `users`(`id`),
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `communication_announcements_org_status_idx` ON `communication_announcements` (`organization_id`,`status`,`published_at`);
CREATE INDEX `communication_announcements_campus_idx` ON `communication_announcements` (`organization_id`,`campus_id`);

CREATE TABLE `direct_messages` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text REFERENCES `campuses`(`id`) ON DELETE set null,
 `sender_user_id` text NOT NULL REFERENCES `users`(`id`),
 `recipient_user_id` text NOT NULL REFERENCES `users`(`id`),
 `subject` text NOT NULL,
 `body` text NOT NULL,
 `read_at` integer,
 `archived_by_sender` integer NOT NULL DEFAULT 0,
 `archived_by_recipient` integer NOT NULL DEFAULT 0,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `direct_messages_inbox_idx` ON `direct_messages` (`organization_id`,`recipient_user_id`,`read_at`,`created_at`);
CREATE INDEX `direct_messages_sent_idx` ON `direct_messages` (`organization_id`,`sender_user_id`,`created_at`);

CREATE TABLE `user_notifications` (
 `id` text PRIMARY KEY NOT NULL,
 `organization_id` text NOT NULL REFERENCES `organizations`(`id`) ON DELETE cascade,
 `campus_id` text REFERENCES `campuses`(`id`) ON DELETE set null,
 `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
 `event_code` text NOT NULL,
 `title` text NOT NULL,
 `body` text NOT NULL,
 `entity_type` text,
 `entity_id` text,
 `read_at` integer,
 `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000),
 `updated_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE INDEX `user_notifications_user_read_idx` ON `user_notifications` (`organization_id`,`user_id`,`read_at`,`created_at`);
CREATE INDEX `user_notifications_entity_idx` ON `user_notifications` (`organization_id`,`entity_type`,`entity_id`);
PRAGMA optimize;
