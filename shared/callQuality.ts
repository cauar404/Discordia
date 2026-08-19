export const screenShareProfiles = {
  "720p60": {
    label: "720p · 60 fps",
    shortLabel: "720p/60",
    resolution: { width: 1280, height: 720, frameRate: 60 },
    encoding: { maxBitrate: 4_000_000, maxFramerate: 60 },
  },
  "1080p60": {
    label: "1080p · 60 fps",
    shortLabel: "1080p/60",
    resolution: { width: 1920, height: 1080, frameRate: 60 },
    encoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
  },
} as const;

export type ScreenShareQuality = keyof typeof screenShareProfiles;
