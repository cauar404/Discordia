import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMOTE_CALL_VOLUME,
  getScreenShareAudioOptions,
  normalizeRemoteCallVolume,
  remoteCallVolumeLabel,
} from "@shared/callAudio";

describe("controles de áudio da chamada", () => {
  it("mantém o volume remoto dentro da faixa aceita pelo LiveKit", () => {
    expect(normalizeRemoteCallVolume(-0.4)).toBe(0);
    expect(normalizeRemoteCallVolume(0.42)).toBe(0.42);
    expect(normalizeRemoteCallVolume(2)).toBe(1);
    expect(normalizeRemoteCallVolume("inválido")).toBe(DEFAULT_REMOTE_CALL_VOLUME);
    expect(remoteCallVolumeLabel(0.735)).toBe("74%");
  });

  it("solicita áudio de sistema somente quando a pessoa o habilita", () => {
    expect(getScreenShareAudioOptions(true)).toEqual({
      audio: {
        channelCount: 2,
        sampleRate: 48_000,
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
        restrictOwnAudio: true,
      },
      systemAudio: "include",
      suppressLocalAudioPlayback: false,
    });
    expect(getScreenShareAudioOptions(false)).toEqual({
      audio: false,
      systemAudio: "exclude",
      suppressLocalAudioPlayback: false,
    });
  });
});
