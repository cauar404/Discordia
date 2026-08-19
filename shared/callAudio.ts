export const DEFAULT_REMOTE_CALL_VOLUME = 0.85;

export function normalizeRemoteCallVolume(value: unknown, fallback = DEFAULT_REMOTE_CALL_VOLUME) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(1, Math.max(0, numericValue));
}

export function remoteCallVolumeLabel(value: unknown) {
  return `${Math.round(normalizeRemoteCallVolume(value) * 100)}%`;
}

export function getScreenShareAudioOptions(includeAudio: boolean) {
  return includeAudio
    ? {
        audio: {
          channelCount: 2,
          sampleRate: 48_000,
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
          restrictOwnAudio: true,
        },
        systemAudio: "include" as const,
        suppressLocalAudioPlayback: false,
      }
    : { audio: false, systemAudio: "exclude" as const, suppressLocalAudioPlayback: false };
}
