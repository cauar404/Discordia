export function isApprovedAccess(user: { role: string; accessState: string }) {
  return user.role === "admin" || user.accessState === "approved";
}

export function hasPermission(grants: ReadonlyArray<ReadonlyArray<string> | null | undefined>, permission: string) {
  return grants.some(grant => Boolean(grant?.includes("administrator") || grant?.includes(permission)));
}

export function isTimeoutActive(expiresAt: Date | null, now = new Date()) {
  return !expiresAt || expiresAt > now;
}

export function canManageRole(actorPositions: readonly number[], targetPosition: number, isSystemAdmin = false) {
  if (isSystemAdmin) return true;
  const highestPosition = Math.max(...actorPositions, Number.NEGATIVE_INFINITY);
  return Number.isFinite(highestPosition) && highestPosition > targetPosition;
}
