CREATE TABLE `directAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`directMessageId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(180) NOT NULL,
	`byteSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `directAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `directAttachments` ADD CONSTRAINT `directAttachments_directMessageId_directMessages_id_fk` FOREIGN KEY (`directMessageId`) REFERENCES `directMessages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `direct_attachments_message_idx` ON `directAttachments` (`directMessageId`);