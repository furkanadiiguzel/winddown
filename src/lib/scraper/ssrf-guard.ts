import dns from "dns";
import net from "net";

export class SsrfBlockedError extends Error {
  constructor(reason: string) {
    super(`SSRF blocked: ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

// ── IPv4 CIDR helpers ─────────────────────────────────────────────────────────

function ip4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc * 256 + parseInt(octet, 10)) >>> 0, 0);
}

function isBlockedIpv4(ip: string): boolean {
  const addr = ip4ToInt(ip);
  const rules: Array<[string, number]> = [
    ["10.0.0.0", 8],       // RFC 1918
    ["172.16.0.0", 12],    // RFC 1918
    ["192.168.0.0", 16],   // RFC 1918
    ["127.0.0.0", 8],      // loopback
    ["169.254.0.0", 16],   // link-local + cloud metadata (169.254.169.254 is within this)
  ];
  for (const [base, prefix] of rules) {
    const baseInt = ip4ToInt(base);
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    if ((addr & mask) === (baseInt & mask)) return true;
  }
  return false;
}

// ── IPv6 CIDR helpers ─────────────────────────────────────────────────────────

/** Expand an IPv6 address into 8 groups of 16-bit numbers. */
function expandIpv6(ip: string): number[] {
  const halves = ip.split("::");
  const toGroups = (s: string) => (s ? s.split(":").map((g) => parseInt(g || "0", 16)) : []);
  if (halves.length === 2) {
    const left = toGroups(halves[0]);
    const right = toGroups(halves[1]);
    const fill = 8 - left.length - right.length;
    return [...left, ...Array(fill).fill(0), ...right];
  }
  return toGroups(ip);
}

/** Compare the first `prefixBits` of two 8-element IPv6 group arrays. */
function ipv6PrefixMatch(addr: number[], base: number[], prefixBits: number): boolean {
  let remaining = prefixBits;
  for (let i = 0; i < 8 && remaining > 0; i++) {
    const bits = Math.min(remaining, 16);
    const mask = bits >= 16 ? 0xffff : 0xffff - ((1 << (16 - bits)) - 1);
    if ((addr[i] & mask) !== (base[i] & mask)) return false;
    remaining -= bits;
  }
  return true;
}

function isBlockedIpv6(ip: string): boolean {
  const addr = expandIpv6(ip);
  const rules: Array<[string, number]> = [
    ["::1", 128],              // loopback
    ["fc00::", 7],             // ULA (includes fd00::/8 and cloud metadata fd00:ec2::/32)
    ["fe80::", 10],            // link-local
  ];
  for (const [base, prefix] of rules) {
    if (ipv6PrefixMatch(addr, expandIpv6(base), prefix)) return true;
  }
  return false;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves the hostname of `url` via DNS and throws SsrfBlockedError if the
 * resolved IP falls in any blocked CIDR. Must be called on EVERY redirect hop.
 */
export async function checkUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SsrfBlockedError("invalid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new SsrfBlockedError(`non-HTTPS scheme: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname;

  // Raw IP in URL — check without DNS
  if (net.isIP(hostname)) {
    checkIp(hostname);
    return;
  }

  // DNS resolution — check every returned address
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch (err: unknown) {
    throw new SsrfBlockedError(`DNS lookup failed for ${hostname}: ${(err as Error).message}`);
  }

  for (const { address } of addresses) {
    checkIp(address);
  }
}

function checkIp(ip: string): void {
  const version = net.isIP(ip);
  if (version === 4 && isBlockedIpv4(ip)) {
    throw new SsrfBlockedError(`IP ${ip} is in a blocked range`);
  }
  if (version === 6 && isBlockedIpv6(ip)) {
    throw new SsrfBlockedError(`IP ${ip} is in a blocked range`);
  }
}
