import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "routers/social.ts"), "utf8");

describe("consulta de perfil social", () => {
  it("busca somente as amizades dos dois perfis para calcular amigos em comum", () => {
    expect(source).toContain("myAcceptedFriendships, theirAcceptedFriendships");
    expect(source).toContain('eq(friendships.status, "accepted"), or(eq(friendships.requesterUserId, ctx.user.id)');
    expect(source).toContain('eq(friendships.status, "accepted"), or(eq(friendships.requesterUserId, input.userId)');
    expect(source).not.toContain('db.select().from(friendships).where(eq(friendships.status, "accepted"))');
  });
});
