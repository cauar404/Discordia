import { DefaultReconnectPolicy, type RoomOptions } from "livekit-client";

export const livekitReconnectDelaysMs = [0, 300, 1_200, 2_700, 4_800, 7_000, 7_000] as const;

export const livekitRoomOptions: RoomOptions = {
  adaptiveStream: {
    pixelDensity: "screen",
    pauseVideoInBackground: true,
  },
  dynacast: true,
  reconnectPolicy: new DefaultReconnectPolicy([...livekitReconnectDelaysMs]),
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
