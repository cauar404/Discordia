import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./localAuth";

describe("credenciais locais", () => {
  it("gera um hash verificável sem expor a senha", async () => {
    const password = "Senha-local-segura-2026";
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it("rejeita senha incorreta e hash malformado", async () => {
    const hash = await hashPassword("Senha-local-segura-2026");
    await expect(verifyPassword("Outra-senha-segura", hash)).resolves.toBe(false);
    await expect(verifyPassword("Senha-local-segura-2026", "invalido")).resolves.toBe(false);
  });
});
