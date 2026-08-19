import type { RoomOptions } from "livekit-client";

export const livekitRoomOptions: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    voiceIsolation: true,
    channelCount: 1,
  },
  publishDefaults: {
    dtx: true,
    red: true,
    simulcast: true,
    forceStereo: false,
  },
};
