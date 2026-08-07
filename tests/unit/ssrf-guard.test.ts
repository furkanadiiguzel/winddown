import { describe, it, expect, vi, beforeEach } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock("dns", () => ({
  default: {
    promises: {
      lookup: lookupMock,
    },
  },
  promises: {
    lookup: lookupMock,
  },
}));

import { checkUrl, SsrfBlockedError } from "@/lib/scraper/ssrf-guard";

function resolveAs(ip: string) {
  const family = ip.includes(":") ? 6 : 4;
  lookupMock.mockResolvedValue([{ address: ip, family }]);
}

beforeEach(() => {
  lookupMock.mockReset();
});

describe("T034 — SSRF guard table-driven tests", () => {
  // --- Blocked ranges ---
  it("blocks 10.0.0.1 (RFC 1918 / 10/8)", async () => {
    resolveAs("10.0.0.1");
    await expect(checkUrl("https://internal.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks 10.255.255.255 (RFC 1918 / 10/8 boundary)", async () => {
    resolveAs("10.255.255.255");
    await expect(checkUrl("https://x.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks 172.16.0.1 (RFC 1918 / 172.16/12)", async () => {
    resolveAs("172.16.0.1");
    await expect(checkUrl("https://corp.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks 172.31.255.255 (RFC 1918 / 172.16/12 boundary)", async () => {
    resolveAs("172.31.255.255");
    await expect(checkUrl("https://x.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("allows 172.32.0.1 (just outside RFC 1918 / 172.16/12)", async () => {
    resolveAs("172.32.0.1");
    await expect(checkUrl("https://x.example.com/")).resolves.toBeUndefined();
  });

  it("blocks 192.168.1.1 (RFC 1918 / 192.168/16)", async () => {
    resolveAs("192.168.1.1");
    await expect(checkUrl("https://router.local/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks 127.0.0.1 (loopback)", async () => {
    resolveAs("127.0.0.1");
    await expect(checkUrl("https://localhost.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks 127.0.0.2 (loopback range)", async () => {
    resolveAs("127.0.0.2");
    await expect(checkUrl("https://x.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks 169.254.169.254 (AWS/GCP cloud metadata)", async () => {
    resolveAs("169.254.169.254");
    await expect(checkUrl("https://metadata.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks 169.254.0.1 (link-local)", async () => {
    resolveAs("169.254.0.1");
    await expect(checkUrl("https://x.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks ::1 (IPv6 loopback)", async () => {
    resolveAs("::1");
    await expect(checkUrl("https://v6host.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks fd00::1 (IPv6 ULA / cloud metadata range)", async () => {
    resolveAs("fd00::1");
    await expect(checkUrl("https://v6ula.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks fe80::1 (IPv6 link-local)", async () => {
    resolveAs("fe80::1");
    await expect(checkUrl("https://v6ll.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  // Raw-IP URL path (no DNS lookup needed)
  it("blocks raw 127.0.0.1 in URL without DNS lookup", async () => {
    await expect(checkUrl("https://127.0.0.1/")).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("blocks raw 192.168.0.1 in URL without DNS lookup", async () => {
    await expect(checkUrl("https://192.168.0.1/")).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  // --- Allowed public IPs ---
  it("allows 93.184.216.34 (example.com) — public routable", async () => {
    resolveAs("93.184.216.34");
    await expect(checkUrl("https://example.com/")).resolves.toBeUndefined();
  });

  it("allows 1.1.1.1 (Cloudflare DNS) — public routable", async () => {
    resolveAs("1.1.1.1");
    await expect(checkUrl("https://one.one.one.one/")).resolves.toBeUndefined();
  });

  it("allows 2606:4700:4700::1111 (public IPv6)", async () => {
    resolveAs("2606:4700:4700::1111");
    await expect(checkUrl("https://v6public.example.com/")).resolves.toBeUndefined();
  });

  // --- Scheme enforcement ---
  it("blocks http:// (non-HTTPS)", async () => {
    await expect(checkUrl("http://example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("blocks ftp:// scheme", async () => {
    await expect(checkUrl("ftp://example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("blocks invalid URL", async () => {
    await expect(checkUrl("not-a-url")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  // --- DNS failure ---
  it("throws SsrfBlockedError when DNS lookup fails", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(checkUrl("https://nonexistent.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  // --- Multi-address response: any blocked address blocks the whole request ---
  it("blocks when ANY resolved address is in a private range", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]);
    await expect(checkUrl("https://dual.example.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});
