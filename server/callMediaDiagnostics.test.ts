import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { collectCallMediaMetrics, diagnoseCallMedia, formatMediaMetric } from "../shared/callMediaDiagnostics";

const callRoomSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/CallRoom.tsx"), "utf8");

describe("diagnóstico de transmissão", () => {
  it("reduz temporariamente a camada do publicador quando a telemetria aponta congestionamento", () => {
    expect(callRoomSource).toContain("localScreenTrack.setPublishingQuality(shouldProtectMotion ? VideoQuality.MEDIUM : VideoQuality.HIGH)");
    expect(callRoomSource).toContain('setDegradationPreference(shouldProtectMotion ? "maintain-framerate" : "maintain-resolution")');
    expect(callRoomSource).toContain("Proteção adaptativa ativa");
  });

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

  it("não apresenta bitrate zero quando um contador WebRTC reinicia ou a trilha é substituída", () => {
    const report = new Map([
      ["outbound-video", { id: "outbound-video", type: "outbound-rtp", kind: "video", bytesSent: 800 }],
    ]) as unknown as RTCStatsReport;

    expect(collectCallMediaMetrics(report, 2_500, 1_200).bitrateKbps).toBeUndefined();
  });

  it("não mistura o contador da transmissão recebida com o da transmissão enviada", () => {
    const report = new Map([
      ["outbound-video", { id: "outbound-video", type: "outbound-rtp", kind: "video", bytesSent: 5_000 }],
      ["inbound-video", { id: "inbound-video", type: "inbound-rtp", kind: "video", bytesReceived: 2_000 }],
    ]) as unknown as RTCStatsReport;

    expect(collectCallMediaMetrics(report, 2_500, 1_000, "inbound").bitrateKbps).toBe(3);
    expect(collectCallMediaMetrics(report, 2_500, 1_000, "outbound").bitrateKbps).toBe(13);
  });
});
