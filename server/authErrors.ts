import { TRPCError } from "@trpc/server";

/** Preserva erros públicos esperados e substitui qualquer erro interno por uma mensagem segura. */
export function rethrowSafeAuthError(error: unknown, fallbackMessage: string): never {
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fallbackMessage });
}
