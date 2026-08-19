CREATE TABLE `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(180) NOT NULL,
	`byteSize` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`targetType` varchar(80),
	`targetId` varchar(80),
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blockedUsers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockerUserId` int NOT NULL,
	`blockedUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blockedUsers_id` PRIMARY KEY(`id`),
	CONSTRAINT `blocked_users_unique` UNIQUE(`blockerUserId`,`blockedUserId`)
);
--> statement-breakpoint
CREATE TABLE `callParticipants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`callId` int NOT NULL,
	`userId` int NOT NULL,
	`joinedAt` timestamp,
	`leftAt` timestamp,
	CONSTRAINT `callParticipants_id` PRIMARY KEY(`id`),
	CONSTRAINT `call_participant_unique` UNIQUE(`callId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `calls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`initiatorUserId` int NOT NULL,
	`channelId` int,
	`conversationId` int,
	`providerRoomName` varchar(180) NOT NULL,
	`callKind` enum('voice','video') NOT NULL,
	`callStatus` enum('ringing','active','ended','missed') NOT NULL DEFAULT 'ringing',
	`startedAt` timestamp,
	`endedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calls_id` PRIMARY KEY(`id`),
	CONSTRAINT `calls_providerRoomName_unique` UNIQUE(`providerRoomName`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channelRolePermissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`roleId` int NOT NULL,
	`allow` json NOT NULL,
	`deny` json NOT NULL,
	CONSTRAINT `channelRolePermissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `channel_role_permissions_unique` UNIQUE(`channelId`,`roleId`)
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`categoryId` int,
	`createdByUserId` int NOT NULL,
	`channelType` enum('text','voice','announcement') NOT NULL,
	`name` varchar(100) NOT NULL,
	`topic` varchar(1024),
	`position` int NOT NULL DEFAULT 0,
	`isPrivate` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`iconKey` varchar(512),
	`bannerKey` varchar(512),
	`description` varchar(1000),
	`visibility` enum('private') NOT NULL DEFAULT 'private',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `communities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communityInvites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`maxUses` int,
	`uses` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communityInvites_id` PRIMARY KEY(`id`),
	CONSTRAINT `communityInvites_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `communityMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`userId` int NOT NULL,
	`nickname` varchar(80),
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communityMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `community_members_unique` UNIQUE(`communityId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `directConversationMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`userId` int NOT NULL,
	`lastReadMessageId` int,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `directConversationMembers_id` PRIMARY KEY(`id`),
	CONSTRAINT `direct_conversation_member_unique` UNIQUE(`conversationId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `directConversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationType` enum('direct','group') NOT NULL,
	`title` varchar(100),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `directConversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `directMessageReactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`directMessageId` int NOT NULL,
	`userId` int NOT NULL,
	`emoji` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `directMessageReactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `direct_message_reaction_unique` UNIQUE(`directMessageId`,`userId`,`emoji`)
);
--> statement-breakpoint
CREATE TABLE `directMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`replyToMessageId` int,
	`content` text,
	`editedAt` timestamp,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `directMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requesterUserId` int NOT NULL,
	`recipientUserId` int NOT NULL,
	`friendshipStatus` enum('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `friendships_id` PRIMARY KEY(`id`),
	CONSTRAINT `friendships_directional_unique` UNIQUE(`requesterUserId`,`recipientUserId`)
);
--> statement-breakpoint
CREATE TABLE `memberRoles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityMemberId` int NOT NULL,
	`roleId` int NOT NULL,
	CONSTRAINT `memberRoles_id` PRIMARY KEY(`id`),
	CONSTRAINT `member_role_unique` UNIQUE(`communityMemberId`,`roleId`)
);
--> statement-breakpoint
CREATE TABLE `messageReactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`emoji` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messageReactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_reaction_unique` UNIQUE(`messageId`,`userId`,`emoji`)
);
--> statement-breakpoint
CREATE TABLE `messageReads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`userId` int NOT NULL,
	`lastReadMessageId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `messageReads_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_reads_unique` UNIQUE(`channelId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`replyToMessageId` int,
	`content` text,
	`isPinned` boolean NOT NULL DEFAULT false,
	`editedAt` timestamp,
	`deletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moderationActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`moderatorUserId` int NOT NULL,
	`targetUserId` int NOT NULL,
	`moderationType` enum('delete_message','kick','ban','timeout') NOT NULL,
	`reason` varchar(1000),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderationActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`notificationType` enum('message','mention','friend_request','incoming_call','missed_call','announcement') NOT NULL,
	`payload` json NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(40) NOT NULL,
	`displayName` varchar(80) NOT NULL,
	`avatarKey` varchar(512),
	`bannerKey` varchar(512),
	`bio` varchar(500),
	`presence` enum('online','idle','dnd','invisible','offline') NOT NULL DEFAULT 'offline',
	`customStatus` varchar(160),
	`presenceUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `profiles_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `profiles_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reporterUserId` int NOT NULL,
	`communityId` int,
	`reportedUserId` int,
	`messageId` int,
	`reason` varchar(1000) NOT NULL,
	`reportStatus` enum('open','resolved','dismissed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`communityId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`color` varchar(16),
	`position` int NOT NULL DEFAULT 0,
	`isDefault` boolean NOT NULL DEFAULT false,
	`permissions` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `community_role_name_unique` UNIQUE(`communityId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `userSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`privacy` json NOT NULL,
	`appearance` json NOT NULL,
	`notifications` json NOT NULL,
	`voiceVideo` json NOT NULL,
	`accessibility` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `userSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `accessState` enum('invited','approved','suspended') DEFAULT 'invited' NOT NULL;--> statement-breakpoint
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_communityId_communities_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blockedUsers` ADD CONSTRAINT `blockedUsers_blockerUserId_users_id_fk` FOREIGN KEY (`blockerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blockedUsers` ADD CONSTRAINT `blockedUsers_blockedUserId_users_id_fk` FOREIGN KEY (`blockedUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `callParticipants` ADD CONSTRAINT `callParticipants_callId_calls_id_fk` FOREIGN KEY (`callId`) REFERENCES `calls`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `callParticipants` ADD CONSTRAINT `callParticipants_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calls` ADD CONSTRAINT `calls_initiatorUserId_users_id_fk` FOREIGN KEY (`initiatorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calls` ADD CONSTRAINT `calls_channelId_channels_id_fk` FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calls` ADD CONSTRAINT `calls_conversationId_directConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `directConversations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_communityId_communities_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `channelRolePermissions` ADD CONSTRAINT `channelRolePermissions_channelId_channels_id_fk` FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `channelRolePermissions` ADD CONSTRAINT `channelRolePermissions_roleId_roles_id_fk` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `channels` ADD CONSTRAINT `channels_communityId_communities_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `channels` ADD CONSTRAINT `channels_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `channels` ADD CONSTRAINT `channels_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communities` ADD CONSTRAINT `communities_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityInvites` ADD CONSTRAINT `communityInvites_communityId_communities_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityInvites` ADD CONSTRAINT `communityInvites_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityMembers` ADD CONSTRAINT `communityMembers_communityId_communities_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `communityMembers` ADD CONSTRAINT `communityMembers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `directConversationMembers` ADD CONSTRAINT `dcm_conversation_fk` FOREIGN KEY (`conversationId`) REFERENCES `directConversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `directConversationMembers` ADD CONSTRAINT `directConversationMembers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `directConversations` ADD CONSTRAINT `directConversations_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `directMessageReactions` ADD CONSTRAINT `directMessageReactions_directMessageId_directMessages_id_fk` FOREIGN KEY (`directMessageId`) REFERENCES `directMessages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `directMessageReactions` ADD CONSTRAINT `directMessageReactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `directMessages` ADD CONSTRAINT `directMessages_conversationId_directConversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `directConversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `directMessages` ADD CONSTRAINT `directMessages_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `friendships` ADD CONSTRAINT `friendships_requesterUserId_users_id_fk` FOREIGN KEY (`requesterUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `friendships` ADD CONSTRAINT `friendships_recipientUserId_users_id_fk` FOREIGN KEY (`recipientUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberRoles` ADD CONSTRAINT `memberRoles_communityMemberId_communityMembers_id_fk` FOREIGN KEY (`communityMemberId`) REFERENCES `communityMembers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberRoles` ADD CONSTRAINT `memberRoles_roleId_roles_id_fk` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messageReactions` ADD CONSTRAINT `messageReactions_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messageReactions` ADD CONSTRAINT `messageReactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messageReads` ADD CONSTRAINT `messageReads_channelId_channels_id_fk` FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messageReads` ADD CONSTRAINT `messageReads_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_channelId_channels_id_fk` FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderationActions` ADD CONSTRAINT `moderationActions_communityId_communities_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderationActions` ADD CONSTRAINT `moderationActions_moderatorUserId_users_id_fk` FOREIGN KEY (`moderatorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `moderationActions` ADD CONSTRAINT `moderationActions_targetUserId_users_id_fk` FOREIGN KEY (`targetUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_reporterUserId_users_id_fk` FOREIGN KEY (`reporterUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_communityId_communities_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communities`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_reportedUserId_users_id_fk` FOREIGN KEY (`reportedUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `reports_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_communityId_communities_id_fk` FOREIGN KEY (`communityId`) REFERENCES `communities`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userSettings` ADD CONSTRAINT `userSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attachments_message_idx` ON `attachments` (`messageId`);--> statement-breakpoint
CREATE INDEX `audit_logs_community_created_idx` ON `auditLogs` (`communityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `calls_channel_status_idx` ON `calls` (`channelId`,`callStatus`);--> statement-breakpoint
CREATE INDEX `categories_community_position_idx` ON `categories` (`communityId`,`position`);--> statement-breakpoint
CREATE INDEX `channels_community_category_idx` ON `channels` (`communityId`,`categoryId`,`position`);--> statement-breakpoint
CREATE INDEX `communities_owner_idx` ON `communities` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `community_invites_community_idx` ON `communityInvites` (`communityId`);--> statement-breakpoint
CREATE INDEX `community_members_user_idx` ON `communityMembers` (`userId`);--> statement-breakpoint
CREATE INDEX `direct_conversation_member_user_idx` ON `directConversationMembers` (`userId`);--> statement-breakpoint
CREATE INDEX `direct_conversations_creator_idx` ON `directConversations` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `direct_messages_conversation_created_idx` ON `directMessages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `friendships_recipient_status_idx` ON `friendships` (`recipientUserId`,`friendshipStatus`);--> statement-breakpoint
CREATE INDEX `messages_channel_created_idx` ON `messages` (`channelId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `messages_author_created_idx` ON `messages` (`authorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `moderation_actions_community_created_idx` ON `moderationActions` (`communityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_created_idx` ON `notifications` (`userId`,`readAt`,`createdAt`);--> statement-breakpoint
CREATE INDEX `profiles_presence_idx` ON `profiles` (`presence`);--> statement-breakpoint
CREATE INDEX `reports_status_created_idx` ON `reports` (`reportStatus`,`createdAt`);--> statement-breakpoint
CREATE INDEX `roles_community_position_idx` ON `roles` (`communityId`,`position`);
