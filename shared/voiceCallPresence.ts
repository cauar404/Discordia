export type VoiceCallRecord = { id: number; channelId: number | null };
export type VoiceCallParticipant = { callId: number; userId: number; displayName: string | null; avatarKey: string | null };

export function groupVoiceCallPresence(calls: VoiceCallRecord[], participants: VoiceCallParticipant[]) {
  const participantsByCall = new Map<number, Omit<VoiceCallParticipant, "callId">[]>();
  for (const participant of participants) {
    const current = participantsByCall.get(participant.callId) ?? [];
    current.push({ userId: participant.userId, displayName: participant.displayName, avatarKey: participant.avatarKey });
    participantsByCall.set(participant.callId, current);
  }
  return calls.flatMap(call => call.channelId === null ? [] : [{ channelId: call.channelId, participants: participantsByCall.get(call.id) ?? [] }]).filter(entry => entry.participants.length > 0);
}
