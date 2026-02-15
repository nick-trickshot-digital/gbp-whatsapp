CREATE TABLE `processed_webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`processed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `processed_webhooks_message_id_unique` ON `processed_webhooks` (`message_id`);