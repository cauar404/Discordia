export type IndividualAudioMix = {
  volume: number;
  muted: boolean;
};

export type IndividualAudioMixes = Record<string, IndividualAudioMix>;
export const INDIVIDUAL_AUDIO_MIX_STORAGE_KEY = "circulo.call-audio-mix.v1";

export const DEFAULT_INDIVIDUAL_AUDIO_MIX: IndividualAudioMix = {
  volume: 1,
  muted: false,
};

export function normalizeIndividualAudioMix(value?: Partial<IndividualAudioMix> | null): IndividualAudioMix {
  const numericVolume = typeof value?.volume === "number" && Number.isFinite(value.volume) ? value.volume : DEFAULT_INDIVIDUAL_AUDIO_MIX.volume;
  return {
    volume: Math.round(Math.min(1, Math.max(0, numericVolume)) * 100) / 100,
    muted: value?.muted === true,
  };
}

export function audioMixKey(identity: string, source: string, trackSid?: string) {
  return `${identity}:${source}:${trackSid || "active"}`;
}

export function updateIndividualAudioMix(current: IndividualAudioMixes, key: string, update: Partial<IndividualAudioMix>): IndividualAudioMixes {
  return {
    ...current,
    [key]: normalizeIndividualAudioMix({ ...current[key], ...update }),
  };
}

export function deserializeIndividualAudioMixes(value?: string | null): IndividualAudioMixes {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, Partial<IndividualAudioMix>>).map(([key, mix]) => [key, normalizeIndividualAudioMix(mix)]));
  } catch {
    return {};
  }
}

export function serializeIndividualAudioMixes(mixes: IndividualAudioMixes) {
  return JSON.stringify(Object.fromEntries(Object.entries(mixes).map(([key, mix]) => [key, normalizeIndividualAudioMix(mix)])));
}
