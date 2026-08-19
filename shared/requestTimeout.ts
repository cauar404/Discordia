export const API_REQUEST_TIMEOUT_MS = 15_000;

export type RequestTimeout = {
  signal: AbortSignal;
  dispose: () => void;
};

export function createRequestTimeout(
  upstreamSignal?: AbortSignal | null,
  timeoutMs = API_REQUEST_TIMEOUT_MS,
): RequestTimeout {
  const controller = new AbortController();
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  const timeoutId = setTimeout(() => {
    controller.abort(new DOMException("A requisição demorou demais para responder.", "TimeoutError"));
  }, timeoutMs);

  if (upstreamSignal) {
    if (upstreamSignal.aborted) abortFromUpstream();
    else upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener("abort", abortFromUpstream);
    },
  };
}
