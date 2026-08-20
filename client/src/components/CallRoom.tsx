import { AudioTrack, VideoTrack, useConnectionState, useLocalParticipant, useParticipants, useTracks, type TrackReference } from "@livekit/components-react";
import { Activity, AudioLines, ChevronDown, Gauge, Keyboard, Maximize2, Mic, MicOff, Minimize2, MonitorUp, PhoneOff, Radio, ScreenShare, Settings2, SlidersHorizontal, Users, Video, VideoOff, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPresets, ConnectionState, Track, VideoQuality } from "livekit-client";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { getScreenSharePublishOptions, screenShareProfiles, type ScreenShareQuality } from "@shared/callQuality";
import { getScreenShareAudioOptions } from "@shared/callAudio";
import { audioMixKey, deserializeIndividualAudioMixes, INDIVIDUAL_AUDIO_MIX_STORAGE_KEY, normalizeIndividualAudioMix, serializeIndividualAudioMixes, updateIndividualAudioMix, type IndividualAudioMix, type IndividualAudioMixes } from "@shared/callMixer";
import { getCallGridSummary, shouldShowFocusedScreenStage } from "@shared/callRoomLayout";
import { collectCallMediaMetrics, diagnoseCallMedia, formatMediaMetric, type CallMediaDiagnostic } from "@shared/callMediaDiagnostics";
import { isPushToTalkKeyAllowed, pushToTalkKeyLabel } from "@shared/voiceControls";
import "./CallRoom.css";

type CallKind = "voice" | "video";
type VoiceVideoSettings = Record<string, string | boolean>;

function displayName(participant: { name?: string; identity: string }) {
  return participant.name?.trim() || participant.identity || "Membro do Círculo";
}

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "C";
}

function isDisplayCapturePolicyError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("display-capture") || message.includes("permissions policy") || message.includes("permission policy");
}

function canReadRTCStats(track: unknown): track is { getRTCStatsReport: () => Promise<RTCStatsReport | undefined> } {
  return typeof (track as { getRTCStatsReport?: unknown } | undefined)?.getRTCStatsReport === "function";
}

function readStoredMixes(): IndividualAudioMixes {
  if (typeof window === "undefined") return {};
  try { return deserializeIndividualAudioMixes(window.localStorage.getItem(INDIVIDUAL_AUDIO_MIX_STORAGE_KEY)); } catch { return {}; }
}

function trackKey(track: TrackReference) {
  return audioMixKey(track.participant.identity, String(track.source), track.publication?.trackSid);
}

function VolumePanel({ label, mix, onMixChange, unavailable = false }: { label: string; mix: IndividualAudioMix; onMixChange: (update: Partial<IndividualAudioMix>) => void; unavailable?: boolean }) {
  return <div className="call-context-volume" onPointerDown={event => event.stopPropagation()}>
    <div className="call-context-volume-heading"><span>{label}</span><strong>{unavailable ? "Sem áudio" : `${Math.round(mix.volume * 100)}%`}</strong></div>
    <div className="call-context-volume-controls">
      <button type="button" className={cn("call-mini-mute", mix.muted && "is-muted")} onClick={() => onMixChange({ muted: !mix.muted })} disabled={unavailable} aria-label={mix.muted ? "Ativar áudio" : "Silenciar áudio"}>{mix.muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}</button>
      <input type="range" min="0" max="100" step="1" value={Math.round(mix.volume * 100)} onChange={event => onMixChange({ volume: Number(event.target.value) / 100 })} disabled={unavailable} aria-label={label} />
    </div>
  </div>;
}

