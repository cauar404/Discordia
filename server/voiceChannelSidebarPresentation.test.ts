import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync("client/src/pages/Home.tsx", "utf8");
const globalStyles = readFileSync("client/src/index.css", "utf8");

describe("presença lateral dos canais de voz", () => {
  it("mantém a identificação do participante disponível por tooltip", () => {
    expect(homeSource).toContain('className="voice-channel-participant"');
    expect(homeSource).toContain('title={`${participant.displayName || "Membro"} está na chamada`}');
  });

  it("exibe os participantes como avatares compactos, sem rótulo de nome na barra lateral", () => {
    expect(globalStyles).toContain(".voice-channel-group{display:flex;flex-wrap:wrap");
    expect(globalStyles).toContain(".voice-channel-participant{display:inline-flex");
    expect(globalStyles).toContain(".voice-channel-participant>.truncate{display:none}");
  });
});
