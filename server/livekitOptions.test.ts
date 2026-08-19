import { describe, expect, it } from "vitest";
import { DefaultReconnectPolicy } from "livekit-client";
import { livekitReconnectDelaysMs, livekitRoomOptions } from "../client/src/lib/livekitOptions";

describe("opções de mídia da sala LiveKit", () => {
  it("ativa adaptação para reduzir trabalho de vídeo desnecessário", () => {
    expect(livekitRoomOptions.adaptiveStream).toBe(true);
    expect(livekitRoomOptions.dynacast).toBe(true);
    expect(livekitRoomOptions.publishDefaults).toMatchObject({
      dtx: true,
      red: true,
      simulcast: true,
      forceStereo: false,
    });
  });

  it("prioriza uma captura de voz limpa quando suportada pelo navegador", () => {
    expect(livekitRoomOptions.audioCaptureDefaults).toMatchObject({
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
      voiceIsolation: true,
      channelCount: 1,
    });
  });

  it("retoma a chamada rapidamente após uma oscilação temporária de rede", () => {
    expect(livekitReconnectDelaysMs).toEqual([0, 300, 1200, 2700, 4800, 7000, 7000]);
    expect(livekitRoomOptions.reconnectPolicy).toBeInstanceOf(DefaultReconnectPolicy);
  });
});
