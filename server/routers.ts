import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { consumeRateLimit } from "./rateLimit";
import { hashPassword, verifyPassword } from "./localAuth";
import { rethrowSafeAuthError } from "./authErrors";
import { ensureProfile, platformRouter } from "./routers/platform";
import { sdk } from "./_core/sdk";
import { socialRouter } from "./routers/social";

const accountInput = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(10, "A senha precisa ter ao menos 10 caracteres.").max(128),
});

function assertAccountRateLimit(ctx: { req: { ip?: string; socket: { remoteAddress?: string } } }, action: string) {
  const address = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
  if (!consumeRateLimit(`account:${action}:${address}`, 12, 60_000)) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um minuto." });
  }
}

async function createLocalSession(ctx: { req: Parameters<typeof getSessionCookieOptions>[0]; res: { cookie: (name: string, value: string, options: object) => void } }, openId: string, name: string) {
  const sessionToken = await sdk.createSessionToken(openId, { name });
  ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure
      .input(accountInput.extend({ displayName: z.string().trim().min(2).max(80) }))
      .mutation(async ({ ctx, input }) => {
        assertAccountRateLimit(ctx, "register");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível. Verifique a configuração do serviço." });
        try {
          const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
          if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este e-mail." });
          const openId = `local_${crypto.randomUUID().replaceAll("-", "")}`;
          const passwordHash = await hashPassword(input.password);
          const [created] = await db
            .insert(users)
            .values({ openId, name: input.displayName, email: input.email, passwordHash, loginMethod: "password", role: "user", accessState: "approved", lastSignedIn: new Date() })
            .$returningId();
          await ensureProfile(db, { id: created.id, name: input.displayName });
          await createLocalSession(ctx, openId, input.displayName);
          return { success: true } as const;
        } catch (error) {
          return rethrowSafeAuthError(error, "Não foi possível criar sua conta agora. Tente novamente em instantes.");
        }
      }),
    login: publicProcedure
      .input(accountInput)
      .mutation(async ({ ctx, input }) => {
        assertAccountRateLimit(ctx, "login");
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível. Verifique a configuração do serviço." });
        try {
          const [account] = await db.select().from(users).where(and(eq(users.email, input.email), eq(users.loginMethod, "password"))).limit(1);
          if (!account || !(await verifyPassword(input.password, account.passwordHash))) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
          }
          if (account.accessState === "suspended") throw new TRPCError({ code: "FORBIDDEN", message: "Esta conta está suspensa." });
          await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, account.id));
          await ensureProfile(db, { id: account.id, name: account.name });
          await createLocalSession(ctx, account.openId, account.name ?? "Membro");
          return { success: true } as const;
        } catch (error) {
          return rethrowSafeAuthError(error, "Não foi possível entrar agora. Tente novamente em instantes.");
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  platform: platformRouter,
  social: socialRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
