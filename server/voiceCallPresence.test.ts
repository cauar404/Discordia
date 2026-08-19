import { describe, expect, it } from "vitest";
import { groupVoiceCallPresence } from "../shared/voiceCallPresence";

describe("presença nos canais de voz", () => {
  it("mostra cada participante apenas sob o canal da chamada que está ativa", () => {
    const result = groupVoiceCallPresence(
      [{ id: 10, channelId: 100 }, { id: 11, channelId: 101 }],
      [{ callId: 10, userId: 1, displayName: "Ana", avatarKey: null }, { callId: 11, userId: 2, displayName: "Bia", avatarKey: "avatars/bia.png" }],
    );
    expect(result).toEqual([
      { channelId: 100, participants: [{ userId: 1, displayName: "Ana", avatarKey: null }] },
      { channelId: 101, participants: [{ userId: 2, displayName: "Bia", avatarKey: "avatars/bia.png" }] },
    ]);
  });

  it("não cria presença para chamadas sem participantes ou sem canal de voz", () => {
    expect(groupVoiceCallPresence([{ id: 10, channelId: 100 }, { id: 11, channelId: null }], [])).toEqual([]);
  });
});
