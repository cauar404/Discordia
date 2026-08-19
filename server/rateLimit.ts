type WindowState = { timestamps: number[] };

const buckets = new Map<string, WindowState>();

export function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const current = buckets.get(key) ?? { timestamps: [] };
  current.timestamps = current.timestamps.filter(timestamp => timestamp > now - windowMs);
  if (current.timestamps.length >= limit) {
    buckets.set(key, current);
    return false;
  }
  current.timestamps.push(now);
  buckets.set(key, current);
  return true;
}

export function clearRateLimitsForTests() {
  buckets.clear();
}
