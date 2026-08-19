import {
  boolean,
  foreignKey,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  accessState: mysqlEnum("accessState", ["invited", "approved", "suspended"])
    .default("invited")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const profiles = mysqlTable(
  "profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 40 }).notNull().unique(),
    displayName: varchar("displayName", { length: 80 }).notNull(),
    avatarKey: varchar("avatarKey", { length: 512 }),
    bannerKey: varchar("bannerKey", { length: 512 }),
    bio: varchar("bio", { length: 500 }),
    presence: mysqlEnum("presence", ["online", "idle", "dnd", "invisible", "offline"])
      .default("offline")
      .notNull(),
    customStatus: varchar("customStatus", { length: 160 }),
    presenceUpdatedAt: timestamp("presenceUpdatedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("profiles_presence_idx").on(table.presence)],
);

export const userSettings = mysqlTable("userSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  privacy: json("privacy").$type<Record<string, boolean>>().notNull(),
  appearance: json("appearance").$type<Record<string, string | boolean>>().notNull(),
  notifications: json("notifications").$type<Record<string, boolean>>().notNull(),
  voiceVideo: json("voiceVideo").$type<Record<string, string | boolean>>().notNull(),
  accessibility: json("accessibility").$type<Record<string, boolean | number>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const communities = mysqlTable(
  "communities",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 100 }).notNull(),
    iconKey: varchar("iconKey", { length: 512 }),
    bannerKey: varchar("bannerKey", { length: 512 }),
    description: varchar("description", { length: 1000 }),
    visibility: mysqlEnum("visibility", ["private"]).default("private").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("communities_owner_idx").on(table.ownerUserId)],
);

