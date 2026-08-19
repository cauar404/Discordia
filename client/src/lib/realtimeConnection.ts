import type { ManagerOptions, SocketOptions } from "socket.io-client";

export const realtimeConnectionOptions: Partial<ManagerOptions & SocketOptions> = {
  path: "/api/realtime",
  transports: ["websocket"],
  withCredentials: true,
  timeout: 10_000,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3_000,
  randomizationFactor: 0.35,
};
