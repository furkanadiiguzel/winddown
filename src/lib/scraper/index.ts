import { checkUrl, SsrfBlockedError } from "./ssrf-guard";
import { isAllowed } from "./robots";
import { fetchPage, discoverLinks } from "./tier1";
import { prunePages, type PageBlock } from "./pruner";
import { fetchViaFirecrawl } from "./tier3-firecrawl";
import { fetchViaWayback } from "./tier4-wayback";

const USER_AGENT = "WinddownBot/1.0 (+https://winddown.app)";
const SPA_BODY_THRESHOLD = 500;

export interface ScrapeResult {
  pages: PageBlock[];
  events: ScrapeEvent[];
  errorClass?: string;
}

export type ScrapeEvent =
  | { type: "fetching_home"; url: string }
  | { type: "found_pages"; urls: string[] }
  | { type: "fetching_page"; url: string }
  | { type: "tier2_unavailable" }
  | { type: "tier3_jina" }
  | { type: "tier4_wayback" }
  | { type: "robots_blocked"; url: string }
  | { type: "ssrf_blocked"; url: string };

export interface ScraperTier {
  fetch(url: string): Promise<{ html: string }>;
}

export class Tier2UnavailableError extends Error {
  constructor(msg = "Tier 2 unavailable") {
    super(msg);
    this.name = "Tier2UnavailableError";
  }
}

export interface ScrapeOptions {
  onEvent?: (event: ScrapeEvent) => void;
}

function markdownToHtml(md: string): string {
  return md
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => `<p>${l}</p>`)
    .join("\n");
}

export async function scrape(
  url: string,
  tier2?: ScraperTier,
  options?: ScrapeOptions
): Promise<ScrapeResult> {
  const events: ScrapeEvent[] = [];
  const rawPages: Array<{ url: string; html: string }> = [];

  function emit(event: ScrapeEvent) {
    events.push(event);
    options?.onEvent?.(event);
  }

  // 1. SSRF guard
  try {
    await checkUrl(url);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      emit({ type: "ssrf_blocked", url });
      return { pages: [], events, errorClass: "ssrf_blocked" };
    }
    return { pages: [], events, errorClass: "ssrf_error" };
  }

  // 2. robots.txt check
  const allowed = await isAllowed(url, USER_AGENT);
  if (!allowed) {
    emit({ type: "robots_blocked", url });
    return { pages: [], events, errorClass: "robots_blocked" };
  }

  // 3. Tier 1 — direct fetch + cheerio
  emit({ type: "fetching_home", url });

  let homeHtml = "";
  let homeSpaCandidate = false;

  try {
    const homeResult = await fetchPage(url);
    homeHtml = `<html><head><title>${homeResult.title}</title></head><body>
      ${homeResult.headings.map((h) => `<h2>${h}</h2>`).join("\n")}
      <footer>${homeResult.footerText}</footer>
      <div id="body-text">${homeResult.bodyText}</div>
    </body></html>`;
    rawPages.push({ url, html: homeResult.rawHtml });
    homeSpaCandidate = homeResult.bodyText.length < SPA_BODY_THRESHOLD;
  } catch {
    // Tier 1 failed — try Tier 3 (Firecrawl)
    emit({ type: "tier3_jina" }); // event type used for SSE/UI

    try {
      const { pages: fcPages } = await fetchViaFirecrawl(url);
      for (const p of fcPages) {
        emit({ type: "fetching_page", url: p.url });
        rawPages.push({ url: p.url, html: `<html><body>${markdownToHtml(p.markdown)}</body></html>` });
      }
    } catch {
      // Firecrawl failed — try Tier 4 (Wayback Machine)
      emit({ type: "tier4_wayback" });
      try {
        const { html } = await fetchViaWayback(url);
        rawPages.push({ url, html });
      } catch {
        return { pages: [], events, errorClass: "fetch_error" };
      }
    }

    const pages = prunePages(rawPages);
    return { pages, events };
  }

  // 4. Tier 2 — Playwright headless for SPA shells
  if (homeSpaCandidate && tier2) {
    try {
      const t2Result = await tier2.fetch(url);
      homeHtml = t2Result.html;
      rawPages[rawPages.length - 1] = { url, html: homeHtml };
    } catch (err) {
      if (err instanceof Tier2UnavailableError) emit({ type: "tier2_unavailable" });
    }
  } else if (homeSpaCandidate) {
    emit({ type: "tier2_unavailable" });
  }

  // 5. Link discovery + sub-page fetches
  const candidateUrls = discoverLinks(url, homeHtml);
  emit({ type: "found_pages", urls: candidateUrls });

  for (const candidateUrl of candidateUrls) {
    emit({ type: "fetching_page", url: candidateUrl });

    try {
      await checkUrl(candidateUrl);
    } catch {
      emit({ type: "ssrf_blocked", url: candidateUrl });
      continue;
    }

    const subAllowed = await isAllowed(candidateUrl, USER_AGENT);
    if (!subAllowed) {
      emit({ type: "robots_blocked", url: candidateUrl });
      continue;
    }

    try {
      const pageResult = await fetchPage(candidateUrl);
      rawPages.push({ url: candidateUrl, html: pageResult.rawHtml });
    } catch {
      // Sub-page failure — try Firecrawl for this sub-page too
      try {
        const { pages: fcPages } = await fetchViaFirecrawl(candidateUrl);
        for (const p of fcPages) {
          rawPages.push({ url: p.url, html: `<html><body>${markdownToHtml(p.markdown)}</body></html>` });
        }
      } catch {
        // skip silently
      }
    }
  }

  // 6. Prune and cap
  const pages = prunePages(rawPages);
  return { pages, events };
}
