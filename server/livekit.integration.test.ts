import { RoomServiceClient } from "livekit-server-sdk";
import { describe, expect, it } from "vitest";

const livekitUrl = process.env.LIVEKIT_URL;
const livekitKey = process.env.LIVEKIT_API_KEY;
const livekitSecret = process.env.LIVEKIT_API_SECRET;
const configured = Boolean(livekitUrl && livekitKey && livekitSecret);

describe("LiveKit configuration", () => {
  it.skipIf(!configured)("authenticates with the configured room service", async () => {
    const baseUrl = livekitUrl!.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const client = new RoomServiceClient(baseUrl, livekitKey!, livekitSecret!);

    const rooms = await client.listRooms([]);

    expect(Array.isArray(rooms)).toBe(true);
  }, 20_000);
});
