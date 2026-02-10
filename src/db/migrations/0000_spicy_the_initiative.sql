CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`business_name` text NOT NULL,
	`trade_type` text NOT NULL,
	`county` text NOT NULL,
	`whatsapp_number` text NOT NULL,
	`gbp_account_id` text NOT NULL,
	`gbp_location_id` text NOT NULL,
	`website_repo` text NOT NULL,
	`gbp_refresh_token` text,
	`gbp_access_token` text,
	`gbp_token_expires_at` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_whatsapp_number_unique` ON `clients` (`whatsapp_number`);--> statement-breakpoint
CREATE TABLE `pending_reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`review_id` text NOT NULL,
	`reviewer_name` text,
	`review_text` text,
	`star_rating` integer NOT NULL,
	`suggested_reply` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`custom_reply_text` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pending_reviews_review_id_unique` ON `pending_reviews` (`review_id`);