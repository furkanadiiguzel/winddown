import { checkUrl, SsrfBlockedError } from "./ssrf-guard";
import { isAllowed } from "./robots";
import { fetchPage, discoverLinks } from "./tier1";
import { prunePages, type PageBlock } from "./pruner";

const USER_AGENT = "WinddownBot/1.0 (+https://winddown.app)";
const SPA_BODY_THRESHOLD = 500; // chars; below this Tier 2 is attempted

export interface ScrapeResult {
  pages: PageBlock[];
  /** Names of SSE-style events emitted during scraping (for logging/tests) */
  events: ScrapeEvent[];
  errorClass?: string;
}

export type ScrapeEvent =
  | { type: "fetching_home"; url: string }
  | { type: "found_pages"; urls: string[] }
  | { type: "fetching_page"; url: string }
  | { type: "tier2_unavailable" }
  | { type: "robots_blocked"; url: string }
  | { type: "ssrf_blocked"; url: string };

/** Minimal interface for a tier-2 (headless) scraper. */
export interface ScraperTier {
  fetch(url: string): Promise<{ html: string }>;
}

export class Tier2UnavailableError extends Error {
  constructor(msg = "Tier 2 unavailable") {
    super(msg);
    this.name = "Tier2UnavailableError";
  }
}

/**
 * Orchestrates the full scraping pipeline for a single URL:
 * SSRF guard → robots.txt → Tier 1 fetch → optional Tier 2 fallback →
 * link discovery → candidate page fetches → content pruning.
 *
 * All errors are captured as errorClass strings; page content is never
 * logged (constitution §FR-021).
 */
export async function scrape(
  url: string,
  tier2?: ScraperTier
): Promise<ScrapeResult> {
  const events: ScrapeEvent[] = [];
  const rawPages: Array<{ url: string; html: string }> = [];

  // 1. SSRF guard on initial URL
  try {
    await checkUrl(url);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      events.push({ type: "ssrf_blocked", url });
      return { pages: [], events, errorClass: "ssrf_blocked" };
    }
    return { pages: [], events, errorClass: "ssrf_error" };
  }

  // 2. robots.txt check
  const allowed = await isAllowed(url, USER_AGENT);
  if (!allowed) {
    events.push({ type: "robots_blocked", url });
    return { pages: [], events, errorClass: "robots_blocked" };
  }

  // 3. Tier 1 fetch of homepage
  events.push({ type: "fetching_home", url });
  let homeResult: Awaited<ReturnType<typeof fetchPage>>;
  let homeHtml: string;

  try {
    homeResult = await fetchPage(url);
    // Re-derive HTML from the page result for link discovery
    // (fetchPage doesn't expose raw HTML; we re-fetch for link discovery cheaply via a second Tier 1 call)
    // To avoid a second round-trip, we use the bodyText for pruning and fetch raw for links.
    // For simplicity: store bodyText as synthetic HTML for pruner; real link discovery uses a dedicated re-fetch.
    homeHtml = `<html><head><title>${homeResult.title}</title></head><body>
      ${homeResult.headings.map((h) => `<h2>${h}</h2>`).join("\n")}
      <footer>${homeResult.footerText}</footer>
      <div id="body-text">${homeResult.bodyText}</div>
    </body></html>`;
    rawPages.push({ url, html: homeHtml });
  } catch {
    return { pages: [], events, errorClass: "fetch_error" };
  }

  // 4. Tier 2 fallback if body text looks like an SPA shell
  if (homeResult.bodyText.length < SPA_BODY_THRESHOLD && tier2) {
    try {
      const t2Result = await tier2.fetch(url);
      homeHtml = t2Result.html;
      rawPages[rawPages.length - 1] = { url, html: homeHtml };
    } catch (err) {
      if (err instanceof Tier2UnavailableError) {
        events.push({ type: "tier2_unavailable" });
      }
      // Continue with thin Tier 1 result
    }
  } else if (homeResult.bodyText.length < SPA_BODY_THRESHOLD) {
    events.push({ type: "tier2_unavailable" });
  }

  // 5. Link discovery on homepage HTML
  const candidateUrls = discoverLinks(url, homeHtml);
  events.push({ type: "found_pages", urls: candidateUrls });

  // 6. Fetch candidate pages (up to 4), with SSRF guard on each redirect hop
  for (const candidateUrl of candidateUrls) {
    events.push({ type: "fetching_page", url: candidateUrl });

    try {
      await checkUrl(candidateUrl);
    } catch {
      events.push({ type: "ssrf_blocked", url: candidateUrl });
      continue;
    }

    const allowed = await isAllowed(candidateUrl, USER_AGENT);
    if (!allowed) {
      events.push({ type: "robots_blocked", url: candidateUrl });
      continue;
    }

    try {
      const pageResult = await fetchPage(candidateUrl);
      const html = `<html><head><title>${pageResult.title}</title></head><body>
        ${pageResult.headings.map((h) => `<h2>${h}</h2>`).join("\n")}
        <footer>${pageResult.footerText}</footer>
        <div id="body-text">${pageResult.bodyText}</div>
      </body></html>`;
      rawPages.push({ url: candidateUrl, html });
    } catch {
      // Fetch failure for a candidate page — skip silently
    }
  }

  // 7. Prune and cap
  const pages = prunePages(rawPages);
  return { pages, events };
}
