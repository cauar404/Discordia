import { TRPCError } from "@trpc/server";
import { timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  auditLogs,
  attachments,
  categories,
  channelRolePermissions,
  channels,
  communities,
  communityInvites,
  communityMembers,
  directAttachments,
  directConversationMembers,
  directMessages,
  memberRoles,
  messageReads,
  messageReactions,
  messages,
  moderationActions,
  notifications,
  profiles,
  roles,
  userSettings,
  users,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { canManageRole, hasPermission, isApprovedAccess, isTimeoutActive } from "../policies";
import { consumeRateLimit } from "../rateLimit";
import { publishPlatformUpdate } from "../realtime";
import { storageGetSignedUrl, storagePut } from "../storage";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { isBootstrapAdminAvailable } from "@shared/bootstrapAccess";

const permissionList = z.array(z.string().min(1).max(80)).max(40);

const defaultSettings = {
  privacy: { allowFriendRequests: true, showPresence: true },
  appearance: { theme: "dark", compactMode: false },
  notifications: { messages: true, mentions: true, calls: true, friends: true, announcements: true },
  voiceVideo: { inputDevice: "default", outputDevice: "default", cameraDevice: "default", echoCancellation: true },
  accessibility: { reduceMotion: false, highContrast: false, fontScale: 1 },
};

const roleDefinitions = [
  { name: "Administrador", color: "#C8A97E", position: 3, permissions: ["administrator"] },
  { name: "Moderador", color: "#8CA6DB", position: 2, permissions: ["manage_messages", "kick_members", "ban_members", "timeout_members", "share_screen"] },
  { name: "Membro", color: "#A8B1C3", position: 1, permissions: ["send_messages", "connect_voice", "share_screen"] },
] as const;

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

async function ensureProfile(db: Awaited<ReturnType<typeof requireDatabase>>, user: { id: number; name: string | null }) {
  const fallbackName = user.name?.trim().slice(0, 80) || `Usuário ${user.id}`;
  await db
    .insert(profiles)
    .values({ userId: user.id, username: `user-${user.id}`, displayName: fallbackName, presence: "offline" })
    .onDuplicateKeyUpdate({ set: { displayName: fallbackName } });
  await db
    .insert(userSettings)
    .values({ userId: user.id, ...defaultSettings })
    .onDuplicateKeyUpdate({ set: { userId: user.id } });
}

async function ensureMemberRole(db: Awaited<ReturnType<typeof requireDatabase>>, communityId: number, communityMemberId: number) {
  let [memberRole] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.communityId, communityId), eq(roles.isDefault, true)))
    .limit(1);
  if (!memberRole) {
    [memberRole] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.communityId, communityId), eq(roles.name, "Membro")))
      .limit(1);
  }
  if (!memberRole) return;
  const [assignment] = await db
    .select()
    .from(memberRoles)
    .where(and(eq(memberRoles.communityMemberId, communityMemberId), eq(memberRoles.roleId, memberRole.id)))
    .limit(1);
  if (!assignment) await db.insert(memberRoles).values({ communityMemberId, roleId: memberRole.id });
}

async function ensureCommunityMembership(
  db: Awaited<ReturnType<typeof requireDatabase>>,
  communityId: number,
  userId: number,
) {
  let [membership] = await db
    .select()
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);
  if (!membership) {
    const [created] = await db.insert(communityMembers).values({ communityId, userId }).$returningId();
    [membership] = await db.select().from(communityMembers).where(eq(communityMembers.id, created.id)).limit(1);
  }
  if (!membership) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível registrar a participação na comunidade." });
  await ensureMemberRole(db, communityId, membership.id);
  return membership;
}

async function ensureCommunityRoles(db: Awaited<ReturnType<typeof requireDatabase>>, communityId: number) {
  const existing = await db.select({ name: roles.name }).from(roles).where(eq(roles.communityId, communityId));
  const known = new Set(existing.map(role => role.name));
  for (const definition of roleDefinitions) {
    if (!known.has(definition.name)) {
      await db.insert(roles).values({ ...definition, communityId, isDefault: definition.name === "Membro", permissions: [...definition.permissions] });
    }
  }
}

async function assignAdministratorRole(db: Awaited<ReturnType<typeof requireDatabase>>, communityId: number, communityMemberId: number) {
  const [adminRole] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.communityId, communityId), eq(roles.name, "Administrador")))
    .limit(1);
  if (!adminRole) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cargo administrativo indisponível." });
  const [assignment] = await db
    .select()
    .from(memberRoles)
    .where(and(eq(memberRoles.communityMemberId, communityMemberId), eq(memberRoles.roleId, adminRole.id)))
    .limit(1);
  if (!assignment) await db.insert(memberRoles).values({ communityMemberId, roleId: adminRole.id });
}

function isValidBootstrapCode(expectedCode: string, submittedCode: string) {
  const expected = Buffer.from(expectedCode);
  const submitted = Buffer.from(submittedCode);
  return expected.length === submitted.length && timingSafeEqual(expected, submitted);
}

