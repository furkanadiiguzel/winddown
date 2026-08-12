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

function markdownToText(md: string): string {
  const cleaned = md
    // Images: keep alt text, drop URL
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Links: keep link text, drop URL
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Bare URLs
    .replace(/https?:\/\/\S+/g, "")
    // Heading markers
    .replace(/^#{1,6}\s*/gm, "")
    // Bold/italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    // Horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Collapse blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // Wrap paragraphs in <p> tags so cheerio can extract clean text
  const paras = cleaned
    .split(/\n\n+/)
    .map((s) => s.trim().replace(/\n/g, " "))
    .filter((s) => s.length > 0)
    .map((s) => `<p>${s}</p>`)
    .join("\n");
  return paras;
}

function markdownToHtml(md: string): string {
  return markdownToText(md);
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
  let homeRawHtml = "";
  let homeSpaCandidate = false;

  try {
    const homeResult = await fetchPage(url);
    homeHtml = `<html><head><title>${homeResult.title}</title></head><body>
      ${homeResult.headings.map((h) => `<h2>${h}</h2>`).join("\n")}
      <footer>${homeResult.footerText}</footer>
      <div id="body-text">${homeResult.bodyText}</div>
    </body></html>`;
    homeRawHtml = homeResult.rawHtml;
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

    // Tier 2 unavailable + SPA shell detected → try Firecrawl for JS rendering
    emit({ type: "tier3_jina" });
    // Use Tier 1 raw HTML to discover real sub-page links, pass them to Firecrawl
    const spaDiscoveredUrls = discoverLinks(url, homeRawHtml);
    try {
      const { pages: fcPages } = await fetchViaFirecrawl(url, spaDiscoveredUrls);
      // Keep Tier 1 rawHtml as first entry (contains JSON-LD structured data),
      // then add Firecrawl JS-rendered pages alongside it
      for (const p of fcPages) {
        // Skip duplicate homepage — Tier 1 rawHtml already covers it for JSON-LD
        if (p.url === url) continue;
        rawPages.push({ url: p.url, html: `<html><body>${markdownToHtml(p.markdown)}</body></html>` });
      }
      // Also keep Firecrawl homepage text (may have rendered content Tier 1 missed)
      const fcHome = fcPages.find((p) => p.url === url);
      if (fcHome) {
        rawPages.push({ url: `${url}#rendered`, html: `<html><body>${markdownToHtml(fcHome.markdown)}</body></html>` });
      }
      const pages = prunePages(rawPages);
      return { pages, events };
    } catch {
      // Firecrawl also failed for SPA — try Wayback Machine
      emit({ type: "tier4_wayback" });
      try {
        const { html } = await fetchViaWayback(url);
        rawPages[rawPages.length - 1] = { url, html };
      } catch {
        // Keep whatever Tier 1 got
      }
    }
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
