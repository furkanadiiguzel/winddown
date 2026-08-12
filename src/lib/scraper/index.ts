import { checkUrl, SsrfBlockedError } from "./ssrf-guard";
import { isAllowed } from "./robots";
import { fetchPage, discoverLinks } from "./tier1";
import { prunePages, type PageBlock } from "./pruner";
import { fetchViaJina } from "./tier3-jina";
import { fetchViaWayback } from "./tier4-wayback";

const USER_AGENT = "WinddownBot/1.0 (+https://winddown.app)";
const SPA_BODY_THRESHOLD = 500; // chars; below this Tier 2 is attempted

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

  // 3. Tier 1 fetch of homepage
  emit({ type: "fetching_home", url });

  let homeHtml = "";
  let homeSpaCandidate = false; // whether body looks thin enough for Tier 2

  try {
    const homeResult = await fetchPage(url);
    // homeHtml (reconstructed) is used only for link discovery
    homeHtml = `<html><head><title>${homeResult.title}</title></head><body>
      ${homeResult.headings.map((h) => `<h2>${h}</h2>`).join("\n")}
      <footer>${homeResult.footerText}</footer>
      <div id="body-text">${homeResult.bodyText}</div>
    </body></html>`;
    // Pass raw HTML to pruner so it can see full element structure (addresses, li, etc.)
    rawPages.push({ url, html: homeResult.rawHtml });
    homeSpaCandidate = homeResult.bodyText.length < SPA_BODY_THRESHOLD;
  } catch {
    // Tier 1 failed — try Tier 3 (Jina AI Reader)
    emit({ type: "tier3_jina" });
    let jinaOk = false;

    try {
      const { text } = await fetchViaJina(url);
      // Split Jina's clean text into paragraph elements so pruner can filter by line
      const paras = text
        .split(/\n+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => `<p>${l}</p>`)
        .join("\n");
      homeHtml = `<html><body>${paras}</body></html>`;
      rawPages.push({ url, html: homeHtml });
      jinaOk = true;
    } catch {
      // Jina failed — try Tier 4 (Wayback Machine)
      emit({ type: "tier4_wayback" });
      try {
        const { html } = await fetchViaWayback(url);
        homeHtml = html;
        rawPages.push({ url, html: homeHtml });
      } catch {
        // All tiers exhausted
        return { pages: [], events, errorClass: "fetch_error" };
      }
    }

    // Skip sub-page discovery when using Jina/Wayback — prune what we have
    if (!jinaOk || homeHtml) {
      const pages = prunePages(rawPages);
      return { pages, events };
    }
  }

  // 4. Tier 2 fallback for SPA shells (only when Tier 1 succeeded)
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

  // 5. Link discovery
  const candidateUrls = discoverLinks(url, homeHtml);
  emit({ type: "found_pages", urls: candidateUrls });

  // 6. Fetch candidate sub-pages
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
      // Sub-page failure — skip silently
    }
  }

  // 7. Prune and cap
  const pages = prunePages(rawPages);
  return { pages, events };
}