function ParticipantCard({ participant, cameraTrack, voiceTrack, mix, onMixChange }: { participant: { identity: string; name?: string; isSpeaking?: boolean }; cameraTrack?: TrackReference; voiceTrack?: TrackReference; mix: IndividualAudioMix; onMixChange: (update: Partial<IndividualAudioMix>) => void }) {
  const name = displayName(participant);
  return <ContextMenu>
    <ContextMenuTrigger asChild>
      <article className={cn("call-participant-card", participant.isSpeaking && "is-speaking")} title={`Clique com o botão direito para configurar a voz de ${name}`}>
        <div className="call-participant-video">
          {cameraTrack ? <VideoTrack trackRef={cameraTrack} className="size-full object-cover" /> : <div className="call-avatar" aria-label={`${name}, câmera desativada`}>{initials(name)}</div>}
          <div className="call-participant-meta"><span className={cn("call-speaking-dot", participant.isSpeaking && "is-active")} /><strong>{name}</strong><span className="call-participant-volume">{mix.muted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}{Math.round(mix.volume * 100)}%</span></div>
          {!cameraTrack && <span className="call-camera-off"><VideoOff className="size-3.5" /> Câmera desligada</span>}
        </div>
      </article>
    </ContextMenuTrigger>
    <ContextMenuContent className="call-context-menu">
      <ContextMenuLabel>Voz de {name}</ContextMenuLabel>
      <VolumePanel label={`Volume de ${name}`} mix={mix} onMixChange={onMixChange} unavailable={!voiceTrack} />
      <ContextMenuSeparator />
      <ContextMenuItem disabled={!voiceTrack} onSelect={() => onMixChange({ muted: !mix.muted })}>{mix.muted ? "Ativar voz" : "Silenciar voz"}</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>;
}

function ScreenShareCard({ track, audioTrack, mix, selected, onSelect, onStopWatching, onFullscreen, onMixChange, onSourceSwitchHelp, isLocal }: { track: TrackReference; audioTrack?: TrackReference; mix: IndividualAudioMix; selected: boolean; onSelect: () => void; onStopWatching: () => void; onFullscreen: () => void; onMixChange: (update: Partial<IndividualAudioMix>) => void; onSourceSwitchHelp: () => void; isLocal: boolean }) {
  const name = displayName(track.participant);
  return <ContextMenu>
    <ContextMenuTrigger asChild>
      <button type="button" className={cn("call-share-tile", selected && "is-selected")} onClick={onSelect} aria-pressed={selected} aria-label={`Abrir transmissão de ${name}`}>
        <VideoTrack trackRef={track} className="call-share-tile-video" />
        <span className="call-share-live"><span /> AO VIVO</span>
        <span className="call-share-tile-label"><MonitorUp className="size-3.5" /><strong>{name}</strong>{audioTrack && <AudioLines className="size-3.5" />}</span>
      </button>
    </ContextMenuTrigger>
    <ContextMenuContent className="call-context-menu">
      <ContextMenuLabel>Transmissão de {name}</ContextMenuLabel>
      <VolumePanel label="Áudio da transmissão" mix={mix} onMixChange={onMixChange} unavailable={!audioTrack} />
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={onSelect}>Abrir no palco</ContextMenuItem>
      <ContextMenuItem onSelect={onFullscreen}>Abrir em tela cheia</ContextMenuItem>
      <ContextMenuItem onSelect={onStopWatching}>Parar de assistir</ContextMenuItem>
      {isLocal && <><ContextMenuSeparator /><ContextMenuItem onSelect={onSourceSwitchHelp}>Trocar fonte de transmissão</ContextMenuItem></>}
    </ContextMenuContent>
  </ContextMenu>;
}

