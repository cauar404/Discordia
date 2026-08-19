import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const callRoomSource = readFileSync("client/src/components/CallRoom.tsx", "utf8");
const callRoomStyles = readFileSync("client/src/components/CallRoom.css", "utf8");

describe("apresentação da transmissão na sala de chamadas", () => {
  it("mantém cartões de transmissão dentro da mesma grade de participantes", () => {
    expect(callRoomSource).toContain('className={cn("call-participant-grid", gridSummary.itemCount === 1 && "is-solo")}');
    expect(callRoomSource).toContain("{screenShares.map(track =>");
    expect(callRoomSource).not.toContain("call-share-strip");
    expect(callRoomSource).not.toContain("call-share-grid");
  });

  it("abre o palco somente quando uma transmissão é selecionada", () => {
    expect(callRoomSource).toContain("focusedScreenShare && shouldShowFocusedScreenStage(focusedScreenShareKey)");
  });

  it("mantém o dock acima do palco expansível", () => {
    expect(callRoomStyles).toContain(".call-stage-modern { position:absolute; z-index:20");
    expect(callRoomStyles).toContain(".call-dock { position:relative; z-index:30");
  });
});
