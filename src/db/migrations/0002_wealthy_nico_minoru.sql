CREATE TABLE `metrics_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`website_clicks` integer DEFAULT 0 NOT NULL,
	`call_clicks` integer DEFAULT 0 NOT NULL,
	`direction_requests` integer DEFAULT 0 NOT NULL,
	`week_start` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `nudges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`type` text NOT NULL,
	`sent_at` integer NOT NULL,
	`responded` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `clients` ADD `google_place_id` text;--> statement-breakpoint
ALTER TABLE `pending_posts` ADD `post_type` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `pending_posts` ADD `offer_end_date` integer;--> statement-breakpoint
ALTER TABLE `pending_posts` ADD `cta_type` text;