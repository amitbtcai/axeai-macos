ALTER TABLE `server` ADD `cloud_deployment_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `server_cloud_deployment_id_unique` ON `server` (`cloud_deployment_id`);