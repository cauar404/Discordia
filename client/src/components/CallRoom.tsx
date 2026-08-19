import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoomAudioRenderer, VideoTrack, useLocalParticipant, useParticipants, useTracks, type TrackReference } from "@livekit/components-react";
import { Keyboard, Maximize2, Minimize2, MonitorUp, Mic, MicOff, PhoneOff, ScreenShare, Users, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Track } from "livekit-client";
import { screenShareProfiles, type ScreenShareQuality } from "@shared/callQuality";
import { getScreenShareAudioOptions, normalizeRemoteCallVolume, remoteCallVolumeLabel } from "@shared/callAudio";
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

function ParticipantCard({ participant, cameraTrack }: { participant: { identity: string; name?: string; isSpeaking?: boolean }; cameraTrack?: TrackReference }) {
  const name = displayName(participant);
  return <article className={cn("call-participant-card", participant.isSpeaking && "is-speaking")}>
    <div className="call-participant-video">
      {cameraTrack ? <VideoTrack trackRef={cameraTrack} className="size-full object-cover" /> : <div className="call-avatar" aria-label={`${name}, câmera desativada`}>{initials(name)}</div>}
      <div className="call-participant-meta"><span className={cn("call-speaking-dot", participant.isSpeaking && "is-active")} /><strong>{name}</strong></div>
      {!cameraTrack && <span className="call-camera-off"><VideoOff className="size-3.5" /> Câmera desligada</span>}
    </div>
  </article>;
}

