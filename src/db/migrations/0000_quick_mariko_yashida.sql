CREATE TABLE `book_state` (
	`user_id` text NOT NULL,
	`skill_id` integer NOT NULL,
	`book_index` integer NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`notes_written` integer DEFAULT false NOT NULL,
	`pdf_link` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `habit_days` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`skill_id` integer NOT NULL,
	`date_key` text NOT NULL,
	`checked` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `skill_state` (
	`user_id` text NOT NULL,
	`skill_id` integer NOT NULL,
	`status` text DEFAULT 'Not Started' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`course_done` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`pom_sessions` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_state` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`skill_id` integer NOT NULL,
	`task_index` integer NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);