async function getMembership(db: Awaited<ReturnType<typeof requireDatabase>>, communityId: number, userId: number) {
  const [membership] = await db
    .select()
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.userId, userId)))
    .limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Você não participa desta comunidade." });
  return membership;
}

async function canManageCommunity(
  db: Awaited<ReturnType<typeof requireDatabase>>,
  communityId: number,
  userId: number,
  role: string,
  requiredPermission = "administrator",
) {
  const membership = await getMembership(db, communityId, userId);
  if (role === "admin") return membership;
  const assigned = await db
    .select({ permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(and(eq(memberRoles.communityMemberId, membership.id), eq(roles.communityId, communityId)));
  const allowed = hasPermission(assigned.map(item => item.permissions), requiredPermission);
  if (!allowed) throw new TRPCError({ code: "FORBIDDEN", message: "Você não possui permissão para esta ação." });
  return membership;
}

async function assertCanManageRolePosition(
  db: Awaited<ReturnType<typeof requireDatabase>>,
  communityId: number,
  userId: number,
  systemRole: string,
  targetPosition: number,
) {
  if (systemRole === "admin") return;
  const membership = await getMembership(db, communityId, userId);
  const assignments = await db
    .select({ position: roles.position })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(and(eq(memberRoles.communityMemberId, membership.id), eq(roles.communityId, communityId)));
  if (!canManageRole(assignments.map(item => item.position), targetPosition)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode administrar cargos abaixo do seu cargo mais alto." });
  }
}

export async function getChannelWithAccess(db: Awaited<ReturnType<typeof requireDatabase>>, channelId: number, userId: number, requiredPermission = "view_channel") {
  const [result] = await db
    .select({ channel: channels, membership: communityMembers })
    .from(channels)
    .innerJoin(communityMembers, eq(channels.communityId, communityMembers.communityId))
    .where(and(eq(channels.id, channelId), eq(communityMembers.userId, userId)))
    .limit(1);
  if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "Canal indisponível para este usuário." });
  if (requiredPermission !== "view_channel") {
    const [latestTimeout] = await db
      .select({ expiresAt: moderationActions.expiresAt })
      .from(moderationActions)
      .where(and(eq(moderationActions.communityId, result.channel.communityId), eq(moderationActions.targetUserId, userId), eq(moderationActions.type, "timeout")))
      .orderBy(desc(moderationActions.createdAt))
      .limit(1);
    if (latestTimeout && isTimeoutActive(latestTimeout.expiresAt)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Você está temporariamente impedido de interagir nesta comunidade." });
    }
  }
  const assigned = await db
    .select({ roleId: roles.id, permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(and(eq(memberRoles.communityMemberId, result.membership.id), eq(roles.communityId, result.channel.communityId)));
  const roleIds = assigned.map(item => item.roleId);
  const overrides = roleIds.length
    ? await db.select().from(channelRolePermissions).where(and(eq(channelRolePermissions.channelId, channelId), inArray(channelRolePermissions.roleId, roleIds)))
    : [];
  if (overrides.some(rule => (rule.deny ?? []).includes(requiredPermission) || (rule.deny ?? []).includes("administrator"))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "A permissão foi negada para este canal." });
  }
  const isAdministrator = hasPermission(assigned.map(item => item.permissions), "administrator");
  const explicitlyAllowed = overrides.some(rule => (rule.allow ?? []).includes(requiredPermission) || (rule.allow ?? []).includes("administrator"));
  if (requiredPermission === "view_channel") {
    if (result.channel.isPrivate && !isAdministrator && !explicitlyAllowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Você não possui acesso a este canal privado." });
    }
    return result;
  }
  const grantedByRole = hasPermission(assigned.map(item => item.permissions), requiredPermission);
  if (!isAdministrator && !explicitlyAllowed && !grantedByRole) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não possui permissão para esta ação neste canal." });
  }
  return result;
}

