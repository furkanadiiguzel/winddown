import * as cheerio from "cheerio";
import { getDomain } from "tldts";

const USER_AGENT = "WinddownBot/1.0 (+https://winddown.app)";
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

export interface PageResult {
  url: string;
  title: string;
  headings: string[];
  footerText: string;
  bodyText: string;
  /** Raw HTML body length in bytes (used to detect SPA shells) */
  rawBodyLength: number;
  /** The raw fetched HTML — passed to pruner to preserve element structure */
  rawHtml: string;
}

/**
 * Fetches a single URL with the WinddownBot user-agent, enforcing timeout,
 * redirect cap, and body-size cap. Parses with cheerio and returns
 * structured text content.
 *
 * The caller is responsible for running the SSRF guard on `url` before
 * calling this function (and again on every redirect hop via a custom
 * fetch wrapper or middleware).
 */
export async function fetchPage(url: string): Promise<PageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let redirectCount = 0;
  let currentUrl = url;

  // Custom redirect handler to enforce cap
  const res = await fetch(currentUrl, {
    signal: controller.signal,
    redirect: "manual",
    headers: { "User-Agent": USER_AGENT },
  })
    .then(async (r) => {
      // Follow redirects manually so we can cap them
      let response = r;
      while (response.status >= 300 && response.status < 400) {
        if (redirectCount >= MAX_REDIRECTS) {
          throw new Error(`Exceeded ${MAX_REDIRECTS} redirects`);
        }
        const location = response.headers.get("location");
        if (!location) break;
        redirectCount++;
        currentUrl = new URL(location, currentUrl).href;
        response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: "manual",
          headers: { "User-Agent": USER_AGENT },
        });
      }
      return response;
    })
    .finally(() => clearTimeout(timer));

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${currentUrl}`);
  }

  // Read up to MAX_BODY_BYTES
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }

  const html = new TextDecoder().decode(
    chunks.reduce((acc, c) => {
      const merged = new Uint8Array(acc.length + c.length);
      merged.set(acc);
      merged.set(c, acc.length);
      return merged;
    }, new Uint8Array())
  );

  return parseHtml(currentUrl, html, totalBytes);
}

function parseHtml(url: string, html: string, rawBodyLength: number): PageResult {
  const $ = cheerio.load(html);

  // Remove script/style noise
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim();

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text);
  });

  // Footer text: <footer>, role=contentinfo, elements with footer-like class/id
  const footerSelectors = [
    "footer",
    '[role="contentinfo"]',
    '[class*="footer"]',
    '[id*="footer"]',
  ];
  const footerParts: string[] = [];
  for (const sel of footerSelectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      if (text) footerParts.push(text);
    });
  }
  const footerText = Array.from(new Set(footerParts)).join("\n").trim();

  // Full visible body text (for length check and pruner input)
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  return { url, title, headings, footerText, bodyText, rawBodyLength, rawHtml: html };
}

// ── T037: Link discovery ──────────────────────────────────────────────────────

const CANDIDATE_PATTERN =
  /terms|privacy|legal|about|contact|imprint|reach|location|address|office|team|company|who-we-are|get-in-touch|find-us|our-story/i;
const MAX_CANDIDATE_LINKS = 5;

/**
 * Extracts up to 4 candidate page links from the given HTML string,
 * filtered to the same registrable domain as `baseUrl` and matching
 * the candidate-path pattern.
 */
export function discoverLinks(baseUrl: string, html: string): string[] {
  const baseDomain = getDomain(baseUrl);
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const results: string[] = [];

  $("a[href]").each((_, el) => {
    if (results.length >= MAX_CANDIDATE_LINKS) return false; // cheerio break

    const href = $(el).attr("href") ?? "";
    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      return;
    }

    // HTTPS only; same registrable domain
    if (resolved.protocol !== "https:") return;
    if (getDomain(resolved.href) !== baseDomain) return;
    // Must match the candidate pattern in pathname or href
    if (!CANDIDATE_PATTERN.test(resolved.pathname)) return;

    const normalized = resolved.href.replace(/\/$/, "");
    if (seen.has(normalized)) return;
    seen.add(normalized);
    results.push(resolved.href);
  });

  return results;
}
