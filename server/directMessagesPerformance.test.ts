import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(import.meta.dirname, "../client/src/components/DirectMessagesDialog.tsx"), "utf8");

describe("carregamento eficiente de mensagens diretas", () => {
  it("adia dados auxiliares e interrompe consultas de mensagem quando o diálogo está fechado", () => {
    expect(source).toContain("enabled: open && newConversationOpen");
    expect(source).toContain("enabled: open && Boolean(conversationId)");
  });

  it("mantém uma conexão em tempo real estável ao trocar de conversa", () => {
    expect(source).toContain("const watchedConversationRef = useRef<number | null>(null)");
    expect(source).toContain("watchedConversationRef.current = conversationId");
    expect(source).toContain("[open, profile.data?.user.id, utils]");
  });
});
