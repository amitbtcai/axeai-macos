CREATE TABLE `app_access_invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`server_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`invitee_email` text NOT NULL,
	`invitee_user_id` text,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`access_expires_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `server`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitee_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_access_invitation_token_hash_unique` ON `app_access_invitation` (`token_hash`);--> statement-breakpoint
CREATE INDEX `app_access_invitation_server_idx` ON `app_access_invitation` (`server_id`);--> statement-breakpoint
CREATE INDEX `app_access_invitation_invitee_idx` ON `app_access_invitation` (`invitee_user_id`);--> statement-breakpoint
CREATE INDEX `app_access_invitation_owner_idx` ON `app_access_invitation` (`owner_user_id`);