CREATE TABLE `mutedUsers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`muterUserId` int NOT NULL,
	`mutedUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mutedUsers_id` PRIMARY KEY(`id`),
	CONSTRAINT `muted_users_unique` UNIQUE(`muterUserId`,`mutedUserId`)
);
--> statement-breakpoint
ALTER TABLE `mutedUsers` ADD CONSTRAINT `mutedUsers_muterUserId_users_id_fk` FOREIGN KEY (`muterUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mutedUsers` ADD CONSTRAINT `mutedUsers_mutedUserId_users_id_fk` FOREIGN KEY (`mutedUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;