import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const home = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Home.tsx"), "utf8");
const social = readFileSync(resolve(import.meta.dirname, "routers/social.ts"), "utf8");

describe("navegação e presença durante chamadas", () => {
  it("minimiza a chamada ao navegar para outro canal sem desmontar a sessão", () => {
    expect(home).toContain("if (call && channelId !== call.channelId) setCallMinimized(true)");
    expect(home).toContain('call && !callMinimized && "call-active"');
  });

  it("filtra presença persistida pela lista de participantes ativos do LiveKit", () => {
    expect(social).toContain("RoomServiceClient");
    expect(social).toContain("roomService.listParticipants(call.providerRoomName)");
    expect(social).toContain("liveParticipants.get(participant.callId)?.has(String(participant.userId))");
    expect(social).toContain("if (liveParticipants && !connectedParticipants.length) return null");
  });
});
