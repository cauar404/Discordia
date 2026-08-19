import { API_REQUEST_TIMEOUT_MS, createRequestTimeout } from "@shared/requestTimeout";
import { describe, expect, it, vi } from "vitest";

describe("tempo limite das requisições do cliente", () => {
  it("interrompe uma requisição que não responde", () => {
    vi.useFakeTimers();
    const request = createRequestTimeout();

    vi.advanceTimersByTime(API_REQUEST_TIMEOUT_MS);

    expect(request.signal.aborted).toBe(true);
    expect(request.signal.reason).toBeInstanceOf(DOMException);
    request.dispose();
    vi.useRealTimers();
  });

  it("respeita o cancelamento de quem iniciou a requisição", () => {
    const upstream = new AbortController();
    const request = createRequestTimeout(upstream.signal);

    upstream.abort("navegação cancelada");

    expect(request.signal.aborted).toBe(true);
    expect(request.signal.reason).toBe("navegação cancelada");
    request.dispose();
  });
});
