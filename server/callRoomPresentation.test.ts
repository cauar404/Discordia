import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const callRoomSource = readFileSync("client/src/components/CallRoom.tsx", "utf8");
const callRoomStyles = readFileSync("client/src/components/CallRoom.css", "utf8");
const overlaySource = readFileSync("client/src/components/CallOverlay.tsx", "utf8");
const globalStyles = readFileSync("client/src/index.css", "utf8");
const homeSource = readFileSync("client/src/pages/Home.tsx", "utf8");

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

  it("usa uma única coluna útil e cartões proporcionais para evitar vazios laterais", () => {
    expect(callRoomStyles).toContain(".call-main-modern { min-height:0; flex:1; grid-template-columns:minmax(0,1fr)");
    expect(callRoomStyles).toContain(".call-participant-card,.call-share-tile { min-width:0; min-height:0; align-self:center; aspect-ratio:16 / 9");
    expect(callRoomStyles).toContain(".call-participant-grid.is-solo { grid-template-columns:minmax(260px,520px); justify-content:center;");
  });

  it("aplica a composição compacta e preserva uma grade central proporcional", () => {
    expect(callRoomSource).toContain('"call-room", "call-room-polished"');
    expect(callRoomStyles).toContain(".call-room-polished .call-participant-grid { grid-template-columns:repeat(auto-fit,minmax(230px,1fr))");
    expect(callRoomStyles).toContain("max-width:1180px");
    expect(callRoomStyles).toContain(".call-room-polished .call-dock-control span { display:none; }");
    expect(callRoomStyles).toContain(".call-room-polished .call-stage-modern { top:58px; right:auto; left:50%; width:min(1080px,calc(100% - 1.5rem))");
  });

  it("permite minimizar e restaurar a chamada sem desmontar a sala LiveKit", () => {
    expect(callRoomSource).toContain('className="call-minibar"');
    expect(callRoomSource).toContain('onClick={onMinimize}');
    expect(overlaySource).toContain('isMinimized = false');
    expect(overlaySource).toContain('<LiveKitRoom serverUrl={call.serverUrl} token={call.token} connect');
  });

  it("mantém a barra minimizada interativa sem bloquear a navegação externa", () => {
    expect(callRoomStyles).toContain('.call-room.is-minimized>:not(.call-minibar) { display:none; }');
    expect(globalStyles).toContain('.call-overlay.is-minimized{pointer-events:none;background:transparent}');
    expect(globalStyles).toContain('pointer-events:auto');
  });

  it("reflete a sessão conectada no canal e sincroniza o controle de mudo próprio", () => {
    expect(homeSource).toContain("isInCurrentCall");
    expect(homeSource).toContain("connectedChannelId === channelId");
    expect(homeSource).toContain("setConnectedChannelId(channelId)");
    expect(homeSource).toContain("ActiveCallBar");
    expect(homeSource).toContain("microphoneToggleSignal");
    expect(homeSource).toContain("onMicrophoneStateChange={setCallMicrophoneEnabled}");
    expect(callRoomSource).toContain("onMicrophoneStateChange?.(isMicrophoneEnabled)");
    expect(globalStyles).toContain(".active-call-bar");
  });
});
