import { ApiError } from "./errors";
// Simple fixed-window in-memory rate limiter for public endpoints.
// For multi-instance deployments swap for Redis.
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { count: 1, reset: now + windowMs }); return; }
  b.count++;
  if (b.count > limit) throw new ApiError(429, "RATE_LIMITED", "Too many requests. Please wait a moment and try again.");
  if (buckets.size > 10000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
}
