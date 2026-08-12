import FirecrawlApp from "@mendable/firecrawl-js";

const TIMEOUT_MS = 30_000;

/**
 * Tier 3 — Firecrawl API.
 * Cloud-hosted real-browser rendering with anti-bot bypass.
 * Returns clean markdown of the page + up to 2 contact/about sub-pages.
 * Requires FIRECRAWL_API_KEY env var; throws if missing or call fails.
 */
export async function fetchViaFirecrawl(
  url: string
): Promise<{ pages: Array<{ url: string; markdown: string }> }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  const app = new FirecrawlApp({ apiKey });

  // Scrape homepage + common contact/about sub-paths concurrently
  const subPaths = ["/contact", "/about", "/contact-us", "/about-us"];
  const subUrls = subPaths.slice(0, 2).map((p) => {
    try { return new URL(p, url).href; } catch { return null; }
  }).filter(Boolean) as string[];

  const allUrls = [url, ...subUrls];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const results = await Promise.allSettled(
      allUrls.map((u) =>
        app.scrapeUrl(u, { formats: ["markdown"] })
      )
    );

    const pages: Array<{ url: string; markdown: string }> = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "fulfilled" && r.value.success) {
        const md = (r.value as { markdown?: string }).markdown ?? "";
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
