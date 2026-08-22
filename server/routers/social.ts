import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  blockedUsers,
  calls,
  callParticipants,
  channels,
  communities,
  communityMembers,
  directConversationMembers,
  directConversations,
  directAttachments,
  directMessageReactions,
  directMessages,
  friendships,
  moderationActions,
  memberRoles,
  mutedUsers,
  notifications,
  profiles,
  reports,
  roles,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { hasPermission, isApprovedAccess, isTimeoutActive } from "../policies";
import { consumeRateLimit } from "../rateLimit";
import { publishPlatformUpdate } from "../realtime";
import { storageGetSignedUrl, storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";
import { getChannelWithAccess } from "./platform";
import { groupVoiceCallPresence } from "../../shared/voiceCallPresence";

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

function requireApprovedUser(user: { role: string; accessState: string }) {
  if (!isApprovedAccess(user)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seu acesso ainda não foi aprovado." });
  }
}

async function requireChannelAccess(db: Awaited<ReturnType<typeof requireDatabase>>, channelId: number, userId: number) {
  const result = await getChannelWithAccess(db, channelId, userId, "connect_voice");
  return result.channel;
}

async function requireCommunityMember(db: Awaited<ReturnType<typeof requireDatabase>>, communityId: number, userId: number) {
  const [membership] = await db.select({ id: communityMembers.id }).from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId))).limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Você não participa desta comunidade." });
  return membership;
}

async function requireModerationAccess(db: Awaited<ReturnType<typeof requireDatabase>>, communityId: number, userId: number, systemRole: string) {
  if (systemRole === "admin") return;
  const [membership] = await db.select().from(communityMembers).where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId))).limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Você não participa desta comunidade." });
  const assigned = await db.select({ permissions: roles.permissions }).from(memberRoles).innerJoin(roles, eq(memberRoles.roleId, roles.id)).where(and(eq(memberRoles.communityMemberId, membership.id), eq(roles.communityId, communityId)));
  if (!["kick_members", "ban_members", "timeout_members", "manage_messages"].some(permission => hasPermission(assigned.map(item => item.permissions), permission))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não possui permissão de moderação nesta comunidade." });
  }
}

async function requireConversationAccess(db: Awaited<ReturnType<typeof requireDatabase>>, conversationId: number, userId: number) {
  const [membership] = await db.select().from(directConversationMembers).where(and(eq(directConversationMembers.conversationId, conversationId), eq(directConversationMembers.userId, userId))).limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Conversa indisponível para este usuário." });
  return membership;
}

function liveKitConfiguration() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A infraestrutura de chamadas ainda não foi configurada." });
  }
  return { url, apiKey, apiSecret };
}

function liveKitRoomService() {
  const configuration = liveKitConfiguration();
  const apiUrl = configuration.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  return new RoomServiceClient(apiUrl, configuration.apiKey, configuration.apiSecret);
}

async function liveParticipantIdsByCall(activeCalls: Array<{ id: number; providerRoomName: string }>) {
  if (!activeCalls.length || !process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) return null;
  try {
    const roomService = liveKitRoomService();
    const entries = await Promise.all(activeCalls.map(async call => [call.id, new Set((await roomService.listParticipants(call.providerRoomName)).map(participant => participant.identity))] as const));
    return new Map(entries);
  } catch {
    // A presença persistida continua como fallback durante uma indisponibilidade
    // administrativa temporária. Não removemos membros por uma falha de consulta.
    return null;
  }
}

