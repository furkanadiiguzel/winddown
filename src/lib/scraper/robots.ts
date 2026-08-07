import robotsParser from "robots-parser";

const ROBOTS_TIMEOUT_MS = 5_000;
const USER_AGENT = "WinddownBot/1.0 (+https://winddown.app)";

/**
 * Fetches /robots.txt for the given URL's origin and returns whether the
 * given URL path is allowed for WinddownBot. Returns true (allowed) on any
 * fetch failure so that unreachable robots.txt doesn't block scraping.
 */
export async function isAllowed(url: string, userAgent: string = USER_AGENT): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }

  const robotsUrl = `${origin}/robots.txt`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROBOTS_TIMEOUT_MS);

    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": userAgent },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      // Non-2xx (e.g. 404) → treat as no restrictions
      return true;
    }

    const text = await res.text();
    const robots = robotsParser(robotsUrl, text);
    return robots.isAllowed(url, userAgent) ?? true;
  } catch {
    // Network error, timeout, or parse failure → allow (fail open)
    return true;
  }
}
