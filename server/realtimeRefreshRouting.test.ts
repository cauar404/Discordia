import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const realtimeSource = readFileSync(resolve(projectRoot, "server/realtime.ts"), "utf8");
const platformSource = readFileSync(resolve(projectRoot, "server/routers/platform.ts"), "utf8");
const homeSource = readFileSync(resolve(projectRoot, "client/src/pages/Home.tsx"), "utf8");
const directsSource = readFileSync(resolve(projectRoot, "client/src/components/DirectMessagesDialog.tsx"), "utf8");

describe("atualizações em tempo real direcionadas", () => {
  it("identifica separadamente eventos de estrutura de canal e mensagens", () => {
    expect(realtimeSource).toContain('resource?: "channel" | "message"');
    expect(platformSource).toContain('resource: "channel"');
    expect(platformSource).toContain('resource: "message"');
  });

  it("invalida apenas os dados associados ao evento recebido", () => {
    expect(homeSource).toContain('event.resource === "message" && event.channelId === channelId');
    expect(homeSource).toContain('event.type === "call"');
    expect(directsSource).toContain('event.type === "direct" && event.id === watchedConversationRef.current');
    expect(directsSource).toContain("utils.social.directs.messages.invalidate()");
  });
});