export const platformRouter = router({
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await ensureProfile(db, ctx.user);
      const [profile] = await db.select().from(profiles).where(eq(profiles.userId, ctx.user.id)).limit(1);
      const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
      return { profile, settings, user: ctx.user };
    }),
    update: protectedProcedure
      .input(z.object({ username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9._-]+$/).optional(), displayName: z.string().trim().min(1).max(80).optional(), bio: z.string().trim().max(500).nullable().optional(), presence: z.enum(["online", "idle", "dnd", "invisible", "offline"]).optional(), customStatus: z.string().trim().max(160).nullable().optional(), avatar: z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().regex(/^image\/(png|jpe?g|webp)$/), base64: z.string().regex(/^[A-Za-z0-9+/=]+$/).max(2_800_000) }).nullable().optional() }))
      .mutation(async ({ ctx, input }) => {
        requireApprovedUser(ctx.user);
        const db = await requireDatabase();
        await ensureProfile(db, ctx.user);
        const { avatar, ...updates } = input;
        let avatarKey: string | undefined;
        if (avatar) {
          const bytes = Buffer.from(avatar.base64, "base64");
          if (bytes.byteLength > 2 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O avatar pode ter no máximo 2 MB." });
          const extension = avatar.fileName.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "image";
          const stored = await storagePut(`avatars/${ctx.user.id}/${crypto.randomUUID()}.${extension}`, bytes, avatar.mimeType);
          avatarKey = stored.key;
        }
        await db.update(profiles).set({ ...updates, ...(avatarKey ? { avatarKey } : {}), presenceUpdatedAt: new Date() }).where(eq(profiles.userId, ctx.user.id));
        publishPlatformUpdate({ type: "community", userId: ctx.user.id });
        return { success: true };
      }),
  }),

  settings: router({
    update: protectedProcedure
      .input(z.object({ privacy: z.record(z.string(), z.boolean()).optional(), appearance: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(), notifications: z.record(z.string(), z.boolean()).optional(), voiceVideo: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(), accessibility: z.record(z.string(), z.union([z.boolean(), z.number()])).optional() }))
      .mutation(async ({ ctx, input }) => {
        requireApprovedUser(ctx.user);
        const db = await requireDatabase();
        await ensureProfile(db, ctx.user);
        const [existing] = await db.select().from(userSettings).where(eq(userSettings.userId, ctx.user.id)).limit(1);
        if (!existing) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Configurações indisponíveis." });
        await db.update(userSettings).set({
          privacy: { ...existing.privacy, ...input.privacy },
          appearance: { ...existing.appearance, ...input.appearance },
          notifications: { ...existing.notifications, ...input.notifications },
          voiceVideo: { ...existing.voiceVideo, ...input.voiceVideo },
          accessibility: { ...existing.accessibility, ...input.accessibility },
        }).where(eq(userSettings.userId, ctx.user.id));
        return { success: true };
      }),
  }),

  communities: router({
    bootstrapStatus: publicProcedure.query(async () => {
      const configuredCode = process.env.BOOTSTRAP_ADMIN_CODE;
      if (!configuredCode) return { available: false };
      const db = await requireDatabase();
      const [administrator] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
      return { available: isBootstrapAdminAvailable(true, Boolean(administrator)) };
    }),
    bootstrapAdmin: publicProcedure
      .input(z.object({ code: z.string().min(16).max(128), displayName: z.string().trim().min(2).max(80), communityName: z.string().trim().min(2).max(100).optional() }))
      .mutation(async ({ ctx, input }) => {
        const address = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        if (!consumeRateLimit(`bootstrap-admin:${address}`, 5, 60_000)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um momento." });
        }
        const configuredCode = process.env.BOOTSTRAP_ADMIN_CODE;
        if (!configuredCode || !isValidBootstrapCode(configuredCode, input.code)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Código inicial inválido ou indisponível." });
        }
        const db = await requireDatabase();
        const [existingAdministrator] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
        if (!isBootstrapAdminAvailable(true, Boolean(existingAdministrator))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "A inicialização administrativa já foi concluída." });
        }
        const openId = `bootstrap_${crypto.randomUUID().replaceAll("-", "")}`;
        const [created] = await db
          .insert(users)
          .values({ openId, name: input.displayName, loginMethod: "bootstrap", role: "admin", accessState: "approved", lastSignedIn: new Date() })
          .$returningId();
        const user = { id: created.id, name: input.displayName };
        await ensureProfile(db, user);
        let [community] = await db.select().from(communities).limit(1);
        if (!community) {
          const [createdCommunity] = await db
            .insert(communities)
            .values({ ownerUserId: user.id, name: input.communityName ?? "Círculo", description: "Comunidade privada" })
            .$returningId();
          [community] = await db.select().from(communities).where(eq(communities.id, createdCommunity.id)).limit(1);
        } else {
          await db.update(communities).set({ ownerUserId: user.id }).where(eq(communities.id, community.id));
        }
        if (!community) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível preparar a comunidade inicial." });
        await ensureCommunityRoles(db, community.id);
        const membership = await ensureCommunityMembership(db, community.id, user.id);
        await assignAdministratorRole(db, community.id, membership.id);
        await db.insert(auditLogs).values({ communityId: community.id, actorUserId: user.id, action: "bootstrap.admin_created", targetType: "user", targetId: String(user.id) });
        const sessionToken = await sdk.createSessionToken(openId, { name: input.displayName });
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
        publishPlatformUpdate({ type: "community", communityId: community.id, userId: user.id });
        return { communityId: community.id, displayName: input.displayName };
      }),
    enterWithInvite: publicProcedure
      .input(z.object({ code: z.string().trim().min(8).max(64), displayName: z.string().trim().min(2).max(80) }))
      .mutation(async ({ ctx, input }) => {
        const address = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        if (!consumeRateLimit(`guest-invite:${address}`, 8, 60_000)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas de convite. Aguarde um momento." });
        }
        const db = await requireDatabase();
        const [invite] = await db.select().from(communityInvites).where(eq(communityInvites.code, input.code)).limit(1);
        if (!invite || invite.revokedAt || (invite.expiresAt && invite.expiresAt < new Date()) || (invite.maxUses !== null && invite.uses >= invite.maxUses)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Convite inválido, expirado ou já utilizado." });
        }
        const openId = `invite_${crypto.randomUUID().replaceAll("-", "")}`;
        const [created] = await db
          .insert(users)
          .values({ openId, name: input.displayName, loginMethod: "invite", accessState: "approved", lastSignedIn: new Date() })
          .$returningId();
        const user = { id: created.id, name: input.displayName };
        await ensureProfile(db, user);
        await ensureCommunityMembership(db, invite.communityId, user.id);
        await db.update(communityInvites).set({ uses: invite.uses + 1 }).where(eq(communityInvites.id, invite.id));
        await db.insert(auditLogs).values({ communityId: invite.communityId, actorUserId: user.id, action: "invite.joined", targetType: "invite", targetId: String(invite.id) });
        const sessionToken = await sdk.createSessionToken(openId, { name: input.displayName });
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
        publishPlatformUpdate({ type: "community", communityId: invite.communityId, userId: user.id });
        return { communityId: invite.communityId, displayName: input.displayName };
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      return db
        .select({ community: communities, membership: communityMembers })
        .from(communityMembers)
        .innerJoin(communities, eq(communityMembers.communityId, communities.id))
        .where(eq(communityMembers.userId, ctx.user.id))
        .orderBy(desc(communities.updatedAt));
    }),
    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(1000).nullable().optional() }))
      .mutation(async ({ ctx, input }) => {
        requireApprovedUser(ctx.user);
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Somente administradores podem criar comunidades." });
        const db = await requireDatabase();
        const [community] = await db.insert(communities).values({ ownerUserId: ctx.user.id, name: input.name, description: input.description ?? null }).$returningId();
        const [member] = await db.insert(communityMembers).values({ communityId: community.id, userId: ctx.user.id }).$returningId();
        const createdRoles = await Promise.all(roleDefinitions.map(definition => db.insert(roles).values({ ...definition, communityId: community.id, isDefault: definition.name === "Membro", permissions: [...definition.permissions] }).$returningId()));
        const adminRoleId = createdRoles[0]?.[0]?.id;
        if (adminRoleId) await db.insert(memberRoles).values({ communityMemberId: member.id, roleId: adminRoleId });
        await db.insert(auditLogs).values({ communityId: community.id, actorUserId: ctx.user.id, action: "community.created", targetType: "community", targetId: String(community.id) });
        publishPlatformUpdate({ type: "community", communityId: community.id });
        return { communityId: community.id };
      }),
    update: protectedProcedure.input(z.object({ communityId: z.number().int().positive(), name: z.string().trim().min(2).max(100).optional(), description: z.string().trim().max(1000).nullable().optional(), icon: z.object({ fileName: z.string().min(1).max(255), mimeType: z.string().startsWith("image/"), base64: z.string().regex(/^[A-Za-z0-9+/=]+$/).max(3_000_000) }).optional(), banner: z.object({ fileName: z.string().min(1).max(255), mimeType: z.string().startsWith("image/"), base64: z.string().regex(/^[A-Za-z0-9+/=]+$/).max(7_000_000) }).optional() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await canManageCommunity(db, input.communityId, ctx.user.id, ctx.user.role, "manage_channels");
      const { communityId, icon, banner, ...details } = input;
      const updates: { name?: string; description?: string | null; iconKey?: string; bannerKey?: string } = details;
      if (icon) {
        const bytes = Buffer.from(icon.base64, "base64");
        if (bytes.byteLength > 2 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O ícone pode ter no máximo 2 MB." });
        const stored = await storagePut(`communities/${communityId}/icon-${Date.now()}-${icon.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`, bytes, icon.mimeType);
        updates.iconKey = stored.key;
      }
      if (banner) {
        const bytes = Buffer.from(banner.base64, "base64");
        if (bytes.byteLength > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O banner pode ter no máximo 5 MB." });
        const stored = await storagePut(`communities/${communityId}/banner-${Date.now()}-${banner.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`, bytes, banner.mimeType);
        updates.bannerKey = stored.key;
      }
      if (Object.keys(updates).length) await db.update(communities).set(updates).where(eq(communities.id, communityId));
      await db.insert(auditLogs).values({ communityId, actorUserId: ctx.user.id, action: "community.updated", targetType: "community", targetId: String(communityId) });
      publishPlatformUpdate({ type: "community", communityId });
      return { success: true };
    }),
    members: protectedProcedure.input(z.object({ communityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await getMembership(db, input.communityId, ctx.user.id);
      return db.select({ member: communityMembers, profile: profiles }).from(communityMembers).innerJoin(profiles, eq(communityMembers.userId, profiles.userId)).where(eq(communityMembers.communityId, input.communityId));
    }),
    channels: protectedProcedure.input(z.object({ communityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await getMembership(db, input.communityId, ctx.user.id);
      const categoryRows = await db.select().from(categories).where(eq(categories.communityId, input.communityId));
      const channelRows = await db.select().from(channels).where(eq(channels.communityId, input.communityId));
      const accessible = await Promise.all(channelRows.map(async channel => {
        try { await getChannelWithAccess(db, channel.id, ctx.user.id); return channel; } catch { return null; }
      }));
      return { categories: categoryRows.sort((a, b) => a.position - b.position), channels: accessible.filter((channel): channel is NonNullable<typeof channel> => Boolean(channel)).sort((a, b) => a.position - b.position) };
    }),
    createCategory: protectedProcedure.input(z.object({ communityId: z.number().int().positive(), name: z.string().trim().min(2).max(100) })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await canManageCommunity(db, input.communityId, ctx.user.id, ctx.user.role, "manage_channels");
      const [created] = await db.insert(categories).values({ communityId: input.communityId, name: input.name, position: 0 }).$returningId();
      await db.insert(auditLogs).values({ communityId: input.communityId, actorUserId: ctx.user.id, action: "category.created", targetType: "category", targetId: String(created.id) });
      publishPlatformUpdate({ type: "community", communityId: input.communityId });
      return { categoryId: created.id };
    }),
    createChannel: protectedProcedure
      .input(z.object({ communityId: z.number().int().positive(), categoryId: z.number().int().positive().nullable().optional(), type: z.enum(["text", "voice", "announcement"]), name: z.string().trim().min(2).max(100), topic: z.string().trim().max(1024).nullable().optional(), isPrivate: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        requireApprovedUser(ctx.user);
        const db = await requireDatabase();
        await canManageCommunity(db, input.communityId, ctx.user.id, ctx.user.role, "manage_channels");
        const [created] = await db.insert(channels).values({ ...input, categoryId: input.categoryId ?? null, topic: input.topic ?? null, createdByUserId: ctx.user.id, isPrivate: input.isPrivate ?? false, position: 0 }).$returningId();
        await db.insert(auditLogs).values({ communityId: input.communityId, actorUserId: ctx.user.id, action: "channel.created", targetType: "channel", targetId: String(created.id) });
        publishPlatformUpdate({ type: "community", communityId: input.communityId, channelId: created.id });
        return { channelId: created.id };
      }),
    createInvite: protectedProcedure
      .input(z.object({ communityId: z.number().int().positive(), maxUses: z.number().int().positive().max(15).nullable().optional(), expiresAt: z.date().nullable().optional() }))
      .mutation(async ({ ctx, input }) => {
        requireApprovedUser(ctx.user);
        if (!consumeRateLimit(`invite:${ctx.user.id}`, 10, 60_000)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Aguarde antes de gerar mais convites." });
        const db = await requireDatabase();
        await canManageCommunity(db, input.communityId, ctx.user.id, ctx.user.role, "manage_members");
        const code = crypto.randomUUID().replaceAll("-", "");
        const [invite] = await db.insert(communityInvites).values({ communityId: input.communityId, createdByUserId: ctx.user.id, code, maxUses: input.maxUses ?? null, expiresAt: input.expiresAt ?? null }).$returningId();
        return { inviteId: invite.id, code };
      }),
    redeemInvite: protectedProcedure.input(z.object({ code: z.string().trim().min(8).max(64) })).mutation(async ({ ctx, input }) => {
      if (!consumeRateLimit(`redeem:${ctx.user.id}`, 8, 60_000)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas de convite. Aguarde um momento." });
      const db = await requireDatabase();
      if (ctx.user.accessState === "suspended") throw new TRPCError({ code: "FORBIDDEN", message: "Seu acesso está suspenso." });
      const [invite] = await db.select().from(communityInvites).where(eq(communityInvites.code, input.code)).limit(1);
      if (!invite || invite.revokedAt || (invite.expiresAt && invite.expiresAt < new Date()) || (invite.maxUses !== null && invite.uses >= invite.maxUses)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Convite inválido ou indisponível." });
      }
      const [activeBan] = await db.select().from(moderationActions).where(and(eq(moderationActions.communityId, invite.communityId), eq(moderationActions.targetUserId, ctx.user.id), eq(moderationActions.type, "ban"))).limit(1);
      if (activeBan) throw new TRPCError({ code: "FORBIDDEN", message: "Seu acesso a esta comunidade foi bloqueado." });
      if (ctx.user.role !== "admin") await db.update(users).set({ accessState: "approved" }).where(eq(users.id, ctx.user.id));
      await ensureCommunityMembership(db, invite.communityId, ctx.user.id);
      await db.update(communityInvites).set({ uses: invite.uses + 1 }).where(eq(communityInvites.id, invite.id));
      publishPlatformUpdate({ type: "community", communityId: invite.communityId, userId: ctx.user.id });
      return { communityId: invite.communityId };
    }),
    setChannelPermission: protectedProcedure
      .input(z.object({ channelId: z.number().int().positive(), roleId: z.number().int().positive(), allow: permissionList, deny: permissionList }))
      .mutation(async ({ ctx, input }) => {
        requireApprovedUser(ctx.user);
        const db = await requireDatabase();
        const channel = await getChannelWithAccess(db, input.channelId, ctx.user.id);
        await canManageCommunity(db, channel.channel.communityId, ctx.user.id, ctx.user.role, "manage_channels");
        const [role] = await db.select().from(roles).where(and(eq(roles.id, input.roleId), eq(roles.communityId, channel.channel.communityId))).limit(1);
        if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Cargo não encontrado nesta comunidade." });
        await db.insert(channelRolePermissions).values(input).onDuplicateKeyUpdate({ set: { allow: input.allow, deny: input.deny } });
        return { success: true };
      }),
    roles: protectedProcedure.input(z.object({ communityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await getMembership(db, input.communityId, ctx.user.id);
      const communityRoles = await db.select().from(roles).where(eq(roles.communityId, input.communityId)).orderBy(desc(roles.position));
      const assignments = await db.select({ memberRole: memberRoles, member: communityMembers, profile: profiles }).from(memberRoles).innerJoin(communityMembers, eq(memberRoles.communityMemberId, communityMembers.id)).innerJoin(profiles, eq(communityMembers.userId, profiles.userId)).where(eq(communityMembers.communityId, input.communityId));
      return { roles: communityRoles, assignments };
    }),
    createRole: protectedProcedure.input(z.object({ communityId: z.number().int().positive(), name: z.string().trim().min(2).max(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), position: z.number().int().min(0).max(1000), permissions: permissionList })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await canManageCommunity(db, input.communityId, ctx.user.id, ctx.user.role, "manage_roles");
      await assertCanManageRolePosition(db, input.communityId, ctx.user.id, ctx.user.role, input.position);
      const [created] = await db.insert(roles).values(input).$returningId();
      await db.insert(auditLogs).values({ communityId: input.communityId, actorUserId: ctx.user.id, action: "role.created", targetType: "role", targetId: String(created.id) });
      publishPlatformUpdate({ type: "community", communityId: input.communityId });
      return { roleId: created.id };
    }),
    updateRole: protectedProcedure.input(z.object({ roleId: z.number().int().positive(), name: z.string().trim().min(2).max(80).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), position: z.number().int().min(0).max(1000).optional(), permissions: permissionList.optional() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [role] = await db.select().from(roles).where(eq(roles.id, input.roleId)).limit(1);
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Cargo não encontrado." });
      await canManageCommunity(db, role.communityId, ctx.user.id, ctx.user.role, "manage_roles");
      await assertCanManageRolePosition(db, role.communityId, ctx.user.id, ctx.user.role, input.position ?? role.position);
      const { roleId, ...updates } = input;
      await db.update(roles).set(updates).where(eq(roles.id, roleId));
      await db.insert(auditLogs).values({ communityId: role.communityId, actorUserId: ctx.user.id, action: "role.updated", targetType: "role", targetId: String(roleId) });
      publishPlatformUpdate({ type: "community", communityId: role.communityId });
      return { success: true };
    }),
    assignRole: protectedProcedure.input(z.object({ communityId: z.number().int().positive(), userId: z.number().int().positive(), roleId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await canManageCommunity(db, input.communityId, ctx.user.id, ctx.user.role, "manage_roles");
      const [member] = await db.select().from(communityMembers).where(and(eq(communityMembers.communityId, input.communityId), eq(communityMembers.userId, input.userId))).limit(1);
      const [role] = await db.select().from(roles).where(and(eq(roles.id, input.roleId), eq(roles.communityId, input.communityId))).limit(1);
      if (!member || !role) throw new TRPCError({ code: "NOT_FOUND", message: "Membro ou cargo não encontrado." });
      await assertCanManageRolePosition(db, input.communityId, ctx.user.id, ctx.user.role, role.position);
      await db.insert(memberRoles).values({ communityMemberId: member.id, roleId: role.id }).onDuplicateKeyUpdate({ set: { roleId: role.id } });
      await db.insert(auditLogs).values({ communityId: input.communityId, actorUserId: ctx.user.id, action: "role.assigned", targetType: "user", targetId: String(input.userId), details: { roleId: role.id } });
      publishPlatformUpdate({ type: "community", communityId: input.communityId, userId: input.userId });
      return { success: true };
    }),
    listInvites: protectedProcedure.input(z.object({ communityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await canManageCommunity(db, input.communityId, ctx.user.id, ctx.user.role, "manage_members");
      return db.select().from(communityInvites).where(eq(communityInvites.communityId, input.communityId)).orderBy(desc(communityInvites.createdAt));
    }),
    revokeInvite: protectedProcedure.input(z.object({ inviteId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [invite] = await db.select().from(communityInvites).where(eq(communityInvites.id, input.inviteId)).limit(1);
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Convite não encontrado." });
      await canManageCommunity(db, invite.communityId, ctx.user.id, ctx.user.role, "manage_members");
      await db.update(communityInvites).set({ revokedAt: new Date() }).where(eq(communityInvites.id, invite.id));
      await db.insert(auditLogs).values({ communityId: invite.communityId, actorUserId: ctx.user.id, action: "invite.revoked", targetType: "invite", targetId: String(invite.id) });
      return { success: true };
    }),
    auditLogs: protectedProcedure.input(z.object({ communityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await canManageCommunity(db, input.communityId, ctx.user.id, ctx.user.role, "manage_members");
      return db.select().from(auditLogs).where(eq(auditLogs.communityId, input.communityId)).orderBy(desc(auditLogs.createdAt)).limit(100);
    }),
  }),

  messages: router({
    list: protectedProcedure.input(z.object({ channelId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await getChannelWithAccess(db, input.channelId, ctx.user.id);
      const items = await db.select({ message: messages, profile: profiles }).from(messages).innerJoin(profiles, eq(messages.authorUserId, profiles.userId)).where(and(eq(messages.channelId, input.channelId), isNull(messages.deletedAt))).orderBy(desc(messages.createdAt)).limit(80);
      const ids = items.map(item => item.message.id);
      const reactions = ids.length ? await db.select().from(messageReactions).where(inArray(messageReactions.messageId, ids)) : [];
      const attached = ids.length ? await db.select().from(attachments).where(inArray(attachments.messageId, ids)) : [];
      return { items: items.reverse(), reactions, attachments: attached };
    }),
    send: protectedProcedure.input(z.object({ channelId: z.number().int().positive(), content: z.string().trim().max(4000).default(""), replyToMessageId: z.number().int().positive().nullable().optional(), files: z.array(z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().min(1).max(180), base64: z.string().regex(/^[A-Za-z0-9+/=]+$/).max(14_000_000) })).max(10).default([]) }).refine(input => Boolean(input.content) || input.files.length > 0, "Envie uma mensagem ou anexo.")).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      if (!consumeRateLimit(`channel-message:${ctx.user.id}`, 25, 60_000)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Você enviou mensagens demais. Aguarde um momento." });
      const db = await requireDatabase();
      const channel = await getChannelWithAccess(db, input.channelId, ctx.user.id, "send_messages");
      if (channel.channel.type === "voice") throw new TRPCError({ code: "BAD_REQUEST", message: "Canais de voz não recebem mensagens." });
      const [activeTimeout] = await db.select().from(moderationActions).where(and(eq(moderationActions.communityId, channel.channel.communityId), eq(moderationActions.targetUserId, ctx.user.id), eq(moderationActions.type, "timeout"))).orderBy(desc(moderationActions.createdAt)).limit(1);
      if (activeTimeout && isTimeoutActive(activeTimeout.expiresAt)) throw new TRPCError({ code: "FORBIDDEN", message: "Você está em timeout nesta comunidade." });
      const [created] = await db.insert(messages).values({ channelId: input.channelId, authorUserId: ctx.user.id, content: input.content, replyToMessageId: input.replyToMessageId ?? null }).$returningId();
      await Promise.all(input.files.map(async file => {
        const bytes = Buffer.from(file.base64, "base64");
        if (bytes.byteLength > 10 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Cada anexo pode ter no máximo 10 MB." });
        const sanitizedName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const stored = await storagePut(`messages/${ctx.user.id}/${created.id}/${sanitizedName}`, bytes, file.mimeType);
        await db.insert(attachments).values({ messageId: created.id, storageKey: stored.key, fileName: file.fileName, mimeType: file.mimeType, byteSize: bytes.byteLength });
      }));
      const participants = await db.select({ userId: communityMembers.userId }).from(communityMembers).where(eq(communityMembers.communityId, channel.channel.communityId));
      const everyoneMentioned = /(^|\s)@everyone\b/i.test(input.content);
      const usernames = Array.from(input.content.matchAll(/(^|\s)@([a-zA-Z0-9._-]+)/g)).map(match => match[2]?.toLowerCase()).filter((name): name is string => Boolean(name && name !== "everyone"));
      const roleNames = Array.from(input.content.matchAll(/@cargo:([a-zA-Z0-9._-]+)/gi)).map(match => match[1]?.replaceAll("-", " ").toLowerCase()).filter((name): name is string => Boolean(name));
      const directlyMentioned = usernames.length
        ? await db.select({ userId: profiles.userId }).from(profiles).where(inArray(profiles.username, usernames))
        : [];
      const matchingRoles = roleNames.length
        ? await db.select({ id: roles.id }).from(roles).where(and(eq(roles.communityId, channel.channel.communityId), inArray(roles.name, roleNames)))
        : [];
      const roleMentioned = matchingRoles.length
        ? await db.select({ userId: communityMembers.userId }).from(memberRoles).innerJoin(communityMembers, eq(memberRoles.communityMemberId, communityMembers.id)).where(inArray(memberRoles.roleId, matchingRoles.map(role => role.id)))
        : [];
      const mentionedUserIds = new Set([...directlyMentioned, ...roleMentioned].map(item => item.userId));
      const recipients = everyoneMentioned
        ? participants.map(participant => participant.userId)
        : mentionedUserIds.size ? Array.from(mentionedUserIds) : participants.map(participant => participant.userId);
      await Promise.all(recipients.filter(userId => userId !== ctx.user.id).map(userId => db.insert(notifications).values({ userId, type: everyoneMentioned || mentionedUserIds.has(userId) ? "mention" : "message", payload: { channelId: input.channelId, messageId: created.id } })));
      publishPlatformUpdate({ type: "channel", channelId: input.channelId, communityId: channel.channel.communityId });
      return { messageId: created.id };
    }),
    downloadAttachment: protectedProcedure.input(z.object({ storageKey: z.string().trim().min(1).max(512) })).query(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [channelAttachment] = await db
        .select({ storageKey: attachments.storageKey, fileName: attachments.fileName, channelId: messages.channelId })
        .from(attachments)
        .innerJoin(messages, eq(attachments.messageId, messages.id))
        .where(eq(attachments.storageKey, input.storageKey))
        .limit(1);
      if (channelAttachment) {
        await getChannelWithAccess(db, channelAttachment.channelId, ctx.user.id);
        return { fileName: channelAttachment.fileName, url: await storageGetSignedUrl(channelAttachment.storageKey) };
      }
      const [directAttachment] = await db
        .select({ storageKey: directAttachments.storageKey, fileName: directAttachments.fileName, conversationId: directMessages.conversationId })
        .from(directAttachments)
        .innerJoin(directMessages, eq(directAttachments.directMessageId, directMessages.id))
        .where(eq(directAttachments.storageKey, input.storageKey))
        .limit(1);
      if (!directAttachment) throw new TRPCError({ code: "NOT_FOUND", message: "Anexo não encontrado." });
      const [membership] = await db.select({ id: directConversationMembers.id }).from(directConversationMembers).where(and(eq(directConversationMembers.conversationId, directAttachment.conversationId), eq(directConversationMembers.userId, ctx.user.id))).limit(1);
      if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Anexo indisponível para este usuário." });
      return { fileName: directAttachment.fileName, url: await storageGetSignedUrl(directAttachment.storageKey) };
    }),
    update: protectedProcedure.input(z.object({ messageId: z.number().int().positive(), content: z.string().trim().min(1).max(4000) })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [message] = await db.select().from(messages).where(eq(messages.id, input.messageId)).limit(1);
      if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      const channel = await getChannelWithAccess(db, message.channelId, ctx.user.id);
      if (message.authorUserId !== ctx.user.id) await canManageCommunity(db, channel.channel.communityId, ctx.user.id, ctx.user.role, "manage_messages");
      await db.update(messages).set({ content: input.content, editedAt: new Date() }).where(eq(messages.id, input.messageId));
      publishPlatformUpdate({ type: "channel", channelId: message.channelId });
      return { success: true };
    }),
    pin: protectedProcedure.input(z.object({ messageId: z.number().int().positive(), pinned: z.boolean() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [message] = await db.select().from(messages).where(eq(messages.id, input.messageId)).limit(1);
      if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      const channel = await getChannelWithAccess(db, message.channelId, ctx.user.id);
      await canManageCommunity(db, channel.channel.communityId, ctx.user.id, ctx.user.role, "manage_messages");
      await db.update(messages).set({ isPinned: input.pinned }).where(eq(messages.id, input.messageId));
      await db.insert(auditLogs).values({ communityId: channel.channel.communityId, actorUserId: ctx.user.id, action: input.pinned ? "message.pinned" : "message.unpinned", targetType: "message", targetId: String(input.messageId) });
      publishPlatformUpdate({ type: "channel", channelId: message.channelId });
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ messageId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [message] = await db.select().from(messages).where(eq(messages.id, input.messageId)).limit(1);
      if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      const channel = await getChannelWithAccess(db, message.channelId, ctx.user.id);
      if (message.authorUserId !== ctx.user.id) await canManageCommunity(db, channel.channel.communityId, ctx.user.id, ctx.user.role, "manage_messages");
      await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, input.messageId));
      await db.insert(auditLogs).values({ communityId: channel.channel.communityId, actorUserId: ctx.user.id, action: "message.deleted", targetType: "message", targetId: String(input.messageId) });
      publishPlatformUpdate({ type: "channel", channelId: message.channelId });
      return { success: true };
    }),
    react: protectedProcedure.input(z.object({ messageId: z.number().int().positive(), emoji: z.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      const [message] = await db.select().from(messages).where(eq(messages.id, input.messageId)).limit(1);
      if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada." });
      await getChannelWithAccess(db, message.channelId, ctx.user.id, "add_reactions");
      await db.insert(messageReactions).values({ ...input, userId: ctx.user.id }).onDuplicateKeyUpdate({ set: { emoji: input.emoji } });
      publishPlatformUpdate({ type: "channel", channelId: message.channelId });
      return { success: true };
    }),
    markRead: protectedProcedure.input(z.object({ channelId: z.number().int().positive(), lastReadMessageId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
      requireApprovedUser(ctx.user);
      const db = await requireDatabase();
      await getChannelWithAccess(db, input.channelId, ctx.user.id);
      await db.insert(messageReads).values({ ...input, userId: ctx.user.id }).onDuplicateKeyUpdate({ set: { lastReadMessageId: input.lastReadMessageId } });
      return { success: true };
    }),
  }),
});
