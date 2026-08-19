import { describe, expect, it } from "vitest";
import { canManageRole, hasPermission, isApprovedAccess, isTimeoutActive } from "./policies";

describe("políticas de acesso do Círculo", () => {
  it("permite administradores e membros aprovados, mas bloqueia solicitações pendentes", () => {
    expect(isApprovedAccess({ role: "admin", accessState: "pending" })).toBe(true);
    expect(isApprovedAccess({ role: "user", accessState: "approved" })).toBe(true);
    expect(isApprovedAccess({ role: "user", accessState: "pending" })).toBe(false);
  });

  it("respeita permissões específicas e o cargo administrador", () => {
    expect(hasPermission([["manage_messages"]], "manage_messages")).toBe(true);
    expect(hasPermission([["administrator"]], "ban_members")).toBe(true);
    expect(hasPermission([["send_messages"]], "ban_members")).toBe(false);
  });

  it("considera timeout sem expiração ou futuro como ativo", () => {
    const now = new Date("2026-08-18T21:00:00.000Z");
    expect(isTimeoutActive(null, now)).toBe(true);
    expect(isTimeoutActive(new Date("2026-08-18T21:01:00.000Z"), now)).toBe(true);
    expect(isTimeoutActive(new Date("2026-08-18T20:59:00.000Z"), now)).toBe(false);
  });

  it("exige que um cargo esteja acima do cargo que será administrado", () => {
    expect(canManageRole([3], 2)).toBe(true);
    expect(canManageRole([2], 2)).toBe(false);
    expect(canManageRole([2], 3)).toBe(false);
    expect(canManageRole([], 1)).toBe(false);
    expect(canManageRole([], 99, true)).toBe(true);
  });
});
