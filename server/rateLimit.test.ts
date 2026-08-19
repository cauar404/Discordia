import { afterEach, describe, expect, it } from "vitest";
import { clearRateLimitsForTests, consumeRateLimit } from "./rateLimit";

afterEach(clearRateLimitsForTests);

describe("limitação de requisições", () => {
  it("aceita mensagens até o limite e bloqueia a próxima dentro da janela", () => {
    expect(consumeRateLimit("message:1", 2, 10_000, 1_000)).toBe(true);
    expect(consumeRateLimit("message:1", 2, 10_000, 1_001)).toBe(true);
    expect(consumeRateLimit("message:1", 2, 10_000, 1_002)).toBe(false);
  });

  it("permite novo envio quando a janela expira", () => {
    expect(consumeRateLimit("message:1", 1, 1_000, 1_000)).toBe(true);
    expect(consumeRateLimit("message:1", 1, 1_000, 2_001)).toBe(true);
  });
});
