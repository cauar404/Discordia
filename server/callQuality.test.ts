import { screenShareProfiles } from "../shared/callQuality";
import { describe, expect, it } from "vitest";

describe("perfis de compartilhamento de tela", () => {
  it("oferece um perfil 540p estável com bitrate suficiente para texto e movimento leves", () => {
    expect(screenShareProfiles["540p30"].resolution).toEqual({ width: 960, height: 540, frameRate: 30 });
    expect(screenShareProfiles["540p30"].encoding).toEqual({ maxBitrate: 1_600_000, maxFramerate: 30 });
  });

  it("oferece um perfil 720p equilibrado com mais margem visual", () => {
    expect(screenShareProfiles["720p30"].resolution).toEqual({ width: 1280, height: 720, frameRate: 30 });
    expect(screenShareProfiles["720p30"].encoding).toEqual({ maxBitrate: 3_400_000, maxFramerate: 30 });
  });

  it("oferece 1080p equilibrado com bitrate alto para preservar detalhes", () => {
    expect(screenShareProfiles["1080p30"].resolution).toEqual({ width: 1920, height: 1080, frameRate: 30 });
    expect(screenShareProfiles["1080p30"].encoding).toEqual({ maxBitrate: 6_500_000, maxFramerate: 30 });
  });

  it("configura 720p a 60 fps para captura e publicação", () => {
    expect(screenShareProfiles["720p60"].resolution).toEqual({ width: 1280, height: 720, frameRate: 60 });
    expect(screenShareProfiles["720p60"].encoding).toEqual({ maxBitrate: 6_000_000, maxFramerate: 60 });
  });

  it("configura 1080p a 60 fps para captura e publicação", () => {
    expect(screenShareProfiles["1080p60"].resolution).toEqual({ width: 1920, height: 1080, frameRate: 60 });
    expect(screenShareProfiles["1080p60"].encoding).toEqual({ maxBitrate: 10_000_000, maxFramerate: 60 });
  });

  it("prioriza a fluidez da tela e disponibiliza camadas escaláveis ao faltar largura de banda", async () => {
    const { getScreenSharePublishOptions } = await import("@shared/callQuality");
    const options = getScreenSharePublishOptions("1080p60");
    expect(options.screenShareEncoding).toEqual({ maxBitrate: 10_000_000, maxFramerate: 60 });
    expect(options.screenShareSimulcastLayers).toHaveLength(3);
    expect(options.screenShareSimulcastLayers[1]).toMatchObject({ width: 1280, height: 720, encoding: { maxBitrate: 5_500_000, maxFramerate: 60 } });
    expect(options.screenShareSimulcastLayers[2]).toMatchObject({ width: 1920, height: 1080, encoding: { maxBitrate: 10_000_000, maxFramerate: 60 } });
    expect(options.simulcast).toBe(true);
    expect(options.degradationPreference).toBe("maintain-framerate");
  });

  it("preserva resolução nos perfis de 30 fps para manter texto e interfaces legíveis", async () => {
    const { getScreenSharePublishOptions } = await import("@shared/callQuality");
    expect(getScreenSharePublishOptions("720p30").degradationPreference).toBe("maintain-resolution");
    expect(getScreenSharePublishOptions("1080p30").degradationPreference).toBe("maintain-resolution");
  });

  it("mantém uma camada superior correspondente à resolução capturada em todos os perfis", () => {
    expect(screenShareProfiles["540p30"].simulcastLayers.at(-1)).toMatchObject({ width: 960, height: 540 });
    expect(screenShareProfiles["720p30"].simulcastLayers.at(-1)).toMatchObject({ width: 1280, height: 720 });
    expect(screenShareProfiles["1080p30"].simulcastLayers.at(-1)).toMatchObject({ width: 1920, height: 1080 });
    expect(screenShareProfiles["720p60"].simulcastLayers.at(-1)).toMatchObject({ width: 1280, height: 720 });
  });
});
