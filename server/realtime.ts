import { and, eq } from "drizzle-orm";
import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { calls, channels, communityMembers, directConversationMembers } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { getDb } from "./db";

export type PlatformUpdate = {
  type: "channel" | "direct" | "community" | "friendship" | "notification" | "call";
  id?: number;
  communityId?: number;
  channelId?: number;
  userId?: number;
};

let realtimeServer: Server | null = null;

async function isCommunityMember(userId: number, communityId: number) {
  const db = await getDb();
  if (!db) return false;
  const [membership] = await db.select({ id: communityMembers.id }).from(communityMembers).where(and(eq(communityMembers.userId, userId), eq(communityMembers.communityId, communityId))).limit(1);
  return Boolean(membership);
}

async function isChannelMember(userId: number, channelId: number) {
  const db = await getDb();
  if (!db) return false;
  const [channel] = await db.select({ communityId: channels.communityId }).from(channels).where(eq(channels.id, channelId)).limit(1);
  return Boolean(channel && await isCommunityMember(userId, channel.communityId));
}

async function isConversationMember(userId: number, conversationId: number) {
  const db = await getDb();
  if (!db) return false;
  const [membership] = await db.select({ id: directConversationMembers.id }).from(directConversationMembers).where(and(eq(directConversationMembers.userId, userId), eq(directConversationMembers.conversationId, conversationId))).limit(1);
  return Boolean(membership);
}

async function isCallMember(userId: number, callId: number) {
  const db = await getDb();
  if (!db) return false;
  const [call] = await db.select({ channelId: calls.channelId, conversationId: calls.conversationId }).from(calls).where(eq(calls.id, callId)).limit(1);
  if (!call) return false;
  if (call.channelId) return isChannelMember(userId, call.channelId);
  if (call.conversationId) return isConversationMember(userId, call.conversationId);
  return false;
}

export function registerRealtimeServer(server: HttpServer) {
  realtimeServer = new Server(server, { path: "/api/realtime", cors: { origin: true, credentials: true } });

  realtimeServer.use(async (socket, next) => {
    try {
      const user = await sdk.authenticateRequest(socket.request as never);
      if (!user) return next(new Error("Não autenticado."));
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("Não autenticado."));
    }
  });

  realtimeServer.on("connection", socket => {
    const userId = Number(socket.data.userId);
    socket.join(`user:${userId}`);
    socket.emit("platform:ready");

    socket.on("watch:community", async (communityId: unknown) => {
      if (typeof communityId === "number" && await isCommunityMember(userId, communityId)) socket.join(`community:${communityId}`);
    });
    socket.on("watch:channel", async (channelId: unknown) => {
      if (typeof channelId === "number" && await isChannelMember(userId, channelId)) socket.join(`channel:${channelId}`);
    });
    socket.on("watch:direct", async (conversationId: unknown) => {
      if (typeof conversationId === "number" && await isConversationMember(userId, conversationId)) socket.join(`direct:${conversationId}`);
    });
    socket.on("watch:call", async (callId: unknown) => {
      if (typeof callId === "number" && await isCallMember(userId, callId)) socket.join(`call:${callId}`);
    });
    socket.on("typing:channel", async (channelId: unknown) => {
      if (typeof channelId === "number" && await isChannelMember(userId, channelId)) socket.to(`channel:${channelId}`).emit("typing:channel", { channelId, userId, active: true });
    });
    socket.on("typing:direct", async (conversationId: unknown) => {
      if (typeof conversationId === "number" && await isConversationMember(userId, conversationId)) socket.to(`direct:${conversationId}`).emit("typing:direct", { conversationId, userId, active: true });
    });
  });
}

export function publishPlatformUpdate(update: PlatformUpdate) {
  if (!realtimeServer) return;
  if (update.userId) realtimeServer.to(`user:${update.userId}`).emit("platform:refresh", update);
  if (update.communityId) realtimeServer.to(`community:${update.communityId}`).emit("platform:refresh", update);
  if (update.channelId) realtimeServer.to(`channel:${update.channelId}`).emit("platform:refresh", update);
  if (update.type === "direct" && update.id) realtimeServer.to(`direct:${update.id}`).emit("platform:refresh", update);
  if (update.type === "call" && update.id) realtimeServer.to(`call:${update.id}`).emit("platform:refresh", update);
}
