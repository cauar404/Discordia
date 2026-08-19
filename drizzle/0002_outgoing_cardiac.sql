ALTER TABLE `directConversationMembers` DROP FOREIGN KEY `directConversationMembers_conversationId_directConversations_id_fk`;
--> statement-breakpoint
ALTER TABLE `directConversationMembers` ADD CONSTRAINT `dcm_conversation_fk` FOREIGN KEY (`conversationId`) REFERENCES `directConversations`(`id`) ON DELETE cascade ON UPDATE no action;