export const communityMembers = mysqlTable(
  "communityMembers",
  {
    id: int("id").autoincrement().primaryKey(),
    communityId: int("communityId").notNull().references(() => communities.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    nickname: varchar("nickname", { length: 80 }),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("community_members_unique").on(table.communityId, table.userId),
    index("community_members_user_idx").on(table.userId),
  ],
);

export const roles = mysqlTable(
  "roles",
  {
    id: int("id").autoincrement().primaryKey(),
    communityId: int("communityId").notNull().references(() => communities.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    color: varchar("color", { length: 16 }),
    position: int("position").default(0).notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
    permissions: json("permissions").$type<string[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("community_role_name_unique").on(table.communityId, table.name),
    index("roles_community_position_idx").on(table.communityId, table.position),
  ],
);

export const memberRoles = mysqlTable(
  "memberRoles",
  {
    id: int("id").autoincrement().primaryKey(),
    communityMemberId: int("communityMemberId").notNull().references(() => communityMembers.id, { onDelete: "cascade" }),
    roleId: int("roleId").notNull().references(() => roles.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("member_role_unique").on(table.communityMemberId, table.roleId)],
);

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    communityId: int("communityId").notNull().references(() => communities.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("categories_community_position_idx").on(table.communityId, table.position)],
);

export const channels = mysqlTable(
  "channels",
  {
    id: int("id").autoincrement().primaryKey(),
    communityId: int("communityId").notNull().references(() => communities.id, { onDelete: "cascade" }),
    categoryId: int("categoryId").references(() => categories.id, { onDelete: "set null" }),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    type: mysqlEnum("channelType", ["text", "voice", "announcement"]).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    topic: varchar("topic", { length: 1024 }),
    position: int("position").default(0).notNull(),
    isPrivate: boolean("isPrivate").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("channels_community_category_idx").on(table.communityId, table.categoryId, table.position)],
);

export const channelRolePermissions = mysqlTable(
  "channelRolePermissions",
  {
    id: int("id").autoincrement().primaryKey(),
    channelId: int("channelId").notNull().references(() => channels.id, { onDelete: "cascade" }),
    roleId: int("roleId").notNull().references(() => roles.id, { onDelete: "cascade" }),
    allow: json("allow").$type<string[]>().notNull(),
    deny: json("deny").$type<string[]>().notNull(),
  },
  (table) => [uniqueIndex("channel_role_permissions_unique").on(table.channelId, table.roleId)],
);

export const messages = mysqlTable(
  "messages",
  {
    id: int("id").autoincrement().primaryKey(),
    channelId: int("channelId").notNull().references(() => channels.id, { onDelete: "cascade" }),
    authorUserId: int("authorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    replyToMessageId: int("replyToMessageId"),
    content: text("content"),
    isPinned: boolean("isPinned").default(false).notNull(),
    editedAt: timestamp("editedAt"),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("messages_channel_created_idx").on(table.channelId, table.createdAt),
    index("messages_author_created_idx").on(table.authorUserId, table.createdAt),
  ],
);

export const messageReactions = mysqlTable(
  "messageReactions",
  {
    id: int("id").autoincrement().primaryKey(),
    messageId: int("messageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: varchar("emoji", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("message_reaction_unique").on(table.messageId, table.userId, table.emoji)],
);

export const attachments = mysqlTable(
  "attachments",
  {
    id: int("id").autoincrement().primaryKey(),
    messageId: int("messageId").notNull().references(() => messages.id, { onDelete: "cascade" }),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 180 }).notNull(),
    byteSize: int("byteSize").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("attachments_message_idx").on(table.messageId)],
);

export const messageReads = mysqlTable(
  "messageReads",
  {
    id: int("id").autoincrement().primaryKey(),
    channelId: int("channelId").notNull().references(() => channels.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadMessageId: int("lastReadMessageId"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("message_reads_unique").on(table.channelId, table.userId)],
);

export const directConversations = mysqlTable(
  "directConversations",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("conversationType", ["direct", "group"]).notNull(),
    title: varchar("title", { length: 100 }),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("direct_conversations_creator_idx").on(table.createdByUserId)],
);

export const directConversationMembers = mysqlTable(
  "directConversationMembers",
  {
    id: int("id").autoincrement().primaryKey(),
    conversationId: int("conversationId").notNull(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadMessageId: int("lastReadMessageId"),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("direct_conversation_member_unique").on(table.conversationId, table.userId),
    index("direct_conversation_member_user_idx").on(table.userId),
    foreignKey({
      columns: [table.conversationId],
      foreignColumns: [directConversations.id],
      name: "dcm_conversation_fk",
    }).onDelete("cascade"),
  ],
);

export const directMessages = mysqlTable(
  "directMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    conversationId: int("conversationId").notNull().references(() => directConversations.id, { onDelete: "cascade" }),
    authorUserId: int("authorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    replyToMessageId: int("replyToMessageId"),
    content: text("content"),
    editedAt: timestamp("editedAt"),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("direct_messages_conversation_created_idx").on(table.conversationId, table.createdAt)],
);

export const directAttachments = mysqlTable(
  "directAttachments",
  {
    id: int("id").autoincrement().primaryKey(),
    directMessageId: int("directMessageId").notNull().references(() => directMessages.id, { onDelete: "cascade" }),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 180 }).notNull(),
    byteSize: int("byteSize").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("direct_attachments_message_idx").on(table.directMessageId)],
);

export const directMessageReactions = mysqlTable(
  "directMessageReactions",
  {
    id: int("id").autoincrement().primaryKey(),
    directMessageId: int("directMessageId").notNull().references(() => directMessages.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: varchar("emoji", { length: 64 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("direct_message_reaction_unique").on(table.directMessageId, table.userId, table.emoji)],
);

export const friendships = mysqlTable(
  "friendships",
  {
    id: int("id").autoincrement().primaryKey(),
    requesterUserId: int("requesterUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    recipientUserId: int("recipientUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: mysqlEnum("friendshipStatus", ["pending", "accepted", "rejected"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("friendships_directional_unique").on(table.requesterUserId, table.recipientUserId),
    index("friendships_recipient_status_idx").on(table.recipientUserId, table.status),
  ],
);

export const blockedUsers = mysqlTable(
  "blockedUsers",
  {
    id: int("id").autoincrement().primaryKey(),
    blockerUserId: int("blockerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedUserId: int("blockedUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("blocked_users_unique").on(table.blockerUserId, table.blockedUserId)],
);

export const mutedUsers = mysqlTable(
  "mutedUsers",
  {
    id: int("id").autoincrement().primaryKey(),
    muterUserId: int("muterUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    mutedUserId: int("mutedUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("muted_users_unique").on(table.muterUserId, table.mutedUserId)],
);

export const communityInvites = mysqlTable(
  "communityInvites",
  {
    id: int("id").autoincrement().primaryKey(),
    communityId: int("communityId").notNull().references(() => communities.id, { onDelete: "cascade" }),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull().unique(),
    maxUses: int("maxUses"),
    uses: int("uses").default(0).notNull(),
    expiresAt: timestamp("expiresAt"),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("community_invites_community_idx").on(table.communityId)],
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: mysqlEnum("notificationType", ["message", "mention", "friend_request", "incoming_call", "missed_call", "announcement"])
      .notNull(),
    payload: json("payload").$type<Record<string, string | number | boolean>>().notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("notifications_user_read_created_idx").on(table.userId, table.readAt, table.createdAt)],
);

export const moderationActions = mysqlTable(
  "moderationActions",
  {
    id: int("id").autoincrement().primaryKey(),
    communityId: int("communityId").notNull().references(() => communities.id, { onDelete: "cascade" }),
    moderatorUserId: int("moderatorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    targetUserId: int("targetUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    type: mysqlEnum("moderationType", ["delete_message", "kick", "ban", "timeout"])
      .notNull(),
    reason: varchar("reason", { length: 1000 }),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("moderation_actions_community_created_idx").on(table.communityId, table.createdAt)],
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    communityId: int("communityId").notNull().references(() => communities.id, { onDelete: "cascade" }),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    targetType: varchar("targetType", { length: 80 }),
    targetId: varchar("targetId", { length: 80 }),
    details: json("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("audit_logs_community_created_idx").on(table.communityId, table.createdAt)],
);

export const reports = mysqlTable(
  "reports",
  {
    id: int("id").autoincrement().primaryKey(),
    reporterUserId: int("reporterUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    communityId: int("communityId").references(() => communities.id, { onDelete: "set null" }),
    reportedUserId: int("reportedUserId").references(() => users.id, { onDelete: "set null" }),
    messageId: int("messageId").references(() => messages.id, { onDelete: "set null" }),
    reason: varchar("reason", { length: 1000 }).notNull(),
    status: mysqlEnum("reportStatus", ["open", "resolved", "dismissed"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    resolvedAt: timestamp("resolvedAt"),
  },
  (table) => [index("reports_status_created_idx").on(table.status, table.createdAt)],
);

export const calls = mysqlTable(
  "calls",
  {
    id: int("id").autoincrement().primaryKey(),
    initiatorUserId: int("initiatorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    channelId: int("channelId").references(() => channels.id, { onDelete: "set null" }),
    conversationId: int("conversationId").references(() => directConversations.id, { onDelete: "set null" }),
    providerRoomName: varchar("providerRoomName", { length: 180 }).notNull().unique(),
    kind: mysqlEnum("callKind", ["voice", "video"]).notNull(),
    status: mysqlEnum("callStatus", ["ringing", "active", "ended", "missed"])
      .default("ringing")
      .notNull(),
    startedAt: timestamp("startedAt"),
    endedAt: timestamp("endedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("calls_channel_status_idx").on(table.channelId, table.status)],
);

export const callParticipants = mysqlTable(
  "callParticipants",
  {
    id: int("id").autoincrement().primaryKey(),
    callId: int("callId").notNull().references(() => calls.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joinedAt"),
    leftAt: timestamp("leftAt"),
  },
  (table) => [uniqueIndex("call_participant_unique").on(table.callId, table.userId)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