export function CallRoom({ kind, onLeave, voiceVideoSettings, onVoiceVideoSettingsChange }: { kind: CallKind; onLeave: () => void | Promise<void>; voiceVideoSettings?: VoiceVideoSettings; onVoiceVideoSettingsChange?: (settings: VoiceVideoSettings) => void | Promise<unknown> }) {
  const participants = useParticipants();
  const mediaTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare]);
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [quality, setQuality] = useState<ScreenShareQuality>("1080p60");
  const [includeScreenShareAudio, setIncludeScreenShareAudio] = useState(true);
  const [remoteAudioVolume, setRemoteAudioVolume] = useState(0.85);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);
  const [activeQuality, setActiveQuality] = useState<ScreenShareQuality | null>(null);
  const [isUpdatingShare, setIsUpdatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [displayCaptureBlocked, setDisplayCaptureBlocked] = useState(false);
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(voiceVideoSettings?.pushToTalk === true);
  const [pushToTalkKey, setPushToTalkKey] = useState(typeof voiceVideoSettings?.pushToTalkKey === "string" ? voiceVideoSettings.pushToTalkKey : "Space");
  const [isChoosingPushToTalkKey, setIsChoosingPushToTalkKey] = useState(false);
  const [isPushToTalkPressed, setIsPushToTalkPressed] = useState(false);
  const stageRef = useRef<HTMLElement | null>(null);
  const pushToTalkSequenceRef = useRef(0);
  const isEmbeddedPreview = typeof window !== "undefined" && window.top !== window.self;

  const tracks = useMemo(() => mediaTracks.filter((track): track is TrackReference => track.publication !== undefined), [mediaTracks]);
  const cameraTracks = useMemo(() => new Map(tracks.filter(track => track.source === Track.Source.Camera).map(track => [track.participant.identity, track])), [tracks]);
  const screenShares = useMemo(() => tracks.filter(track => track.source === Track.Source.ScreenShare), [tracks]);
  const primaryScreenShare = screenShares[0];

  useEffect(() => {
    if (!isScreenShareEnabled) setActiveQuality(null);
  }, [isScreenShareEnabled]);

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
      if (event.key === "Escape") {
        setIsChoosingPushToTalkKey(false);
        return;
      }
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
      } catch {
        setShareError("Não foi possível alterar o microfone para aperte-para-falar.");
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.code !== pushToTalkKey || event.repeat) return;
      event.preventDefault();
      setIsPushToTalkPressed(true);
      void updateMicrophone(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== pushToTalkKey) return;
      event.preventDefault();
      setIsPushToTalkPressed(false);
      void updateMicrophone(false);
    };
    const releaseOnBlur = () => {
      setIsPushToTalkPressed(false);
      void updateMicrophone(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", releaseOnBlur);
    document.addEventListener("visibilitychange", releaseOnBlur);
    void localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", releaseOnBlur);
      document.removeEventListener("visibilitychange", releaseOnBlur);
      void localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
    };
  }, [isChoosingPushToTalkKey, localParticipant, pushToTalkEnabled, pushToTalkKey]);

  async function toggleMicrophone() {
    if (pushToTalkEnabled) return;
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      setShareError("Não foi possível alterar o microfone. Verifique a permissão do navegador.");
    }
  }

  async function toggleCamera() {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {
      setShareError("Não foi possível alterar a câmera. Verifique a permissão do navegador.");
    }
  }

  async function startScreenShare(nextQuality = quality) {
    const profile = screenShareProfiles[nextQuality];
    setShareError(null);
    setDisplayCaptureBlocked(false);
    setIsUpdatingShare(true);
    try {
      await localParticipant.setScreenShareEnabled(true, {
        video: true,
        ...getScreenShareAudioOptions(includeScreenShareAudio),
        resolution: profile.resolution,
        contentHint: "detail",
        selfBrowserSurface: "include",
        surfaceSwitching: "include",
      }, {
        screenShareEncoding: profile.encoding,
        simulcast: true,
        degradationPreference: "maintain-resolution",
      });
      setActiveQuality(nextQuality);
    } catch (error) {
      const message = error instanceof Error ? error.message : "O navegador não permitiu iniciar o compartilhamento de tela.";
      const blockedByPreviewPolicy = isDisplayCapturePolicyError(error);
      setDisplayCaptureBlocked(blockedByPreviewPolicy);
      setShareError(blockedByPreviewPolicy ? "A pré-visualização incorporada bloqueou a captura de tela por política de permissões." : message);
    } finally {
      setIsUpdatingShare(false);
    }
  }

  async function toggleScreenShare() {
    if (!isScreenShareEnabled) {
      await startScreenShare();
      return;
    }
    setShareError(null);
    setIsUpdatingShare(true);
    try {
      await localParticipant.setScreenShareEnabled(false);
      setActiveQuality(null);
    } catch {
      setShareError("Não foi possível interromper o compartilhamento de tela.");
    } finally {
      setIsUpdatingShare(false);
    }
  }

  async function applyQuality() {
    if (!isScreenShareEnabled) return;
    setIsUpdatingShare(true);
    try {
      await localParticipant.setScreenShareEnabled(false);
      await startScreenShare(quality);
    } catch {
      setShareError("Não foi possível reaplicar a qualidade selecionada.");
      setIsUpdatingShare(false);
    }
  }

  async function toggleStageFullscreen() {
    const stage = stageRef.current;
    if (!stage || typeof document === "undefined") return;
    setShareError(null);
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
      } else if ("requestFullscreen" in stage) {
        await stage.requestFullscreen();
      } else {
        setShareError("Seu navegador não oferece tela cheia para esta visualização.");
      }
    } catch {
      setShareError("Não foi possível alternar a tela cheia. Verifique a permissão do navegador.");
    }
  }

  async function togglePushToTalk() {
    const nextEnabled = !pushToTalkEnabled;
    setPushToTalkEnabled(nextEnabled);
    setIsChoosingPushToTalkKey(false);
    try {
      await localParticipant.setMicrophoneEnabled(!nextEnabled);
      await onVoiceVideoSettingsChange?.({ pushToTalk: nextEnabled, pushToTalkKey });
    } catch {
      setPushToTalkEnabled(!nextEnabled);
      setShareError("Não foi possível atualizar o aperte-para-falar.");
    }
  }

  function setCallOutputVolume(value: number) {
    const nextVolume = normalizeRemoteCallVolume(value);
    setRemoteAudioVolume(nextVolume);
    if (nextVolume > 0 && isRemoteAudioMuted) setIsRemoteAudioMuted(false);
  }

  function toggleRemoteAudioMuted() {
    setIsRemoteAudioMuted(current => !current);
  }

  const stageLabel = primaryScreenShare ? `${displayName(primaryScreenShare.participant)} está compartilhando a tela` : "Aguardando compartilhamento de tela";

  return <section className="call-room" aria-label="Sala de chamada">
    <header className="call-topbar">
      <div className="flex min-w-0 items-center gap-3"><span className="live-indicator" /><div className="min-w-0"><strong className="block truncate">{kind === "video" ? "Chamada de vídeo" : "Chamada de voz"}</strong><span className="flex items-center gap-1 text-xs text-slate-400"><Users className="size-3.5" /> {participants.length} {participants.length === 1 ? "participante" : "participantes"}</span></div></div>
      <Button variant="destructive" className="shrink-0 bg-rose-500 hover:bg-rose-400" onClick={() => void onLeave()}><PhoneOff className="size-4" />Sair</Button>
    </header>

    <div className="call-main">
      <section ref={stageRef} className="call-stage" aria-label={stageLabel}>
        {primaryScreenShare ? <><VideoTrack trackRef={primaryScreenShare} className="call-screen-video" /><div className="call-screen-caption"><MonitorUp className="size-4" /><span>{stageLabel}</span></div><button type="button" className="call-fullscreen-control" onClick={() => void toggleStageFullscreen()} aria-label={isStageFullscreen ? "Sair da tela cheia" : "Ver tela compartilhada em tela cheia"} title={isStageFullscreen ? "Sair da tela cheia" : "Tela cheia"}>{isStageFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button></> : <div className="call-stage-empty"><MonitorUp className="size-8" /><h2>Tela compartilhada aparece aqui</h2><p>Quando alguém compartilhar uma janela, aba ou monitor, a visualização será exibida dentro do Círculo.</p></div>}
      </section>

      <section className="call-participant-area" aria-label="Participantes na chamada">
        <div className="call-section-heading"><span>NA CHAMADA</span><span>{participants.length}</span></div>
        <div className={cn("call-participant-grid", participants.length === 1 && "is-solo")}>{participants.map(participant => <ParticipantCard key={participant.identity} participant={participant} cameraTrack={cameraTracks.get(participant.identity)} />)}</div>
      </section>
    </div>

    <footer className="call-controls-wrap">
      <div className="call-quality-row">
        <div className="min-w-0"><span className="call-control-label">Qualidade ao compartilhar</span><p>{activeQuality ? `Preferência ativa: ${screenShareProfiles[activeQuality].label}` : "Selecione antes de compartilhar"}</p></div>
        <div className="flex items-center gap-2"><label className="sr-only" htmlFor="screen-share-quality">Qualidade da tela compartilhada</label><select id="screen-share-quality" value={quality} onChange={event => setQuality(event.target.value as ScreenShareQuality)} disabled={isUpdatingShare} className="call-quality-select"><option value="720p60">720p · 60 fps</option><option value="1080p60">1080p · 60 fps</option></select>{isScreenShareEnabled && activeQuality !== quality && <Button type="button" variant="outline" onClick={() => void applyQuality()} disabled={isUpdatingShare} className="call-apply-quality">Aplicar</Button>}</div>
      </div>
      <div className="call-audio-row">
        <div className="min-w-0"><span className="call-control-label">Áudio da transmissão</span><p>{includeScreenShareAudio ? "Solicitar áudio da aba ou do sistema ao compartilhar." : "A tela será compartilhada sem áudio."}</p></div>
        <label className="call-share-audio-toggle"><input type="checkbox" checked={includeScreenShareAudio} onChange={event => setIncludeScreenShareAudio(event.target.checked)} disabled={isScreenShareEnabled || isUpdatingShare} /><span>Incluir áudio</span></label>
      </div>
      <div className="call-audio-row">
        <div className="min-w-0"><span className="call-control-label">Volume da chamada</span><p>{isRemoteAudioMuted ? "Áudio remoto silenciado neste dispositivo." : `Áudio remoto em ${remoteCallVolumeLabel(remoteAudioVolume)}.`}</p></div>
        <div className="call-volume-control"><button type="button" className={cn("call-volume-mute", isRemoteAudioMuted && "is-muted")} onClick={toggleRemoteAudioMuted} aria-label={isRemoteAudioMuted ? "Ativar áudio remoto" : "Silenciar áudio remoto"} title={isRemoteAudioMuted ? "Ativar áudio remoto" : "Silenciar áudio remoto"}>{isRemoteAudioMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button><label className="sr-only" htmlFor="call-output-volume">Volume da chamada</label><input id="call-output-volume" type="range" min="0" max="100" step="1" value={Math.round(remoteAudioVolume * 100)} onChange={event => setCallOutputVolume(Number(event.target.value) / 100)} aria-valuetext={`${remoteCallVolumeLabel(remoteAudioVolume)} de volume da chamada`} /><output aria-live="polite">{remoteCallVolumeLabel(remoteAudioVolume)}</output></div>
      </div>
      <div className="call-ptt-row">
        <div className="min-w-0"><span className="call-control-label">Microfone</span><p>{pushToTalkEnabled ? `Aperte ${pushToTalkKeyLabel(pushToTalkKey)} para falar.` : "Microfone em modo contínuo."}</p></div>
        <div className="call-ptt-actions"><button type="button" className={cn("call-ptt-toggle", pushToTalkEnabled && "is-active")} onClick={() => void togglePushToTalk()} aria-pressed={pushToTalkEnabled}><Keyboard className="size-3.5" />{pushToTalkEnabled ? "Aperte para falar" : "Ativar aperte para falar"}</button>{pushToTalkEnabled && <button type="button" className={cn("call-key-binding", isChoosingPushToTalkKey && "is-capturing")} onClick={() => setIsChoosingPushToTalkKey(true)}>{isChoosingPushToTalkKey ? "Pressione uma tecla…" : `Tecla: ${pushToTalkKeyLabel(pushToTalkKey)}`}</button>}</div>
      </div>
      <div className="call-controls">
        <button type="button" className={cn("call-control", !isMicrophoneEnabled && "is-off", pushToTalkEnabled && "is-active")} onClick={() => void toggleMicrophone()} disabled={pushToTalkEnabled} aria-label={pushToTalkEnabled ? `Aperte ${pushToTalkKeyLabel(pushToTalkKey)} para falar` : isMicrophoneEnabled ? "Desativar microfone" : "Ativar microfone"}>{pushToTalkEnabled ? <Mic className="size-5" /> : isMicrophoneEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}<span>{pushToTalkEnabled ? (isPushToTalkPressed ? "Falando…" : "Aperte a tecla") : "Microfone"}</span></button>
        <button type="button" className={cn("call-control", !isCameraEnabled && "is-off")} onClick={() => void toggleCamera()} aria-label={isCameraEnabled ? "Desativar câmera" : "Ativar câmera"}>{isCameraEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}<span>Câmera</span></button>
        <button type="button" className={cn("call-control", isScreenShareEnabled && "is-active")} onClick={() => void toggleScreenShare()} disabled={isUpdatingShare} aria-label={isScreenShareEnabled ? "Parar compartilhamento" : `Compartilhar tela em ${screenShareProfiles[quality].shortLabel}`}>{<ScreenShare className="size-5" />}<span>{isScreenShareEnabled ? "Parar tela" : "Compartilhar"}</span></button>
      </div>
      <p className="call-quality-note">Ao compartilhar com áudio, marque também a opção de compartilhar áudio exibida pelo navegador. A disponibilidade depende da aba, do sistema operacional e do navegador. A qualidade da transmissão também pode ser reduzida pela rede ou pelo dispositivo.</p>
      {shareError && <div role="alert" className="call-share-error"><p>{shareError}</p>{displayCaptureBlocked && isEmbeddedPreview && <a className="call-preview-help" href={window.location.href} target="_blank" rel="noreferrer">Abrir o Círculo em nova guia para compartilhar a tela</a>}</div>}
    </footer>
    <RoomAudioRenderer volume={remoteAudioVolume} muted={isRemoteAudioMuted} />
  </section>;
}
