CREATE TABLE `pending_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`prompt` text NOT NULL,
	`suggested_text` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`custom_text` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
