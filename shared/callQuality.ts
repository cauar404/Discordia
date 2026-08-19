import { VideoPreset } from "livekit-client";

export const screenShareProfiles = {
  "540p30": {
    label: "540p · estável",
    shortLabel: "540p/30",
    resolution: { width: 960, height: 540, frameRate: 30 },
    encoding: { maxBitrate: 1_600_000, maxFramerate: 30 },
    simulcastLayers: [new VideoPreset(480, 270, 450_000, 30), new VideoPreset(720, 405, 1_000_000, 30)] as VideoPreset[],
  },
  "720p30": {
    label: "720p · equilibrado",
    shortLabel: "720p/30",
    resolution: { width: 1280, height: 720, frameRate: 30 },
    encoding: { maxBitrate: 3_400_000, maxFramerate: 30 },
    simulcastLayers: [new VideoPreset(480, 270, 600_000, 30), new VideoPreset(960, 540, 1_600_000, 30)] as VideoPreset[],
  },
  "1080p30": {
    label: "1080p · equilibrado",
    shortLabel: "1080p/30",
    resolution: { width: 1920, height: 1080, frameRate: 30 },
    encoding: { maxBitrate: 6_500_000, maxFramerate: 30 },
    simulcastLayers: [new VideoPreset(640, 360, 900_000, 30), new VideoPreset(1280, 720, 3_500_000, 30)] as VideoPreset[],
  },
  "720p60": {
    label: "720p · 60 fps",
    shortLabel: "720p/60",
    resolution: { width: 1280, height: 720, frameRate: 60 },
    encoding: { maxBitrate: 6_000_000, maxFramerate: 60 },
    simulcastLayers: [new VideoPreset(480, 270, 900_000, 30), new VideoPreset(960, 540, 3_200_000, 60)] as VideoPreset[],
  },
  "1080p60": {
    label: "1080p · 60 fps",
    shortLabel: "1080p/60",
    resolution: { width: 1920, height: 1080, frameRate: 60 },
    encoding: { maxBitrate: 10_000_000, maxFramerate: 60 },
    simulcastLayers: [new VideoPreset(640, 360, 1_000_000, 30), new VideoPreset(1280, 720, 5_500_000, 60)] as VideoPreset[],
  },
} as const;

export type ScreenShareQuality = keyof typeof screenShareProfiles;

export function getScreenSharePublishOptions(quality: ScreenShareQuality) {
  return {
    screenShareEncoding: screenShareProfiles[quality].encoding,
    screenShareSimulcastLayers: screenShareProfiles[quality].simulcastLayers,
    simulcast: true,
    degradationPreference: (quality.endsWith("60") ? "maintain-framerate" : "maintain-resolution") as RTCDegradationPreference,
  };
}
