import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @upstash/ratelimit and @upstash/redis before import ─────────────────

const mockLimit = vi.hoisted(() => vi.fn());

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    limit = mockLimit;
    static slidingWindow() { return {}; }
  },
}));

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {},
}));

// Set env vars so the limiter is constructed (not bypassed)
vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock-redis.upstash.io");
vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token");

// Import after mocking
const { rateLimit } = await import("@/lib/rate-limit");

beforeEach(() => {
  mockLimit.mockReset();
});

describe("T060 — rate limit unit tests", () => {
  it("allows 5 calls", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 3600_000 });

    for (let i = 0; i < 5; i++) {
      const result = await rateLimit("1.2.3.4");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks 6th call with retryAfterSeconds > 0", async () => {
    const resetAt = Date.now() + 1_800_000; // 30 min from now
    mockLimit
      .mockResolvedValueOnce({ success: true, reset: resetAt })
      .mockResolvedValueOnce({ success: true, reset: resetAt })
      .mockResolvedValueOnce({ success: true, reset: resetAt })
      .mockResolvedValueOnce({ success: true, reset: resetAt })
      .mockResolvedValueOnce({ success: true, reset: resetAt })
      .mockResolvedValueOnce({ success: false, reset: resetAt });

    for (let i = 0; i < 5; i++) {
      await rateLimit("2.3.4.5");
    }
    const result = await rateLimit("2.3.4.5");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("uses sha256-derived key — different IPs produce different calls", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 3600_000 });

    await rateLimit("10.0.0.1");
    await rateLimit("10.0.0.2");

    expect(mockLimit).toHaveBeenCalledTimes(2);
    const [call1Key] = mockLimit.mock.calls[0] as [string];
    const [call2Key] = mockLimit.mock.calls[1] as [string];
    expect(call1Key).not.toBe(call2Key);
    // Keys are 64-char hex (sha256)
    expect(call1Key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fails open when Redis throws (allows request, does not crash)", async () => {
    mockLimit.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await rateLimit("3.4.5.6");
    expect(result.allowed).toBe(true);
  });

  it("same IP produces same key across calls (deterministic hashing)", async () => {
    mockLimit.mockResolvedValue({ success: true, reset: Date.now() + 3600_000 });

    await rateLimit("5.6.7.8");
    await rateLimit("5.6.7.8");

    const [call1Key] = mockLimit.mock.calls[0] as [string];
    const [call2Key] = mockLimit.mock.calls[1] as [string];
    expect(call1Key).toBe(call2Key);
  });
});