export const socialRouter = router({
  people: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      return db.select().from(profiles).where(isNull(profiles.bannerKey)).orderBy(desc(profiles.presenceUpdatedAt)).limit(50);
    }),
    get: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [[profile], [relationship], [blocked], [muted], myMemberships, theirMemberships, myAcceptedFriendships, theirAcceptedFriendships] = await Promise.all([
        db.select().from(profiles).where(eq(profiles.userId, input.userId)).limit(1),
        db.select().from(friendships).where(or(and(eq(friendships.requesterUserId, ctx.user.id), eq(friendships.recipientUserId, input.userId)), and(eq(friendships.requesterUserId, input.userId), eq(friendships.recipientUserId, ctx.user.id)))).limit(1),
        db.select({ id: blockedUsers.id }).from(blockedUsers).where(and(eq(blockedUsers.blockerUserId, ctx.user.id), eq(blockedUsers.blockedUserId, input.userId))).limit(1),
        db.select({ id: mutedUsers.id }).from(mutedUsers).where(and(eq(mutedUsers.muterUserId, ctx.user.id), eq(mutedUsers.mutedUserId, input.userId))).limit(1),
        db.select({ communityId: communityMembers.communityId }).from(communityMembers).where(eq(communityMembers.userId, ctx.user.id)),
        db.select({ communityId: communityMembers.communityId }).from(communityMembers).where(eq(communityMembers.userId, input.userId)),
        db.select({ requesterUserId: friendships.requesterUserId, recipientUserId: friendships.recipientUserId }).from(friendships).where(and(eq(friendships.status, "accepted"), or(eq(friendships.requesterUserId, ctx.user.id), eq(friendships.recipientUserId, ctx.user.id)))),
        db.select({ requesterUserId: friendships.requesterUserId, recipientUserId: friendships.recipientUserId }).from(friendships).where(and(eq(friendships.status, "accepted"), or(eq(friendships.requesterUserId, input.userId), eq(friendships.recipientUserId, input.userId)))),
      ]);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado." });
      const myCommunityIds = new Set(myMemberships.map(item => item.communityId));
      const commonCommunityCount = theirMemberships.filter(item => myCommunityIds.has(item.communityId)).length;
      const friendshipPeers = (items: Array<{ requesterUserId: number; recipientUserId: number }>, userId: number) => new Set(items.map(item => item.requesterUserId === userId ? item.recipientUserId : item.requesterUserId));
      const myFriends = friendshipPeers(myAcceptedFriendships, ctx.user.id);
      const theirFriends = friendshipPeers(theirAcceptedFriendships, input.userId);
      const commonFriendCount = Array.from(myFriends).filter(userId => theirFriends.has(userId)).length;
      return { profile, relationship: relationship ?? null, blocked: Boolean(blocked), muted: Boolean(muted), commonCommunityCount, commonFriendCount };
    }),
  }),

  friendships: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      return db.select({ friendship: friendships, profile: profiles }).from(friendships).innerJoin(profiles, or(and(eq(friendships.requesterUserId, ctx.user.id), eq(profiles.userId, friendships.recipientUserId)), and(eq(friendships.recipientUserId, ctx.user.id), eq(profiles.userId, friendships.requesterUserId)))).where(or(eq(friendships.requesterUserId, ctx.user.id), eq(friendships.recipientUserId, ctx.user.id))).orderBy(desc(friendships.updatedAt));
    }),
    send: protectedProcedure.input(z.object({ recipientUserId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      if (!consumeRateLimit(`friend-request:${ctx.user.id}`, 10, 60_000)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas solicitações de amizade. Aguarde um momento." });
      if (input.recipientUserId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode adicionar a si mesmo." });
      const db = await requireDatabase();
      const [recipient] = await db.select().from(profiles).where(eq(profiles.userId, input.recipientUserId)).limit(1);
      if (!recipient) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
      const blocked = await db.select().from(blockedUsers).where(or(and(eq(blockedUsers.blockerUserId, ctx.user.id), eq(blockedUsers.blockedUserId, input.recipientUserId)), and(eq(blockedUsers.blockerUserId, input.recipientUserId), eq(blockedUsers.blockedUserId, ctx.user.id)))).limit(1);
      if (blocked.length) throw new TRPCError({ code: "FORBIDDEN", message: "Não é possível enviar solicitação para este usuário." });
      await db.insert(friendships).values({ requesterUserId: ctx.user.id, recipientUserId: input.recipientUserId, status: "pending" }).onDuplicateKeyUpdate({ set: { status: "pending" } });
      await db.insert(notifications).values({ userId: input.recipientUserId, type: "friend_request", payload: { requesterUserId: ctx.user.id } });
      publishPlatformUpdate({ type: "friendship", userId: input.recipientUserId });
      return { success: true };
    }),
    respond: protectedProcedure.input(z.object({ friendshipId: z.number().int().positive(), accept: z.boolean() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [friendship] = await db.select().from(friendships).where(eq(friendships.id, input.friendshipId)).limit(1);
      if (!friendship || friendship.recipientUserId !== ctx.user.id || friendship.status !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação indisponível." });
      await db.update(friendships).set({ status: input.accept ? "accepted" : "rejected" }).where(eq(friendships.id, input.friendshipId));
      publishPlatformUpdate({ type: "friendship", userId: friendship.requesterUserId });
      return { success: true };
    }),
    cancel: protectedProcedure.input(z.object({ friendshipId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [friendship] = await db.select().from(friendships).where(eq(friendships.id, input.friendshipId)).limit(1);
      if (!friendship || (friendship.requesterUserId !== ctx.user.id && friendship.recipientUserId !== ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação indisponível." });
      await db.delete(friendships).where(eq(friendships.id, input.friendshipId));
      publishPlatformUpdate({ type: "friendship", userId: friendship.requesterUserId === ctx.user.id ? friendship.recipientUserId : friendship.requesterUserId });
      return { success: true };
    }),
    block: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode bloquear a si mesmo." });
      const db = await requireDatabase();
      await db.insert(blockedUsers).values({ blockerUserId: ctx.user.id, blockedUserId: input.userId }).onDuplicateKeyUpdate({ set: { blockerUserId: ctx.user.id } });
      await db.delete(friendships).where(or(and(eq(friendships.requesterUserId, ctx.user.id), eq(friendships.recipientUserId, input.userId)), and(eq(friendships.requesterUserId, input.userId), eq(friendships.recipientUserId, ctx.user.id))));
      return { success: true };
    }),
    unblock: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await db.delete(blockedUsers).where(and(eq(blockedUsers.blockerUserId, ctx.user.id), eq(blockedUsers.blockedUserId, input.userId)));
      return { success: true };
    }),
    mute: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode silenciar a si mesmo." });
      const db = await requireDatabase();
      await db.insert(mutedUsers).values({ muterUserId: ctx.user.id, mutedUserId: input.userId }).onDuplicateKeyUpdate({ set: { muterUserId: ctx.user.id } });
      return { success: true };
    }),
    unmute: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await db.delete(mutedUsers).where(and(eq(mutedUsers.muterUserId, ctx.user.id), eq(mutedUsers.mutedUserId, input.userId)));
      return { success: true };
    }),
  }),

  directs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      return db.select({ conversation: directConversations, membership: directConversationMembers }).from(directConversationMembers).innerJoin(directConversations, eq(directConversationMembers.conversationId, directConversations.id)).where(eq(directConversationMembers.userId, ctx.user.id)).orderBy(desc(directConversations.updatedAt));
    }),
    create: protectedProcedure.input(z.object({ participantUserIds: z.array(z.number().int().positive()).min(1).max(14), title: z.string().trim().min(1).max(100).nullable().optional() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const userIds = Array.from(new Set([...input.participantUserIds, ctx.user.id]));
      if (userIds.length > 15) throw new TRPCError({ code: "BAD_REQUEST", message: "Conversas em grupo aceitam até 15 participantes." });
      const validProfiles = await db.select({ userId: profiles.userId }).from(profiles).where(inArray(profiles.userId, userIds));
      if (validProfiles.length !== userIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Um dos participantes não foi encontrado." });
      const [created] = await db.insert(directConversations).values({ type: userIds.length === 2 ? "direct" : "group", title: input.title ?? null, createdByUserId: ctx.user.id }).$returningId();
      await db.insert(directConversationMembers).values(userIds.map(userId => ({ conversationId: created.id, userId })));
      publishPlatformUpdate({ type: "direct", id: created.id });
      return { conversationId: created.id };
    }),
    messages: protectedProcedure.input(z.object({ conversationId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await requireConversationAccess(db, input.conversationId, ctx.user.id);
      const items = await db.select({ message: directMessages, profile: profiles }).from(directMessages).innerJoin(profiles, eq(directMessages.authorUserId, profiles.userId)).where(and(eq(directMessages.conversationId, input.conversationId), isNull(directMessages.deletedAt))).orderBy(desc(directMessages.createdAt)).limit(80);
      const ids = items.map(item => item.message.id);
      const reactions = ids.length ? await db.select().from(directMessageReactions).where(inArray(directMessageReactions.directMessageId, ids)) : [];
      const attachments = ids.length ? await db.select().from(directAttachments).where(inArray(directAttachments.directMessageId, ids)) : [];
      return { items: items.reverse(), reactions, attachments };
    }),
    downloadAttachment: protectedProcedure.input(z.object({ attachmentId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [record] = await db
        .select({ storageKey: directAttachments.storageKey, fileName: directAttachments.fileName, conversationId: directMessages.conversationId })
        .from(directAttachments)
        .innerJoin(directMessages, eq(directAttachments.directMessageId, directMessages.id))
        .where(eq(directAttachments.id, input.attachmentId))
        .limit(1);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Anexo não encontrado." });
      await requireConversationAccess(db, record.conversationId, ctx.user.id);
      return { fileName: record.fileName, url: await storageGetSignedUrl(record.storageKey) };
    }),
    send: protectedProcedure.input(z.object({ conversationId: z.number().int().positive(), content: z.string().trim().max(4000).default(""), replyToMessageId: z.number().int().positive().nullable().optional(), files: z.array(z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(180), base64: z.string().regex(/^[A-Za-z0-9+/=]+$/).max(14_000_000) })).max(10).default([]) }).refine(input => Boolean(input.content) || input.files.length > 0, "Envie uma mensagem ou anexo.")).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      if (!consumeRateLimit(`direct-message:${ctx.user.id}`, 25, 60_000)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Você enviou mensagens demais. Aguarde um momento." });
      const db = await requireDatabase();
      await requireConversationAccess(db, input.conversationId, ctx.user.id);
      const [created] = await db.insert(directMessages).values({ conversationId: input.conversationId, content: input.content, replyToMessageId: input.replyToMessageId ?? null, authorUserId: ctx.user.id }).$returningId();
      await Promise.all(input.files.map(async file => {
        const bytes = Buffer.from(file.base64, "base64");
        if (bytes.byteLength > 10 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Cada anexo pode ter no máximo 10 MB." });
        const sanitizedName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const stored = await storagePut(`direct-messages/${ctx.user.id}/${created.id}/${sanitizedName}`, bytes, file.mimeType);
        await db.insert(directAttachments).values({ directMessageId: created.id, storageKey: stored.key, fileName: file.fileName, mimeType: file.mimeType, byteSize: bytes.byteLength });
      }));
      const participants = await db.select({ userId: directConversationMembers.userId }).from(directConversationMembers).where(eq(directConversationMembers.conversationId, input.conversationId));
      await Promise.all(participants.filter(participant => participant.userId !== ctx.user.id).map(participant => db.insert(notifications).values({ userId: participant.userId, type: "message", payload: { conversationId: input.conversationId, messageId: created.id } })));
      publishPlatformUpdate({ type: "direct", id: input.conversationId });
      return { messageId: created.id };
    }),
    react: protectedProcedure.input(z.object({ directMessageId: z.number().int().positive(), emoji: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [message] = await db.select().from(directMessages).where(eq(directMessages.id, input.directMessageId)).limit(1);
      if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      await requireConversationAccess(db, message.conversationId, ctx.user.id);
      await db.insert(directMessageReactions).values({ ...input, userId: ctx.user.id }).onDuplicateKeyUpdate({ set: { emoji: input.emoji } });
      publishPlatformUpdate({ type: "direct", id: message.conversationId });
      return { success: true };
    }),
    update: protectedProcedure.input(z.object({ directMessageId: z.number().int().positive(), content: z.string().trim().min(1).max(4000) })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [message] = await db.select().from(directMessages).where(eq(directMessages.id, input.directMessageId)).limit(1);
      if (!message || message.authorUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode editar suas próprias mensagens." });
      await requireConversationAccess(db, message.conversationId, ctx.user.id);
      await db.update(directMessages).set({ content: input.content, editedAt: new Date() }).where(eq(directMessages.id, message.id));
      publishPlatformUpdate({ type: "direct", id: message.conversationId });
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ directMessageId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [message] = await db.select().from(directMessages).where(eq(directMessages.id, input.directMessageId)).limit(1);
      if (!message || message.authorUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode excluir suas próprias mensagens." });
      await requireConversationAccess(db, message.conversationId, ctx.user.id);
      await db.update(directMessages).set({ deletedAt: new Date() }).where(eq(directMessages.id, message.id));
      publishPlatformUpdate({ type: "direct", id: message.conversationId });
      return { success: true };
    }),
    markRead: protectedProcedure.input(z.object({ conversationId: z.number().int().positive(), lastReadMessageId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await requireConversationAccess(db, input.conversationId, ctx.user.id);
      await db.update(directConversationMembers).set({ lastReadMessageId: input.lastReadMessageId }).where(and(eq(directConversationMembers.conversationId, input.conversationId), eq(directConversationMembers.userId, ctx.user.id)));
      return { success: true };
    }),
  }),

  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      return db.select().from(notifications).where(eq(notifications.userId, ctx.user.id)).orderBy(desc(notifications.createdAt)).limit(100);
    }),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, input.notificationId), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),
  }),

  moderation: router({
    act: protectedProcedure.input(z.object({ communityId: z.number().int().positive(), targetUserId: z.number().int().positive(), type: z.enum(["delete_message", "kick", "ban", "timeout"]), reason: z.string().trim().max(1000).nullable().optional(), expiresAt: z.date().nullable().optional() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [community] = await db.select().from(communities).where(eq(communities.id, input.communityId)).limit(1);
      if (!community) throw new TRPCError({ code: "NOT_FOUND", message: "Comunidade não encontrada." });
      await requireModerationAccess(db, input.communityId, ctx.user.id, ctx.user.role);
      await db.insert(moderationActions).values({ communityId: input.communityId, moderatorUserId: ctx.user.id, targetUserId: input.targetUserId, type: input.type, reason: input.reason ?? null, expiresAt: input.expiresAt ?? null });
      if (input.type === "kick" || input.type === "ban") await db.delete(communityMembers).where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, input.targetUserId)));
      await db.insert(auditLogs).values({ communityId: input.communityId, actorUserId: ctx.user.id, action: `moderation.${input.type}`, targetType: "user", targetId: String(input.targetUserId), details: { reason: input.reason ?? "" } });
      publishPlatformUpdate({ type: "community", communityId: input.communityId, userId: input.targetUserId });
      return { success: true };
    }),
    logs: protectedProcedure.input(z.object({ communityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await requireModerationAccess(db, input.communityId, ctx.user.id, ctx.user.role);
      return db.select().from(auditLogs).where(eq(auditLogs.communityId, input.communityId)).orderBy(desc(auditLogs.createdAt)).limit(100);
    }),
    states: protectedProcedure.input(z.object({ communityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await requireModerationAccess(db, input.communityId, ctx.user.id, ctx.user.role);
      const actions = await db
        .select({ action: moderationActions, profile: profiles })
        .from(moderationActions)
        .innerJoin(profiles, eq(moderationActions.targetUserId, profiles.userId))
        .where(and(eq(moderationActions.communityId, input.communityId), inArray(moderationActions.type, ["kick", "ban", "timeout"])))
        .orderBy(desc(moderationActions.createdAt))
        .limit(100);
      return Promise.all(actions.map(async ({ action, profile }) => {
        const [membership] = await db.select({ id: communityMembers.id }).from(communityMembers).where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, action.targetUserId))).limit(1);
        const active = action.type === "ban" ? !membership : action.type === "timeout" ? isTimeoutActive(action.expiresAt) : !membership;
        return { ...action, targetName: profile.displayName, targetUsername: profile.username, active };
      }));
    }),
    report: protectedProcedure.input(z.object({ communityId: z.number().int().positive().nullable().optional(), reportedUserId: z.number().int().positive().nullable().optional(), messageId: z.number().int().positive().nullable().optional(), reason: z.string().trim().min(1).max(1000) })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await db.insert(reports).values({ reporterUserId: ctx.user.id, communityId: input.communityId ?? null, reportedUserId: input.reportedUserId ?? null, messageId: input.messageId ?? null, reason: input.reason });
      return { success: true };
    }),
  }),

  calls: router({
    configured: protectedProcedure.query(() => Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET)),
    presenceByCommunity: protectedProcedure.input(z.object({ communityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await requireCommunityMember(db, input.communityId, ctx.user.id);
      const voiceChannels = await db.select({ id: channels.id }).from(channels).where(and(eq(channels.communityId, input.communityId), eq(channels.type, "voice")));
      if (!voiceChannels.length) return [];
      const channelIds = voiceChannels.map(channel => channel.id);
      const activeCalls = await db.select({ id: calls.id, channelId: calls.channelId, providerRoomName: calls.providerRoomName }).from(calls).where(and(inArray(calls.channelId, channelIds), inArray(calls.status, ["ringing", "active"])));
      if (!activeCalls.length) return [];
      const participants = await db.select({ callId: callParticipants.callId, userId: callParticipants.userId, displayName: profiles.displayName, avatarKey: profiles.avatarKey }).from(callParticipants).leftJoin(profiles, eq(profiles.userId, callParticipants.userId)).where(and(inArray(callParticipants.callId, activeCalls.map(call => call.id)), isNull(callParticipants.leftAt))).orderBy(callParticipants.joinedAt);
      const liveParticipants = await liveParticipantIdsByCall(activeCalls);
      const connectedParticipants = liveParticipants ? participants.filter(participant => liveParticipants.get(participant.callId)?.has(String(participant.userId))) : participants;
      return groupVoiceCallPresence(activeCalls, connectedParticipants);
    }),
    active: protectedProcedure.input(z.object({ channelId: z.number().int().positive().nullable().optional(), conversationId: z.number().int().positive().nullable().optional() }).refine(input => Boolean(input.channelId) !== Boolean(input.conversationId), "Escolha um canal ou uma conversa direta.")).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      if (input.channelId) await requireChannelAccess(db, input.channelId, ctx.user.id);
      if (input.conversationId) await requireConversationAccess(db, input.conversationId, ctx.user.id);
      const scope = input.channelId ? eq(calls.channelId, input.channelId) : eq(calls.conversationId, input.conversationId!);
      const [call] = await db.select().from(calls).where(and(scope, inArray(calls.status, ["ringing", "active"]))).orderBy(desc(calls.createdAt)).limit(1);
      if (!call) return null;
      const participants = await db.select({ userId: callParticipants.userId, displayName: profiles.displayName, avatarKey: profiles.avatarKey }).from(callParticipants).leftJoin(profiles, eq(profiles.userId, callParticipants.userId)).where(and(eq(callParticipants.callId, call.id), isNull(callParticipants.leftAt))).orderBy(callParticipants.joinedAt);
      const liveParticipants = await liveParticipantIdsByCall([{ id: call.id, providerRoomName: call.providerRoomName }]);
      const connectedParticipants = liveParticipants ? participants.filter(participant => liveParticipants.get(call.id)?.has(String(participant.userId))) : participants;
      if (liveParticipants && !connectedParticipants.length) return null;
      return { call, participants: connectedParticipants, isCurrentUserInCall: connectedParticipants.some(participant => participant.userId === ctx.user.id) };
    }),
    start: protectedProcedure.input(z.object({ kind: z.enum(["voice", "video"]), channelId: z.number().int().positive().nullable().optional(), conversationId: z.number().int().positive().nullable().optional() }).refine(input => Boolean(input.channelId) !== Boolean(input.conversationId), "Escolha um canal ou uma conversa direta.")).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      if (input.channelId) await requireChannelAccess(db, input.channelId, ctx.user.id);
      if (input.conversationId) await requireConversationAccess(db, input.conversationId, ctx.user.id);
      const scope = input.channelId ? eq(calls.channelId, input.channelId) : eq(calls.conversationId, input.conversationId!);
      const [existingCall] = await db.select().from(calls).where(and(scope, inArray(calls.status, ["ringing", "active"]))).orderBy(desc(calls.createdAt)).limit(1);
      if (existingCall) return { callId: existingCall.id, reused: true };
      const roomName = `circulo-${input.channelId ? "channel" : "direct"}-${input.channelId ?? input.conversationId}-${crypto.randomUUID()}`;
      const [created] = await db.insert(calls).values({ initiatorUserId: ctx.user.id, channelId: input.channelId ?? null, conversationId: input.conversationId ?? null, providerRoomName: roomName, kind: input.kind, status: "ringing" }).$returningId();
      const recipients = input.channelId
        ? await db.select({ userId: communityMembers.userId }).from(communityMembers).innerJoin(channels, eq(channels.communityId, communityMembers.communityId)).where(eq(channels.id, input.channelId))
        : await db.select({ userId: directConversationMembers.userId }).from(directConversationMembers).where(eq(directConversationMembers.conversationId, input.conversationId!));
      await Promise.all(recipients.filter(recipient => recipient.userId !== ctx.user.id).map(recipient => db.insert(notifications).values({ userId: recipient.userId, type: "incoming_call", payload: { callId: created.id, kind: input.kind } })));
      publishPlatformUpdate({ type: "call", id: created.id });
      return { callId: created.id };
    }),
    connect: protectedProcedure.input(z.object({ kind: z.enum(["voice", "video"]), channelId: z.number().int().positive().nullable().optional(), conversationId: z.number().int().positive().nullable().optional() }).refine(input => Boolean(input.channelId) !== Boolean(input.conversationId), "Escolha um canal ou uma conversa direta.")).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      if (input.channelId) await requireChannelAccess(db, input.channelId, ctx.user.id);
      if (input.conversationId) await requireConversationAccess(db, input.conversationId, ctx.user.id);
      const scope = input.channelId ? eq(calls.channelId, input.channelId) : eq(calls.conversationId, input.conversationId!);
      let [call] = await db.select().from(calls).where(and(scope, inArray(calls.status, ["ringing", "active"]))).orderBy(desc(calls.createdAt)).limit(1);
      if (!call) {
        const roomName = `circulo-${input.channelId ? "channel" : "direct"}-${input.channelId ?? input.conversationId}-${crypto.randomUUID()}`;
        const [created] = await db.insert(calls).values({ initiatorUserId: ctx.user.id, channelId: input.channelId ?? null, conversationId: input.conversationId ?? null, providerRoomName: roomName, kind: input.kind, status: "ringing" }).$returningId();
        [call] = await db.select().from(calls).where(eq(calls.id, created.id)).limit(1);
        const recipients = input.channelId
          ? await db.select({ userId: communityMembers.userId }).from(communityMembers).innerJoin(channels, eq(channels.communityId, communityMembers.communityId)).where(eq(channels.id, input.channelId))
          : await db.select({ userId: directConversationMembers.userId }).from(directConversationMembers).where(eq(directConversationMembers.conversationId, input.conversationId!));
        await Promise.all(recipients.filter(recipient => recipient.userId !== ctx.user.id).map(recipient => db.insert(notifications).values({ userId: recipient.userId, type: "incoming_call", payload: { callId: created.id, kind: input.kind } })));
      }
      if (!call) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível preparar a chamada." });
      const configuration = liveKitConfiguration();
      const token = new AccessToken(configuration.apiKey, configuration.apiSecret, { identity: String(ctx.user.id), name: ctx.user.name ?? `Usuário ${ctx.user.id}` });
      token.addGrant({ roomJoin: true, room: call.providerRoomName, canPublish: true, canSubscribe: true, canPublishData: true });
      await db.insert(callParticipants).values({ callId: call.id, userId: ctx.user.id, joinedAt: new Date(), leftAt: null }).onDuplicateKeyUpdate({ set: { joinedAt: new Date(), leftAt: null } });
      if (call.status === "ringing") await db.update(calls).set({ status: "active", startedAt: new Date() }).where(eq(calls.id, call.id));
      publishPlatformUpdate({ type: "call", id: call.id });
      return { serverUrl: configuration.url, token: await token.toJwt(), call };
    }),
    join: protectedProcedure.input(z.object({ callId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [call] = await db.select().from(calls).where(eq(calls.id, input.callId)).limit(1);
      if (!call || call.status === "ended") throw new TRPCError({ code: "NOT_FOUND", message: "Chamada indisponível." });
      if (call.channelId) await requireChannelAccess(db, call.channelId, ctx.user.id);
      if (call.conversationId) await requireConversationAccess(db, call.conversationId, ctx.user.id);
      const configuration = liveKitConfiguration();
      const token = new AccessToken(configuration.apiKey, configuration.apiSecret, { identity: String(ctx.user.id), name: ctx.user.name ?? `Usuário ${ctx.user.id}` });
      token.addGrant({ roomJoin: true, room: call.providerRoomName, canPublish: true, canSubscribe: true, canPublishData: true });
      await db.insert(callParticipants).values({ callId: call.id, userId: ctx.user.id, joinedAt: new Date(), leftAt: null }).onDuplicateKeyUpdate({ set: { joinedAt: new Date(), leftAt: null } });
      if (call.status === "ringing") await db.update(calls).set({ status: "active", startedAt: new Date() }).where(eq(calls.id, call.id));
      publishPlatformUpdate({ type: "call", id: call.id });
      return { serverUrl: configuration.url, token: await token.toJwt(), call };
    }),
    leave: protectedProcedure.input(z.object({ callId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await db.update(callParticipants).set({ leftAt: new Date() }).where(and(eq(callParticipants.callId, input.callId), eq(callParticipants.userId, ctx.user.id)));
      const [remainingParticipant] = await db.select({ id: callParticipants.id }).from(callParticipants).where(and(eq(callParticipants.callId, input.callId), isNull(callParticipants.leftAt))).limit(1);
      if (!remainingParticipant) await db.update(calls).set({ status: "ended", endedAt: new Date() }).where(and(eq(calls.id, input.callId), inArray(calls.status, ["ringing", "active"])));
      publishPlatformUpdate({ type: "call", id: input.callId });
      return { success: true };
    }),
    end: protectedProcedure.input(z.object({ callId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [call] = await db.select().from(calls).where(eq(calls.id, input.callId)).limit(1);
      if (!call || (call.initiatorUserId !== ctx.user.id && ctx.user.role !== "admin")) throw new TRPCError({ code: "FORBIDDEN", message: "Você não pode encerrar esta chamada." });
      await db.update(calls).set({ status: "ended", endedAt: new Date() }).where(eq(calls.id, call.id));
      const participants = await db.select().from(callParticipants).where(eq(callParticipants.callId, call.id));
      const joinedUsers = new Set(participants.filter(participant => participant.joinedAt && participant.userId !== call.initiatorUserId).map(participant => participant.userId));
      const recipients = call.channelId
        ? await db.select({ userId: communityMembers.userId }).from(communityMembers).innerJoin(channels, eq(channels.communityId, communityMembers.communityId)).where(eq(channels.id, call.channelId))
        : await db.select({ userId: directConversationMembers.userId }).from(directConversationMembers).where(eq(directConversationMembers.conversationId, call.conversationId!));
      await Promise.all(recipients.filter(recipient => recipient.userId !== call.initiatorUserId && !joinedUsers.has(recipient.userId)).map(recipient => db.insert(notifications).values({ userId: recipient.userId, type: "missed_call", payload: { callId: call.id, kind: call.kind } })));
      publishPlatformUpdate({ type: "call", id: input.callId });
      return { success: true };
    }),
  }),
});
