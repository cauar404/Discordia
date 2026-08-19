import { describe, expect, it } from "vitest";
import { audioMixKey, deserializeIndividualAudioMixes, normalizeIndividualAudioMix, serializeIndividualAudioMixes, updateIndividualAudioMix } from "@shared/callMixer";

describe("mistura de áudio individual", () => {
  it("limita o volume de cada trilha à faixa reproduzível e preserva o silenciamento local", () => {
    expect(normalizeIndividualAudioMix({ volume: 1.4, muted: true })).toEqual({ volume: 1, muted: true });
    expect(normalizeIndividualAudioMix({ volume: -0.3 })).toEqual({ volume: 0, muted: false });
    expect(normalizeIndividualAudioMix()).toEqual({ volume: 1, muted: false });
  });

  it("mantém escolhas de volume separadas por pessoa e por tipo de trilha", () => {
    const voice = audioMixKey("ana", "microphone", "TR_voice");
    const stream = audioMixKey("ana", "screen_share_audio", "TR_screen");
    const afterVoice = updateIndividualAudioMix({}, voice, { volume: 0.35 });
    const afterStream = updateIndividualAudioMix(afterVoice, stream, { muted: true });

    expect(afterStream[voice]).toEqual({ volume: 0.35, muted: false });
    expect(afterStream[stream]).toEqual({ volume: 1, muted: true });
  });

  it("restaura preferências locais normalizadas após serializar a mistura", () => {
    const voice = audioMixKey("bia", "microphone", "TR_voice");
    const screenAudio = audioMixKey("bia", "screen_share_audio", "TR_screen");
    const stored = serializeIndividualAudioMixes({
      [voice]: { volume: 0.44, muted: false },
      [screenAudio]: { volume: 0.87, muted: true },
    });

    expect(deserializeIndividualAudioMixes(stored)).toEqual({
      [voice]: { volume: 0.44, muted: false },
      [screenAudio]: { volume: 0.87, muted: true },
    });
    expect(deserializeIndividualAudioMixes("not-json")).toEqual({});
  });
});
