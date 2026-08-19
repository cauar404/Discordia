import { screenShareProfiles } from "../shared/callQuality";
import { describe, expect, it } from "vitest";

describe("perfis de compartilhamento de tela", () => {
  it("oferece um perfil 540p estável para priorizar continuidade em redes com menor banda", () => {
    expect(screenShareProfiles["540p30"].resolution).toEqual({ width: 960, height: 540, frameRate: 30 });
    expect(screenShareProfiles["540p30"].encoding).toEqual({ maxBitrate: 1_200_000, maxFramerate: 30 });
  });

  it("oferece um perfil 720p equilibrado para reduzir travamentos em redes variáveis", () => {
    expect(screenShareProfiles["720p30"].resolution).toEqual({ width: 1280, height: 720, frameRate: 30 });
    expect(screenShareProfiles["720p30"].encoding).toEqual({ maxBitrate: 2_000_000, maxFramerate: 30 });
  });

  it("oferece 1080p equilibrado com taxa menor para preservar estabilidade", () => {
    expect(screenShareProfiles["1080p30"].resolution).toEqual({ width: 1920, height: 1080, frameRate: 30 });
    expect(screenShareProfiles["1080p30"].encoding).toEqual({ maxBitrate: 4_000_000, maxFramerate: 30 });
  });

  it("configura 720p a 60 fps para captura e publicação", () => {
    expect(screenShareProfiles["720p60"].resolution).toEqual({ width: 1280, height: 720, frameRate: 60 });
    expect(screenShareProfiles["720p60"].encoding).toEqual({ maxBitrate: 4_000_000, maxFramerate: 60 });
  });

  it("configura 1080p a 60 fps para captura e publicação", () => {
    expect(screenShareProfiles["1080p60"].resolution).toEqual({ width: 1920, height: 1080, frameRate: 60 });
    expect(screenShareProfiles["1080p60"].encoding).toEqual({ maxBitrate: 8_000_000, maxFramerate: 60 });
  });

  it("prioriza a fluidez da tela ao faltar largura de banda", async () => {
    const { getScreenSharePublishOptions } = await import("@shared/callQuality");
    expect(getScreenSharePublishOptions("1080p60")).toEqual({
      screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
      simulcast: true,
      degradationPreference: "maintain-framerate",
    });
  });
});
