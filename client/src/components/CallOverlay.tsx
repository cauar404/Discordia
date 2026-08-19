import { CallRoom } from "@/components/CallRoom";
import { livekitRoomOptions } from "@/lib/livekitOptions";
import { LiveKitRoom } from "@livekit/components-react";

type ActiveCall = {
  callId: number;
  serverUrl: string;
  token: string;
  kind: "voice" | "video";
};

type VoiceVideoSettings = Record<string, string | boolean>;

export default function CallOverlay({ call, onLeave, isMinimized = false, onMinimize, onRestore, voiceVideoSettings, onVoiceVideoSettingsChange, microphoneToggleSignal, onMicrophoneStateChange }: {
  call: ActiveCall;
  onLeave: () => void | Promise<void>;
  isMinimized?: boolean;
  onMinimize?: () => void;
  onRestore?: () => void;
  voiceVideoSettings?: VoiceVideoSettings;
  onVoiceVideoSettingsChange?: (settings: VoiceVideoSettings) => void | Promise<unknown>;
  microphoneToggleSignal?: number;
  onMicrophoneStateChange?: (enabled: boolean) => void;
}) {
  return <div className={isMinimized ? "call-overlay is-minimized" : "call-overlay"}>
    <LiveKitRoom serverUrl={call.serverUrl} token={call.token} connect audio video={call.kind === "video"} options={livekitRoomOptions} onDisconnected={() => void onLeave()}>
      <CallRoom kind={call.kind} onLeave={onLeave} isMinimized={isMinimized} onMinimize={onMinimize} onRestore={onRestore} voiceVideoSettings={voiceVideoSettings} onVoiceVideoSettingsChange={onVoiceVideoSettingsChange} microphoneToggleSignal={microphoneToggleSignal} onMicrophoneStateChange={onMicrophoneStateChange} />
    </LiveKitRoom>
  </div>;
}
