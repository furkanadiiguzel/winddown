import { FirecrawlClient } from "@mendable/firecrawl-js";

const TIMEOUT_MS = 30_000;
const MAX_PAGES = 5;

// Fallback sub-paths when no discovered URLs are provided
const FALLBACK_SUBPATHS = [
  "/contact", "/about", "/location", "/hours",
  "/contact-us", "/about-us", "/find-us", "/visit",
];

/**
 * Tier 3 — Firecrawl API.
 * Cloud-hosted real-browser rendering with anti-bot bypass.
 * Scrapes homepage + discovered sub-pages (or fallback paths) concurrently.
 * Requires FIRECRAWL_API_KEY env var.
 *
 * @param url - Base URL to scrape
 * @param discoveredUrls - URLs discovered from Tier 1 link analysis (preferred over fallbacks)
 */
export async function fetchViaFirecrawl(
  url: string,
  discoveredUrls?: string[]
): Promise<{ pages: Array<{ url: string; markdown: string }> }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const client = new FirecrawlClient({ apiKey });

  // Prefer discovered URLs; fall back to common sub-paths
  let subUrls: string[];
  if (discoveredUrls && discoveredUrls.length > 0) {
    subUrls = discoveredUrls.slice(0, MAX_PAGES - 1);
  } else {
    subUrls = FALLBACK_SUBPATHS.slice(0, 3).map((p) => {
      try { return new URL(p, url).href; } catch { return null; }
    }).filter(Boolean) as string[];
  }

  const allUrls = [url, ...subUrls].slice(0, MAX_PAGES);

  const timer = setTimeout(() => { /* timeout handled by Promise.allSettled */ }, TIMEOUT_MS);

  try {
    const results = await Promise.allSettled(
      allUrls.map((u) =>
        client.scrapeUrl(u, { formats: ["markdown"] })
      )
    );

    const pages: Array<{ url: string; markdown: string }> = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled") {
        const data = r.value as Record<string, unknown>;
        const md = (data?.markdown ?? data?.content ?? "") as string;
        if (md.trim().length > 30) {
          pages.push({ url: allUrls[i], markdown: md });
        }
      }
    }

    if (pages.length === 0) throw new Error("Firecrawl returned no usable content");
    return { pages };
  } finally {
    clearTimeout(timer);
  }
}
