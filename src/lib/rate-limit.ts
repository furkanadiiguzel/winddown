import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

let ratelimiter: Ratelimit | null = null;

function getRatelimiter(): Ratelimit | null {
  // Lazy singleton — only construct when env vars are present.
  // In test environments without Redis, returns null (caller must handle).
  if (ratelimiter) return ratelimiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });
  const max = parseInt(process.env.RATE_LIMIT_MAX ?? "20", 10);
  ratelimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, "1 h"),
    prefix: "ratelimit:analyze",
  });
  return ratelimiter;
}

/**
 * T057 — Sliding-window rate limiter: 5 requests / hour / IP.
 * Key is derived from sha256(ip) so raw IPs are never persisted (FR-021).
 * Returns allowed=true when Redis is unavailable (fail-open for dev/test).
 */
export async function rateLimit(ip: string): Promise<RateLimitResult> {
  const limiter = getRatelimiter();
  if (!limiter) {
    // Redis not configured — allow (dev/test or misconfigured prod logs a warning)
    console.warn("[rate-limit] Redis not configured — rate limiting disabled");
    return { allowed: true };
  }

  // Hash IP so it's never stored in plain text (FR-021)
  const key = createHash("sha256").update(ip).digest("hex");

  try {
    const { success, reset } = await limiter.limit(key);
    if (success) return { allowed: true };
    const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1_000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  } catch {
    // Redis error — fail open, log errorClass only
    console.warn("[rate-limit] Redis error: rate_limit_check_failed — allowing request");
    return { allowed: true };
  }
}
