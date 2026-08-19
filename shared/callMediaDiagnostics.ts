export type CallMediaDiagnosticStatus = "excellent" | "watch" | "degraded" | "unavailable";

export type CallMediaMetrics = {
  roundTripTimeMs?: number;
  jitterMs?: number;
  packetLossPercent?: number;
  bitrateKbps?: number;
  framesDropped?: number;
  framesPerSecond?: number;
  qualityLimitationReason?: string;
  candidatePair?: {
    protocol?: string;
    localCandidateType?: string;
    remoteCandidateType?: string;
    relayProtocol?: string;
    usesRelay: boolean;
  };
};

export type CallMediaDiagnostic = CallMediaMetrics & {
  status: CallMediaDiagnosticStatus;
  label: string;
  recommendation: string;
};

type VideoStatsRecord = {
  id?: string;
  type: string;
  kind?: string;
  state?: string;
  nominated?: boolean;
  localCandidateId?: string;
  remoteCandidateId?: string;
  candidateType?: string;
  protocol?: string;
  relayProtocol?: string;
  bytesSent?: number;
  bytesReceived?: number;
  packetsLost?: number;
  packetsReceived?: number;
  jitter?: number;
  roundTripTime?: number;
  currentRoundTripTime?: number;
  framesDropped?: number;
  framesPerSecond?: number;
  qualityLimitationReason?: string;
};

function milliseconds(value?: number) {
  return value === undefined || !Number.isFinite(value) ? undefined : Math.round(value * 1_000);
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function collectCallMediaMetrics(report: RTCStatsReport, elapsedMs: number, previousBytes?: number): CallMediaMetrics {
  let inbound: VideoStatsRecord | undefined;
  let outbound: VideoStatsRecord | undefined;
  let remoteInbound: VideoStatsRecord | undefined;
  let candidatePair: VideoStatsRecord | undefined;
  const candidates = new Map<string, VideoStatsRecord>();

  report.forEach(stat => {
    const record = stat as unknown as VideoStatsRecord;
    if (record.type === "inbound-rtp" && record.kind === "video") inbound ??= record;
    if (record.type === "outbound-rtp" && record.kind === "video") outbound ??= record;
    if (record.type === "remote-inbound-rtp" && record.kind === "video") remoteInbound ??= record;
    if (record.type === "candidate-pair" && record.state === "succeeded" && record.nominated) candidatePair ??= record;
    if ((record.type === "local-candidate" || record.type === "remote-candidate") && typeof record.id === "string") candidates.set(record.id, record);
  });

  const packetsLost = asNumber(inbound?.packetsLost) ?? asNumber(remoteInbound?.packetsLost);
  const packetsReceived = asNumber(inbound?.packetsReceived) ?? asNumber(remoteInbound?.packetsReceived);
  const totalPackets = packetsLost !== undefined && packetsReceived !== undefined ? packetsLost + packetsReceived : undefined;
  const bytes = asNumber(outbound?.bytesSent) ?? asNumber(inbound?.bytesReceived);
  const localCandidate = candidatePair?.localCandidateId ? candidates.get(candidatePair.localCandidateId) : undefined;
  const remoteCandidate = candidatePair?.remoteCandidateId ? candidates.get(candidatePair.remoteCandidateId) : undefined;
  const candidateRoute = candidatePair ? {
    protocol: localCandidate?.protocol ?? remoteCandidate?.protocol,
    localCandidateType: localCandidate?.candidateType,
    remoteCandidateType: remoteCandidate?.candidateType,
    relayProtocol: localCandidate?.relayProtocol ?? remoteCandidate?.relayProtocol,
    usesRelay: localCandidate?.candidateType === "relay" || remoteCandidate?.candidateType === "relay",
  } : undefined;
  return {
    roundTripTimeMs: milliseconds(asNumber(remoteInbound?.roundTripTime) ?? asNumber(candidatePair?.currentRoundTripTime)),
    jitterMs: milliseconds(asNumber(inbound?.jitter) ?? asNumber(remoteInbound?.jitter)),
    packetLossPercent: totalPackets && totalPackets > 0 && packetsLost !== undefined ? Number(((packetsLost / totalPackets) * 100).toFixed(1)) : undefined,
    // Um contador que recua indica troca/reinicialização da trilha, não bitrate zero.
    bitrateKbps: bytes !== undefined && previousBytes !== undefined && bytes >= previousBytes && elapsedMs > 0 ? Math.round(((bytes - previousBytes) * 8) / elapsedMs) : undefined,
    framesDropped: asNumber(inbound?.framesDropped),
    framesPerSecond: asNumber(inbound?.framesPerSecond) ?? asNumber(outbound?.framesPerSecond),
    qualityLimitationReason: typeof outbound?.qualityLimitationReason === "string" && outbound.qualityLimitationReason !== "none" ? outbound.qualityLimitationReason : undefined,
    candidatePair: candidateRoute,
  };
}

export function diagnoseCallMedia(metrics?: CallMediaMetrics): CallMediaDiagnostic {
  if (!metrics) return { status: "unavailable", label: "Aguardando amostra", recommendation: "As métricas aparecerão alguns segundos após a transmissão começar." };
  const reason = metrics.qualityLimitationReason;
  if (reason === "cpu") return { ...metrics, status: "degraded", label: "Codificação limitada", recommendation: "O navegador limitou a codificação. Reduza para 720p/30 ou feche processos que usem aceleração de vídeo." };
  if (reason === "bandwidth" || (metrics.packetLossPercent ?? 0) >= 3 || (metrics.roundTripTimeMs ?? 0) >= 250 || (metrics.jitterMs ?? 0) >= 35) {
    return { ...metrics, status: "degraded", label: "Rota instável", recommendation: "Há perda, jitter ou latência na rota de mídia. Use 720p/30, aproxime-se do roteador ou teste outra rede; velocidade contratada não elimina perda de pacotes." };
  }
  if ((metrics.packetLossPercent ?? 0) >= 1 || (metrics.roundTripTimeMs ?? 0) >= 120 || (metrics.jitterMs ?? 0) >= 15 || (metrics.framesDropped ?? 0) > 20) {
    return { ...metrics, status: "watch", label: "Atenção à estabilidade", recommendation: "A transmissão ainda funciona, mas há sinais de oscilação. Mantenha 720p/30 até os valores estabilizarem." };
  }
  return { ...metrics, status: "excellent", label: "Transmissão estável", recommendation: "A rota está estável. Aumente a qualidade gradualmente e use 60 fps apenas para conteúdo com movimento." };
}

export function formatMediaMetric(value: number | undefined, suffix: string, empty = "—") {
  return value === undefined ? empty : `${value}${suffix}`;
}
