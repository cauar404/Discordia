import { describe, expect, it } from "vitest";
import { collectCallMediaMetrics, diagnoseCallMedia, formatMediaMetric } from "../shared/callMediaDiagnostics";

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

  it("identifica o candidate pair nominado sem expor endereços de rede", () => {
    const report = new Map([
      ["pair-1", { id: "pair-1", type: "candidate-pair", state: "succeeded", nominated: true, localCandidateId: "local-1", remoteCandidateId: "remote-1", currentRoundTripTime: 0.024 }],
      ["local-1", { id: "local-1", type: "local-candidate", candidateType: "relay", protocol: "udp", relayProtocol: "udp" }],
      ["remote-1", { id: "remote-1", type: "remote-candidate", candidateType: "srflx", protocol: "udp" }],
    ]) as unknown as RTCStatsReport;

    expect(collectCallMediaMetrics(report, 2_500)).toMatchObject({
      roundTripTimeMs: 24,
      candidatePair: { protocol: "udp", localCandidateType: "relay", remoteCandidateType: "srflx", relayProtocol: "udp", usesRelay: true },
    });
  });
});
