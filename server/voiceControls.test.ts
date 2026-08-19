import { describe, expect, it } from "vitest";
import { isPushToTalkKeyAllowed, pushToTalkKeyLabel } from "@shared/voiceControls";

describe("aperte-para-falar", () => {
  it("apresenta teclas comuns com rótulos compreensíveis", () => {
    expect(pushToTalkKeyLabel("Space")).toBe("Espaço");
    expect(pushToTalkKeyLabel("KeyQ")).toBe("Q");
    expect(pushToTalkKeyLabel("Digit7")).toBe("7");
  });

  it("não permite teclas reservadas ou vazias como atalho", () => {
    expect(isPushToTalkKeyAllowed("Escape")).toBe(false);
    expect(isPushToTalkKeyAllowed("Tab")).toBe(false);
    expect(isPushToTalkKeyAllowed("")).toBe(false);
    expect(isPushToTalkKeyAllowed("Space")).toBe(true);
  });
});
