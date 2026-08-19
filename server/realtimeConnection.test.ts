import { describe, expect, it } from "vitest";
import { realtimeConnectionOptions } from "../client/src/lib/realtimeConnection";

describe("conexão em tempo real", () => {
  it("prioriza WebSocket direto e recupera a conexão rapidamente", () => {
    expect(realtimeConnectionOptions).toMatchObject({
      path: "/api/realtime",
      transports: ["websocket"],
      withCredentials: true,
      timeout: 10_000,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3_000,
    });
  });
});