export function CallRoom({ kind, onLeave, isMinimized = false, onMinimize, onRestore, voiceVideoSettings, onVoiceVideoSettingsChange, microphoneToggleSignal, onMicrophoneStateChange }: { kind: CallKind; onLeave: () => void | Promise<void>; isMinimized?: boolean; onMinimize?: () => void; onRestore?: () => void; voiceVideoSettings?: VoiceVideoSettings; onVoiceVideoSettingsChange?: (settings: VoiceVideoSettings) => void | Promise<unknown>; microphoneToggleSignal?: number; onMicrophoneStateChange?: (enabled: boolean) => void }) {
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const mediaTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const audioTracks = useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio, Track.Source.Unknown]).filter((track): track is TrackReference => track.publication?.kind === Track.Kind.Audio);
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [quality, setQuality] = useState<ScreenShareQuality>("720p60");
  const [includeScreenShareAudio, setIncludeScreenShareAudio] = useState(true);
  const [activeQuality, setActiveQuality] = useState<ScreenShareQuality | null>(null);
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [displayCaptureBlocked, setDisplayCaptureBlocked] = useState(false);
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const [focusedScreenShareKey, setFocusedScreenShareKey] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(voiceVideoSettings?.pushToTalk === true);
  const [pushToTalkKey, setPushToTalkKey] = useState(typeof voiceVideoSettings?.pushToTalkKey === "string" ? voiceVideoSettings.pushToTalkKey : "Space");
  const [isChoosingPushToTalkKey, setIsChoosingPushToTalkKey] = useState(false);
  const [isPushToTalkPressed, setIsPushToTalkPressed] = useState(false);
  const [audioMixes, setAudioMixes] = useState<IndividualAudioMixes>(readStoredMixes);
  const [mediaDiagnostic, setMediaDiagnostic] = useState<CallMediaDiagnostic | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const pushToTalkSequenceRef = useRef(0);
  const microphoneSignalRef = useRef<number | undefined>(microphoneToggleSignal);
  const lastCandidatePairRef = useRef<string | null>(null);
  const diagnosticSampleRef = useRef<{ trackKey: string | null; bytes?: number; sampledAt?: number }>({ trackKey: null });
  const isEmbeddedPreview = typeof window !== "undefined" && window.top !== window.self;

  const tracks = useMemo(() => mediaTracks.filter((track): track is TrackReference => track.publication !== undefined), [mediaTracks]);
  const cameraTracks = useMemo(() => new Map(tracks.filter(track => track.source === Track.Source.Camera).map(track => [track.participant.identity, track])), [tracks]);
  const screenShares = useMemo(() => tracks.filter(track => track.source === Track.Source.ScreenShare), [tracks]);
  const focusedScreenShare = useMemo(() => screenShares.find(track => trackKey(track) === focusedScreenShareKey), [focusedScreenShareKey, screenShares]);
  const remoteAudioTracks = useMemo(() => audioTracks.filter(track => track.participant.identity !== localParticipant.identity), [audioTracks, localParticipant.identity]);
  const voiceTracks = useMemo(() => new Map(remoteAudioTracks.filter(track => track.source === Track.Source.Microphone).map(track => [track.participant.identity, track])), [remoteAudioTracks]);
  const screenShareAudioTracks = useMemo(() => remoteAudioTracks.filter(track => track.source === Track.Source.ScreenShareAudio), [remoteAudioTracks]);
  const diagnosticScreenShare = useMemo(() => focusedScreenShare ?? screenShares.find(track => track.participant.identity === localParticipant.identity), [focusedScreenShare, localParticipant.identity, screenShares]);
  const diagnosticScreenShareKey = diagnosticScreenShare ? trackKey(diagnosticScreenShare) : null;
  const diagnosticRtcTrack = diagnosticScreenShare?.publication?.track;
  const diagnosticDirection = diagnosticScreenShare?.participant.identity === localParticipant.identity ? "outbound" : "inbound";

  useEffect(() => {
    if (focusedScreenShareKey && !screenShares.some(track => trackKey(track) === focusedScreenShareKey)) setFocusedScreenShareKey(null);
  }, [focusedScreenShareKey, screenShares]);
  useEffect(() => {
    for (const screenShare of screenShares) {
      const publication = screenShare.publication as { setVideoQuality?: (quality: VideoQuality) => void } | undefined;
      if (!publication?.setVideoQuality) continue;
      publication.setVideoQuality(trackKey(screenShare) === focusedScreenShareKey ? VideoQuality.HIGH : VideoQuality.MEDIUM);
    }
  }, [focusedScreenShareKey, screenShares]);
  useEffect(() => {
    try { window.localStorage.setItem(INDIVIDUAL_AUDIO_MIX_STORAGE_KEY, serializeIndividualAudioMixes(audioMixes)); } catch { /* armazenamento local pode estar indisponível */ }
  }, [audioMixes]);
  useEffect(() => { if (!isScreenShareEnabled) setActiveQuality(null); }, [isScreenShareEnabled]);
  useEffect(() => {
    let cancelled = false;
    if (!diagnosticScreenShareKey || !canReadRTCStats(diagnosticRtcTrack)) { diagnosticSampleRef.current = { trackKey: null }; setMediaDiagnostic(null); return; }
    if (diagnosticSampleRef.current.trackKey !== diagnosticScreenShareKey) {
      diagnosticSampleRef.current = { trackKey: diagnosticScreenShareKey };
      setMediaDiagnostic(null);
    }
    const sample = async () => {
      try {
        const report = await diagnosticRtcTrack.getRTCStatsReport();
        if (cancelled) return;
        if (!report) {
          setMediaDiagnostic(previous => previous ? { ...previous, status: "unavailable", label: "Amostra indisponível", recommendation: "A transmissão continua, mas o navegador não entregou uma nova amostra WebRTC. O último bitrate confirmado permanece exibido." } : null);
          return;
        }
        const now = Date.now();
        const previousSample = diagnosticSampleRef.current;
        const metrics = collectCallMediaMetrics(report, previousSample.sampledAt ? now - previousSample.sampledAt : 0, previousSample.bytes, diagnosticDirection);
        const rtp = Array.from(report.values()).find(stat => stat.type === `${diagnosticDirection}-rtp` && stat.kind === "video");
        diagnosticSampleRef.current = {
          trackKey: diagnosticScreenShareKey,
          bytes: typeof rtp?.bytesSent === "number" ? rtp.bytesSent : typeof rtp?.bytesReceived === "number" ? rtp.bytesReceived : previousSample.bytes,
          sampledAt: now,
        };
        const route = metrics.candidatePair;
        const routeSignature = route ? [route.protocol ?? "unknown", route.localCandidateType ?? "unknown", route.remoteCandidateType ?? "unknown", route.relayProtocol ?? "none", route.usesRelay ? "relay" : "direct"].join(":") : null;
        if (routeSignature && routeSignature !== lastCandidatePairRef.current) {
          lastCandidatePairRef.current = routeSignature;
          console.info("[Círculo LiveKit] Rota WebRTC da transmissão", route);
        }
        setMediaDiagnostic(diagnoseCallMedia(metrics));
      } catch {
        if (!cancelled) setMediaDiagnostic(previous => previous ? { ...previous, status: "unavailable", label: "Amostra interrompida", recommendation: "A leitura WebRTC falhou temporariamente. O último bitrate confirmado permanece exibido e será atualizado assim que uma nova amostra chegar." } : null);
      }
    };
    void sample();
    const interval = window.setInterval(() => { void sample(); }, 2_500);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [diagnosticDirection, diagnosticRtcTrack, diagnosticScreenShareKey]);
  useEffect(() => {
    setPushToTalkEnabled(voiceVideoSettings?.pushToTalk === true);
    if (typeof voiceVideoSettings?.pushToTalkKey === "string") setPushToTalkKey(voiceVideoSettings.pushToTalkKey);
  }, [voiceVideoSettings?.pushToTalk, voiceVideoSettings?.pushToTalkKey]);
  useEffect(() => {
    const syncFullscreenState = () => setIsStageFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);
  useEffect(() => {
    if (!isChoosingPushToTalkKey) return;
    const captureKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return setIsChoosingPushToTalkKey(false);
      if (!isPushToTalkKeyAllowed(event.code)) return;
      event.preventDefault();
      setPushToTalkKey(event.code);
      setIsChoosingPushToTalkKey(false);
      void onVoiceVideoSettingsChange?.({ pushToTalk: pushToTalkEnabled, pushToTalkKey: event.code });
    };
    window.addEventListener("keydown", captureKey, true);
    return () => window.removeEventListener("keydown", captureKey, true);
  }, [isChoosingPushToTalkKey, onVoiceVideoSettingsChange, pushToTalkEnabled]);
  useEffect(() => {
    if (!pushToTalkEnabled || isChoosingPushToTalkKey) return;
    const updateMicrophone = async (enabled: boolean) => {
      const sequence = ++pushToTalkSequenceRef.current;
      try {
        await localParticipant.setMicrophoneEnabled(enabled);
        if (enabled && sequence !== pushToTalkSequenceRef.current) await localParticipant.setMicrophoneEnabled(false);
      } catch { setShareError("Não foi possível alterar o microfone para aperte-para-falar."); }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.code !== pushToTalkKey || event.repeat) return;
      event.preventDefault(); setIsPushToTalkPressed(true); void updateMicrophone(true);
    };
    const onKeyUp = (event: KeyboardEvent) => { if (event.code === pushToTalkKey) { event.preventDefault(); setIsPushToTalkPressed(false); void updateMicrophone(false); } };
    const releaseOnBlur = () => { setIsPushToTalkPressed(false); void updateMicrophone(false); };
    window.addEventListener("keydown", onKeyDown, true); window.addEventListener("keyup", onKeyUp, true); window.addEventListener("blur", releaseOnBlur); document.addEventListener("visibilitychange", releaseOnBlur);
    void localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
    return () => { window.removeEventListener("keydown", onKeyDown, true); window.removeEventListener("keyup", onKeyUp, true); window.removeEventListener("blur", releaseOnBlur); document.removeEventListener("visibilitychange", releaseOnBlur); void localParticipant.setMicrophoneEnabled(false).catch(() => undefined); };
  }, [isChoosingPushToTalkKey, localParticipant, pushToTalkEnabled, pushToTalkKey]);

  async function toggleMicrophone() { if (!pushToTalkEnabled) try { await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled); } catch { setShareError("Não foi possível alterar o microfone. Verifique a permissão do navegador."); } }
  useEffect(() => { onMicrophoneStateChange?.(isMicrophoneEnabled); }, [isMicrophoneEnabled, onMicrophoneStateChange]);
  useEffect(() => {
    if (microphoneToggleSignal === undefined || microphoneSignalRef.current === microphoneToggleSignal) return;
    microphoneSignalRef.current = microphoneToggleSignal;
    void toggleMicrophone();
  }, [microphoneToggleSignal]);
  async function toggleCamera() { try { await localParticipant.setCameraEnabled(!isCameraEnabled); } catch { setShareError("Não foi possível alterar a câmera. Verifique a permissão do navegador."); } }
  async function startScreenShare(nextQuality = quality) {
    const profile = screenShareProfiles[nextQuality];
    setShareError(null); setDisplayCaptureBlocked(false); setIsUpdatingShare(true);
    try {
      await localParticipant.setScreenShareEnabled(true, { video: true, ...getScreenShareAudioOptions(includeScreenShareAudio), resolution: profile.resolution, contentHint: nextQuality.endsWith("60") ? "motion" : "detail", selfBrowserSurface: "include", surfaceSwitching: "include" }, { ...getScreenSharePublishOptions(nextQuality), audioPreset: AudioPresets.musicHighQualityStereo, dtx: false, red: true, forceStereo: true });
      setActiveQuality(nextQuality);
    } catch (error) {
      const blockedByPreviewPolicy = isDisplayCapturePolicyError(error);
      setDisplayCaptureBlocked(blockedByPreviewPolicy);
      setShareError(blockedByPreviewPolicy ? "A pré-visualização incorporada bloqueou a captura de tela por política de permissões." : error instanceof Error ? error.message : "O navegador não permitiu iniciar o compartilhamento de tela.");
    } finally { setIsUpdatingShare(false); }
  }
  async function toggleScreenShare() {
    if (!isScreenShareEnabled) return startScreenShare();
    setShareError(null); setIsUpdatingShare(true);
    try { await localParticipant.setScreenShareEnabled(false); setActiveQuality(null); } catch { setShareError("Não foi possível interromper o compartilhamento de tela."); } finally { setIsUpdatingShare(false); }
  }
  async function applyQuality() { if (!isScreenShareEnabled) return; await toggleScreenShare(); await startScreenShare(quality); }
  async function toggleStageFullscreen() {
    const stage = stageRef.current;
    if (!stage || typeof document === "undefined") return;
    setShareError(null);
    try { if (document.fullscreenElement === stage) await document.exitFullscreen(); else if ("requestFullscreen" in stage) await stage.requestFullscreen(); else setShareError("Seu navegador não oferece tela cheia para esta visualização."); } catch { setShareError("Não foi possível alternar a tela cheia. Verifique a permissão do navegador."); }
  }
  function openScreenShare(track: TrackReference) { setFocusedScreenShareKey(trackKey(track)); }
  function openScreenShareFullscreen(track: TrackReference) {
    openScreenShare(track);
    window.requestAnimationFrame(() => { void toggleStageFullscreen(); });
  }
  function showSourceSwitchHelp() {
    setShareError("Para trocar a fonte sem encerrar a transmissão, use o seletor nativo “Compartilhar esta guia” exibido pelo navegador. Se ele não aparecer, seu navegador exigirá iniciar um novo compartilhamento.");
  }
  async function togglePushToTalk() {
    const nextEnabled = !pushToTalkEnabled;
    setPushToTalkEnabled(nextEnabled); setIsChoosingPushToTalkKey(false);
    try { await localParticipant.setMicrophoneEnabled(!nextEnabled); await onVoiceVideoSettingsChange?.({ pushToTalk: nextEnabled, pushToTalkKey }); } catch { setPushToTalkEnabled(!nextEnabled); setShareError("Não foi possível atualizar o aperte-para-falar."); }
  }
  function mixFor(track?: TrackReference) { return track ? normalizeIndividualAudioMix(audioMixes[trackKey(track)]) : normalizeIndividualAudioMix(); }
  function updateMix(track: TrackReference, update: Partial<IndividualAudioMix>) { setAudioMixes(current => updateIndividualAudioMix(current, trackKey(track), update)); }

  const stageLabel = focusedScreenShare ? `${displayName(focusedScreenShare.participant)} está compartilhando a tela` : "Palco da chamada";
  const gridSummary = getCallGridSummary(participants.length, screenShares.length);
  const isReconnecting = connectionState === ConnectionState.Reconnecting;
  return <section className={cn("call-room", "call-room-polished", screenShares.length > 0 && "has-screen-share", focusedScreenShare && "has-focused-share", isSettingsOpen && "settings-open", isMinimized && "is-minimized")} aria-label="Sala de chamada">
    <section className="call-minibar" aria-label="Chamada em andamento">
      <button type="button" className="call-minibar-main" onClick={onRestore} aria-label="Restaurar chamada"><span className="call-minibar-pulse" /><span className="call-minibar-copy"><strong>{kind === "video" ? "Chamada de vídeo" : "Chamada de voz"}</strong><small>{participants.length} participante{participants.length === 1 ? "" : "s"}{isScreenShareEnabled ? " · transmitindo tela" : " · em andamento"}</small></span><Maximize2 className="size-4" /></button>
      <button type="button" className={cn("call-minibar-action", !isMicrophoneEnabled && "is-off")} onClick={() => void toggleMicrophone()} disabled={pushToTalkEnabled} aria-label={isMicrophoneEnabled ? "Silenciar microfone" : "Ativar microfone"}>{isMicrophoneEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}</button>
      <button type="button" className="call-minibar-action is-end" onClick={() => void onLeave()} aria-label="Sair da chamada"><PhoneOff className="size-4" /></button>
    </section>
    <header className="call-topbar call-topbar-modern">
      <div className="call-room-identity"><span className="call-room-icon"><Radio className="size-4" /></span><div className="min-w-0"><span className="call-room-kicker">CANAL DE VOZ</span><strong>{kind === "video" ? "Chamada de vídeo" : "Chamada de voz"}</strong></div></div>
      <div className="call-topbar-status"><span className={cn("live-indicator", isReconnecting && "is-reconnecting")} /><span>{isReconnecting ? "Reconectando…" : "Conectado"}</span><span className="call-status-divider" /><Users className="size-3.5" /><span>{participants.length}</span><button type="button" className="call-minimize-button" onClick={onMinimize} aria-label="Minimizar chamada"><Minimize2 className="size-4" /><span>Minimizar</span></button><button type="button" className="call-leave-button" onClick={() => void onLeave()}><PhoneOff className="size-4" /><span>Sair</span></button></div>
    </header>
    {isReconnecting && <div className="call-reconnect-banner" role="status"><Gauge className="size-4" /><span>A conexão oscilou. A transmissão está sendo retomada automaticamente.</span></div>}
    <div className="call-main call-main-modern">
      <aside className="call-participant-area call-participant-area-modern" aria-label="Participantes e transmissões na chamada">
        <div className="call-section-heading"><span>NA CHAMADA</span><span>{participants.length}</span>{gridSummary.hasScreenShares && <small><MonitorUp className="size-3.5" /> {gridSummary.screenShareLabel}</small>}</div>
        <div className={cn("call-participant-grid", gridSummary.itemCount === 1 && "is-solo")}>{participants.map(participant => { const voiceTrack = voiceTracks.get(participant.identity); return <ParticipantCard key={participant.identity} participant={participant} cameraTrack={cameraTracks.get(participant.identity)} voiceTrack={voiceTrack} mix={mixFor(voiceTrack)} onMixChange={update => voiceTrack && updateMix(voiceTrack, update)} />; })}{screenShares.map(track => { const audioTrack = screenShareAudioTracks.find(audio => audio.participant.identity === track.participant.identity); return <ScreenShareCard key={trackKey(track)} track={track} audioTrack={audioTrack} mix={mixFor(audioTrack)} selected={trackKey(track) === focusedScreenShareKey} onSelect={() => openScreenShare(track)} onStopWatching={() => setFocusedScreenShareKey(null)} onFullscreen={() => openScreenShareFullscreen(track)} onMixChange={update => audioTrack && updateMix(audioTrack, update)} onSourceSwitchHelp={showSourceSwitchHelp} isLocal={track.participant.identity === localParticipant.identity} />; })}</div>
      </aside>
    </div>
    {focusedScreenShare && shouldShowFocusedScreenStage(focusedScreenShareKey) && <section ref={stageRef} className="call-stage call-stage-modern" aria-label={stageLabel}>
      <VideoTrack trackRef={focusedScreenShare} className="call-screen-video" />
      <div className="call-screen-caption"><MonitorUp className="size-4" /><span>{stageLabel}</span></div>
      <button type="button" className="call-stage-close" onClick={() => setFocusedScreenShareKey(null)} aria-label="Fechar transmissão expandida"><X className="size-4" /></button><div className="call-stage-actions"><button type="button" className="call-fullscreen-control" onClick={() => void toggleStageFullscreen()} aria-label={isStageFullscreen ? "Sair da tela cheia" : "Ver tela compartilhada em tela cheia"}>{isStageFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button></div>
    </section>}
    <section className="call-dock" aria-label="Controles rápidos da chamada">
      <button type="button" className={cn("call-dock-control", !isMicrophoneEnabled && "is-off", pushToTalkEnabled && "is-active")} onClick={() => void toggleMicrophone()} disabled={pushToTalkEnabled} aria-label={pushToTalkEnabled ? `Aperte ${pushToTalkKeyLabel(pushToTalkKey)} para falar` : isMicrophoneEnabled ? "Desativar microfone" : "Ativar microfone"}>{pushToTalkEnabled || isMicrophoneEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}<span>{pushToTalkEnabled ? (isPushToTalkPressed ? "Falando" : "Aperte para falar") : "Microfone"}</span></button>
      <button type="button" className={cn("call-dock-control", !isCameraEnabled && "is-off")} onClick={() => void toggleCamera()} aria-label={isCameraEnabled ? "Desativar câmera" : "Ativar câmera"}>{isCameraEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}<span>Câmera</span></button>
      <button type="button" className={cn("call-dock-control", isScreenShareEnabled && "is-active")} onClick={() => void toggleScreenShare()} disabled={isUpdatingShare} aria-label={isScreenShareEnabled ? "Parar compartilhamento" : "Compartilhar tela"}><ScreenShare className="size-5" /><span>{isScreenShareEnabled ? "Parar tela" : "Compartilhar"}</span></button>
      <button type="button" className="call-dock-end" onClick={() => void onLeave()} aria-label="Sair da chamada"><PhoneOff className="size-5" /></button>
    </section>
    <details className="call-settings-panel" onToggle={event => setIsSettingsOpen(event.currentTarget.open)}>
      <summary><span><Settings2 className="size-4" /> Configurações da chamada</span><ChevronDown className="size-4" /></summary>
      <div className="call-settings-content">
        <div className="call-settings-grid">
          <div className="call-settings-card"><div className="call-setting-title"><Gauge className="size-4" /><div><strong>Qualidade da transmissão</strong><p>{activeQuality ? `Meta ativa: ${screenShareProfiles[activeQuality].label}` : "720p a 60 fps é o padrão para vídeo e jogos; use 1080p a 60 fps em rede estável."}</p></div></div><div className="call-setting-actions"><label className="sr-only" htmlFor="screen-share-quality">Qualidade da tela compartilhada</label><select id="screen-share-quality" value={quality} onChange={event => setQuality(event.target.value as ScreenShareQuality)} disabled={isUpdatingShare} className="call-quality-select"><option value="540p30">540p · estável</option><option value="720p30">720p · equilibrado</option><option value="1080p30">1080p · equilibrado</option><option value="720p60">720p · 60 fps</option><option value="1080p60">1080p · 60 fps</option></select>{isScreenShareEnabled && activeQuality !== quality && <button type="button" className="call-secondary-button" onClick={() => void applyQuality()} disabled={isUpdatingShare}>Aplicar</button>}</div></div>
          <div className="call-settings-card"><div className="call-setting-title"><AudioLines className="size-4" /><div><strong>Áudio na transmissão</strong><p>O navegador só captura quando oferece uma trilha de áudio.</p></div></div><label className="call-share-audio-toggle"><input type="checkbox" checked={includeScreenShareAudio} onChange={event => setIncludeScreenShareAudio(event.target.checked)} disabled={isScreenShareEnabled || isUpdatingShare} /><span>Incluir áudio</span></label></div>
          <div className="call-settings-card"><div className="call-setting-title"><Keyboard className="size-4" /><div><strong>Microfone</strong><p>{pushToTalkEnabled ? `Aperte ${pushToTalkKeyLabel(pushToTalkKey)} para falar.` : "Redução de ruído e eco ativada quando o navegador oferece suporte."}</p></div></div><div className="call-setting-actions"><button type="button" className={cn("call-secondary-button", pushToTalkEnabled && "is-active")} onClick={() => void togglePushToTalk()}>{pushToTalkEnabled ? "Aperte para falar" : "Ativar aperte para falar"}</button>{pushToTalkEnabled && <button type="button" className={cn("call-secondary-button", isChoosingPushToTalkKey && "is-active")} onClick={() => setIsChoosingPushToTalkKey(true)}>{isChoosingPushToTalkKey ? "Pressione uma tecla…" : `Tecla: ${pushToTalkKeyLabel(pushToTalkKey)}`}</button>}</div></div>
          {diagnosticScreenShare && <div className="call-settings-card call-diagnostics-card"><div className="call-setting-title"><Activity className="size-4" /><div><strong>Diagnóstico da transmissão</strong><p>{mediaDiagnostic?.recommendation ?? "Aguardando métricas locais da transmissão…"}</p></div></div><div className="call-diagnostics-summary"><span className={cn("call-diagnostic-status", `is-${mediaDiagnostic?.status ?? "unavailable"}`)}>{mediaDiagnostic?.label ?? "Aguardando amostra"}</span><div className="call-diagnostic-metrics"><span>RTT <strong>{formatMediaMetric(mediaDiagnostic?.roundTripTimeMs, " ms")}</strong></span><span>Jitter <strong>{formatMediaMetric(mediaDiagnostic?.jitterMs, " ms")}</strong></span><span>Perda <strong>{formatMediaMetric(mediaDiagnostic?.packetLossPercent, "%")}</strong></span><span>Bitrate <strong>{formatMediaMetric(mediaDiagnostic?.bitrateKbps, " kbps")}</strong></span><span>FPS <strong>{formatMediaMetric(mediaDiagnostic?.framesPerSecond, "")}</strong></span></div></div></div>}
        </div>
        <div className="call-stream-mixer"><div className="call-stream-mixer-heading"><SlidersHorizontal className="size-4" /><div><strong>Mixer de transmissão</strong><p>O volume abaixo afeta apenas este dispositivo. Também está disponível ao clicar com o botão direito em uma transmissão.</p></div></div>{screenShareAudioTracks.length ? screenShareAudioTracks.map(track => <div key={trackKey(track)} className="call-stream-audio-row"><div className="call-stream-audio-title"><AudioLines className="size-4" /><span><strong>{displayName(track.participant)}</strong><small>Áudio da transmissão</small></span></div><button type="button" className={cn("call-mini-mute", mixFor(track).muted && "is-muted")} onClick={() => updateMix(track, { muted: !mixFor(track).muted })} aria-label="Alternar áudio da transmissão">{mixFor(track).muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}</button><input type="range" min="0" max="100" step="1" value={Math.round(mixFor(track).volume * 100)} onChange={event => updateMix(track, { volume: Number(event.target.value) / 100 })} aria-label={`Volume da transmissão de ${displayName(track.participant)}`} /><output>{Math.round(mixFor(track).volume * 100)}%</output></div>) : <p className="call-empty-mixer">Quando alguém compartilhar uma aba com áudio, o volume individual aparecerá aqui.</p>}</div>
      </div>
    </details>
    <p className="call-quality-note">Para reduzir travamentos, comece em 540p estável. Use 60 fps apenas quando a conexão, o navegador e o dispositivo sustentarem a taxa de quadros.</p>
    {shareError && <div role="alert" className="call-share-error"><p>{shareError}</p>{displayCaptureBlocked && isEmbeddedPreview && <a className="call-preview-help" href={window.location.href} target="_blank" rel="noreferrer">Abrir o Círculo em nova guia para compartilhar a tela</a>}</div>}
    <div className="call-audio-renderer" aria-hidden="true">{remoteAudioTracks.map(track => { const mix = mixFor(track); return <AudioTrack key={trackKey(track)} trackRef={track} volume={mix.volume} muted={mix.muted} autoPlay />; })}</div>
  </section>;
}
