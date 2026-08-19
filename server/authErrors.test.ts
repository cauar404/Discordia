import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { rethrowSafeAuthError } from "./authErrors";

describe("erros públicos de autenticação", () => {
  it("oculta consultas, parâmetros e credenciais presentes em uma falha interna", () => {
    const internalError = new Error("Failed query: insert into users values (scrypt$segredo, senha-visivel)");
    try {
      rethrowSafeAuthError(internalError, "Não foi possível criar sua conta agora. Tente novamente em instantes.");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).message).toBe("Não foi possível criar sua conta agora. Tente novamente em instantes.");
      expect((error as TRPCError).message).not.toContain("scrypt$");
      expect((error as TRPCError).message).not.toContain("Failed query");
    }
  });

  it("preserva as mensagens públicas e intencionais", () => {
    const expected = new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este e-mail." });
    expect(() => rethrowSafeAuthError(expected, "Mensagem alternativa")).toThrow(expected);
  });
});
