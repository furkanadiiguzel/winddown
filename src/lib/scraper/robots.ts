import robotsParser from "robots-parser";

const ROBOTS_TIMEOUT_MS = 5_000;
const USER_AGENT = "WinddownBot/1.0 (+https://winddown.app)";

/**
 * Fetches /robots.txt for the given URL's origin and returns whether the
 * given URL path is allowed for WinddownBot. Returns true (allowed) on any
 * fetch failure (fail-open) so that unreachable robots.txt doesn't block
 * scraping — but the failure is logged as errorClass for observability.
 * FR-021: only errorClass is logged, never URL or page content.
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
      // Non-2xx (e.g. 404) — treat as no restrictions (standard practice)
      return true;
    }

    const text = await res.text();
    const robots = robotsParser(robotsUrl, text);
    return robots.isAllowed(url, userAgent) ?? true;
  } catch (err: unknown) {
    // Network error, timeout, or parse failure → fail open
    const errorClass =
      err instanceof Error && err.name === "AbortError"
        ? "robots_timeout"
        : "robots_fetch_error";
    // FR-021: log only errorClass, not the URL or any page content
    console.warn(`[scraper] robots.txt check degraded: ${errorClass}`);
    return true;
  }
}
