export function getCallGridSummary(participantCount: number, screenShareCount: number) {
  const participants = Math.max(0, participantCount);
  const screenShares = Math.max(0, screenShareCount);
  return {
    itemCount: participants + screenShares,
    hasScreenShares: screenShares > 0,
    screenShareLabel: `${screenShares} ${screenShares === 1 ? "transmissão" : "transmissões"}`,
  };
}

export function shouldShowFocusedScreenStage(focusedScreenShareKey: string | null | undefined) {
  return Boolean(focusedScreenShareKey);
}
