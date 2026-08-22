import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const room = readFileSync(resolve(import.meta.dirname, "../client/src/components/CallRoom.tsx"), "utf8");
const styles = readFileSync(resolve(import.meta.dirname, "../client/src/components/CallRoom.css"), "utf8");

describe("hierarquia visual da chamada", () => {
  it("mantém controles compactos com contexto acessível", () => {
    expect(room).toContain('title={isScreenShareEnabled ? "Parar compartilhamento" : "Compartilhar tela"}');
    expect(room).toContain("Áudio, tela e conexão");
  });

  it("organiza as configurações em painel contido e responsivo sem sobrepor a mídia", () => {
    expect(styles).toContain(".call-room-polished .call-settings-panel[open]{max-height:min(34dvh,330px);overflow:auto");
    expect(styles).toContain(".call-room-polished .call-settings-grid{grid-template-columns:repeat(4,minmax(0,1fr))");
    expect(styles).toContain("@media (max-width:620px)");
    expect(styles).toContain(".call-room-polished .call-settings-grid{grid-template-columns:1fr");
  });
});
