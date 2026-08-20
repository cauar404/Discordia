import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { auditLogs, communities, communityInvites, communityMembers } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  publishPlatformUpdate: vi.fn(),
  consumeRateLimit: vi.fn(() => true),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./realtime", () => ({ publishPlatformUpdate: mocks.publishPlatformUpdate }));
vi.mock("./rateLimit", () => ({ consumeRateLimit: mocks.consumeRateLimit }));

type InsertRecord = { table: unknown; values: unknown };
type DeleteRecord = { table: unknown };

function createDb(selectResults: unknown[][]) {
  const inserts: InsertRecord[] = [];
  const deletes: DeleteRecord[] = [];
  const db = {
    select: vi.fn(() => {
      const result = selectResults.shift() ?? [];
      let joined = false;
      const query = {
        from: vi.fn(() => query),
        innerJoin: vi.fn(() => { joined = true; return query; }),
        where: vi.fn(() => joined ? Promise.resolve(result) : query),
        limit: vi.fn(() => Promise.resolve(result)),
      };
      return query;
    }),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        inserts.push({ table, values });
        if (table === communityInvites) return { $returningId: vi.fn().mockResolvedValue([{ id: 91 }]) };
        return Promise.resolve(undefined);
      }),
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(() => { deletes.push({ table }); return Promise.resolve(undefined); }),
    })),
  };
  return { db, inserts, deletes };
}

function createContext(id: number, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id,
      openId: `user-${id}`,
      email: `user-${id}@example.com`,
      name: `Usuário ${id}`,
      loginMethod: "password",
      role,
      accessState: "approved",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("platform.communities - gestão pelo criador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockReturnValue(true);
  });

  it("permite que o criador exclua sua própria comunidade", async () => {
    const { db, inserts, deletes } = createDb([[{ id: 7, ownerUserId: 10 }]]);
    mocks.getDb.mockResolvedValue(db);

    await expect(appRouter.createCaller(createContext(10)).platform.communities.deleteCommunity({ communityId: 7 })).resolves.toEqual({ success: true });

    expect(inserts).toContainEqual(expect.objectContaining({ table: auditLogs, values: expect.objectContaining({ action: "community.deleted", actorUserId: 10 }) }));
    expect(deletes).toContainEqual({ table: communities });
    expect(mocks.publishPlatformUpdate).toHaveBeenCalledWith({ type: "community", communityId: 7 });
  });

  it("recusa a exclusão por quem não criou a comunidade", async () => {
    const { db, deletes } = createDb([[{ id: 7, ownerUserId: 10 }]]);
    mocks.getDb.mockResolvedValue(db);

    await expect(appRouter.createCaller(createContext(11)).platform.communities.deleteCommunity({ communityId: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(deletes).toHaveLength(0);
  });

  it("permite que o criador remova outro membro e registra a auditoria", async () => {
    const { db, inserts, deletes } = createDb([[{ id: 7, ownerUserId: 10 }], [{ id: 55 }]]);
    mocks.getDb.mockResolvedValue(db);

    await expect(appRouter.createCaller(createContext(10)).platform.communities.removeMember({ communityId: 7, userId: 20 })).resolves.toEqual({ success: true });

    expect(deletes).toContainEqual({ table: communityMembers });
    expect(inserts).toContainEqual(expect.objectContaining({ table: auditLogs, values: expect.objectContaining({ action: "member.removed", targetId: "20" }) }));
    expect(mocks.publishPlatformUpdate).toHaveBeenCalledWith({ type: "community", communityId: 7, userId: 20 });
  });

  it("impede que um membro remova a si mesmo", async () => {
    const { db, deletes } = createDb([]);
    mocks.getDb.mockResolvedValue(db);

    await expect(appRouter.createCaller(createContext(20)).platform.communities.removeMember({ communityId: 7, userId: 20 })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(deletes).toHaveLength(0);
  });

  it("cria convite sem expiração ou limite de usos para quem pode gerir membros", async () => {
    const { db, inserts } = createDb([[{ id: 55 }], [{ permissions: ["manage_members"] }]]);
    mocks.getDb.mockResolvedValue(db);

    const result = await appRouter.createCaller(createContext(10)).platform.communities.createPermanentInvite({ communityId: 7 });

    expect(result).toMatchObject({ inviteId: 91 });
    expect(result.code).toMatch(/^[a-f0-9]{32}$/);
    expect(inserts).toContainEqual(expect.objectContaining({ table: communityInvites, values: expect.objectContaining({ communityId: 7, createdByUserId: 10, maxUses: null, expiresAt: null }) }));
  });
});
