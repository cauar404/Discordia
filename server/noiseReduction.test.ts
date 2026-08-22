import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const options = readFileSync(resolve(import.meta.dirname, "../client/src/lib/livekitOptions.ts"), "utf8");
const callRoom = readFileSync(resolve(import.meta.dirname, "../client/src/components/CallRoom.tsx"), "utf8");
const viteConfig = readFileSync(resolve(import.meta.dirname, "../vite.config.ts"), "utf8");

describe("limpeza de voz nas chamadas", () => {
  it("mantém a proteção padrão do navegador na captura do microfone", () => {
    expect(options).toContain("autoGainControl: true");
    expect(options).toContain("echoCancellation: true");
    expect(options).toContain("noiseSuppression: true");
  });

  it("habilita o filtro Krisp avançado após o microfone estar publicado e informa indisponibilidade", () => {
    expect(callRoom).toContain('await import("@livekit/krisp-noise-filter")');
    expect(callRoom).toContain("microphoneTrack.setProcessor(KrispNoiseFilter())");
    expect(callRoom).toContain("microphoneTrack.stopProcessor()");
    expect(callRoom).toContain("window.setTimeout(() => { void configureNoiseReduction(); }, 1_000)");
    expect(callRoom).toContain("A filtragem avançada de ruído não é compatível");
    expect(callRoom).toContain("Filtro Krisp ativo antes de a sua voz ser enviada à chamada.");
  });

  it("deixa o processador pesado fora do chunk principal da chamada", () => {
    expect(viteConfig).toContain('id.includes("@livekit/krisp-noise-filter")');
    expect(viteConfig.indexOf('id.includes("@livekit/krisp-noise-filter")')).toBeLessThan(viteConfig.indexOf('id.includes("livekit")'));
  });
});
