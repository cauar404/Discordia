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
    expect(callRoomStyles).toContain("grid-template-rows:minmax(0,1fr)");
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

  it("monta a chamada expandida no painel central do canal e reserva o flutuante para minimização", () => {
    expect(overlaySource).toContain('"call-overlay is-embedded"');
    expect(globalStyles).toContain('.app-shell.call-active>.call-overlay.is-embedded');
    expect(globalStyles).toContain('grid-column:3');
    expect(globalStyles).toContain('.call-overlay.is-minimized{pointer-events:none;background:transparent}');
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

  it("mostra os participantes conectados dentro da tela principal do canal de voz", () => {
    expect(homeSource).toContain("voiceRoomParticipants");
    expect(homeSource).toContain("channelPresenceParticipants?.length ? channelPresenceParticipants : activeCallParticipants");
    expect(homeSource).toContain("refetchInterval: 5_000");
    expect(homeSource).toContain('className="voice-room-presence"');
    expect(homeSource).toContain('className="voice-room-participants"');
    expect(globalStyles).toContain(".voice-room-presence");
  });

  it("oculta as ações redundantes de entrada para quem já está conectado", () => {
    expect(homeSource).toContain("isInCurrentCall");
    expect(globalStyles).toContain(".app-shell.call-active .voice-room .relative>.mt-7{display:none}");
  });

  it("oculta a tela de pré-entrada quando a sala LiveKit já está conectada", () => {
    expect(globalStyles).toContain(".app-shell.call-active .voice-room{display:none}");
  });

  it("apresenta o estado pré-entrada como uma composição central de miniaturas", () => {
    expect(globalStyles).toContain(".app-shell:not(.call-active) .voice-room{position:relative;display:flex;align-items:center;justify-content:center");
    expect(globalStyles).toContain(".app-shell:not(.call-active) .voice-room-participants{order:-1");
    expect(globalStyles).toContain(".app-shell:not(.call-active) .voice-room-participant{width:92px;height:56px");
    expect(globalStyles).toContain(".app-shell:not(.call-active) .voice-room-presence{order:-1;margin:0 0 1.45rem");
    expect(globalStyles).toContain(".app-shell:not(.call-active) .voice-room-participant{width:152px;height:86px");
    expect(globalStyles).toContain(".app-shell:not(.call-active) .voice-room .relative>.mt-7 .button:nth-child(2){display:none}");
  });

  it("prioriza a camada alta da transmissão aberta e usa 720p60 como perfil padrão", () => {
    expect(callRoomSource).toContain('useState<ScreenShareQuality>("720p60")');
    expect(callRoomSource).toContain("publication.setVideoQuality(trackKey(screenShare) === focusedScreenShareKey ? VideoQuality.HIGH : VideoQuality.MEDIUM)");
    expect(callRoomSource).toContain('contentHint: nextQuality.endsWith("60") ? "motion" : "detail"');
  });

  it("mantém o último diagnóstico real entre amostras e separa fechar de tela cheia no palco", () => {
    expect(callRoomSource).toContain("const diagnosticSampleRef = useRef");
    expect(callRoomSource).toContain("Amostra interrompida");
    expect(callRoomSource).toContain("const diagnosticDirection = diagnosticScreenShare?.participant.identity === localParticipant.identity ? \"outbound\" : \"inbound\"");
    expect(callRoomSource).toContain("stat.type === `${diagnosticDirection}-rtp`");
    expect(callRoomStyles).toContain(".call-stage-actions { position:absolute; top:.6rem; right:.6rem; z-index:2");
    expect(callRoomStyles).toContain(".call-stage-close { position:absolute; z-index:2; top:.6rem; left:.6rem; }");
  });

  it("substitui a grade pelo palco escolhido sem duplicar a transmissão expandida", () => {
    expect(callRoomSource).toContain("const isStageExpanded = Boolean(focusedScreenShare && shouldShowFocusedScreenStage(focusedScreenShareKey))");
    expect(callRoomSource).toContain('isStageExpanded && "is-stage-expanded"');
    expect(callRoomSource).toContain('{isStageExpanded ? <section ref={stageRef} className="call-stage call-stage-modern"');
    expect(callRoomStyles).toContain(".call-participant-area-modern.is-stage-expanded { padding:0; background:#090a0c; }");
    expect(callRoomStyles).toContain(".call-participant-area-modern.is-stage-expanded .call-stage-modern { position:relative; inset:auto; width:100%; height:100%");
  });

  it("mantém a interface da chamada contida na janela e deixa a rolagem para os painéis internos", () => {
    expect(globalStyles).toContain("#root:has(.app-shell){height:100dvh;overflow:hidden}");
    expect(globalStyles).toContain(".app-shell { display:grid; grid-template-columns:72px 252px minmax(0,1fr) 272px; height:100dvh; min-height:0; overflow:hidden; overscroll-behavior:none;");
    expect(globalStyles).toContain(".chat-panel { position:relative; display:flex; min-width:0; height:100%; min-height:0; flex-direction:column; overflow:hidden;");
    expect(globalStyles).toContain(".context-panel { display:flex; height:100%; min-height:0; flex-direction:column; overflow:hidden;");
    expect(globalStyles).toContain(".app-shell.call-active>.call-overlay.is-embedded{position:relative;z-index:20;inset:auto;grid-column:3;grid-row:1;width:100%;height:100%;min-height:0;overflow:hidden}");
  });

  it("remove o painel lateral de membros da grade enquanto a chamada ocupa o painel central", () => {
    expect(globalStyles).toContain(".app-shell.call-active{grid-template-columns:72px 252px minmax(0,1fr)}");
    expect(globalStyles).toContain(".app-shell.call-active>.context-panel{display:none}");
  });

  it("fixa a casca da chamada à viewport disponível, inclusive com a barra de compartilhamento do navegador", () => {
    expect(globalStyles).toContain("body:has(.app-shell.call-active){overflow:hidden}");
    expect(globalStyles).toContain(".app-shell.call-active{position:fixed;inset:0;width:100%;height:100dvh;min-height:100dvh}");
  });
});
