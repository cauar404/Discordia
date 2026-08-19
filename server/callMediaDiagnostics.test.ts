import { describe, expect, it } from "vitest";
import { diagnoseCallMedia, formatMediaMetric } from "../shared/callMediaDiagnostics";

describe("diagnóstico de transmissão", () => {
  it("sinaliza rota instável por perda, jitter ou RTT elevado", () => {
    expect(diagnoseCallMedia({ packetLossPercent: 3.2 }).status).toBe("degraded");
    expect(diagnoseCallMedia({ jitterMs: 40 }).label).toBe("Rota instável");
    expect(diagnoseCallMedia({ roundTripTimeMs: 260 }).recommendation).toContain("720p/30");
  });

  it("diferencia limitação do codificador e uma rota saudável", () => {
    expect(diagnoseCallMedia({ qualityLimitationReason: "cpu" }).label).toBe("Codificação limitada");
    expect(diagnoseCallMedia({ packetLossPercent: 0, jitterMs: 4, roundTripTimeMs: 28 }).status).toBe("excellent");
  });

  it("formata métricas indisponíveis sem apresentar dados inventados", () => {
    expect(formatMediaMetric(undefined, " ms")).toBe("—");
    expect(formatMediaMetric(18, " ms")).toBe("18 ms");
  });
});
