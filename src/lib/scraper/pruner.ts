import * as cheerio from "cheerio";

// `\b` after a dot doesn't work (dot is non-word), so use a lookahead instead.
const ENTITY_SUFFIX = /\b(?:LLC|L\.L\.C\.|Inc\.?|Corp\.?|Ltd\.?|Company)(?=[\s,.;:)!]|$)/i;
const CONTACT_PATTERN = /[\w.+-]+@[\w-]+\.[a-z]{2,}|\+?[\d][\d\s\-().]{6,}\d/;
const GOVERNING_LAW = /governing\s+law|jurisdiction|formed\s+in|organized\s+under/i;

const TOTAL_CHAR_CAP = 8_000;

export interface PageBlock {
  url: string;
  title: string;
  text: string;
}

/**
 * Prunes a page's HTML to the content most likely to contain entity-identifying
 * information: title, headings, footer text, and paragraphs matching entity
 * suffix, contact, or governing-law patterns. Returns a single text block.
 */
export function prunePage(url: string, html: string): PageBlock {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const title = $("title").first().text().trim();
  const parts: string[] = [];

  if (title) parts.push(title);

  $("h1, h2, h3").each((_, el) => {
    const t = $(el).text().trim();
    if (t) parts.push(t);
  });

  // Footer / contentinfo text
  const footerSels = ["footer", '[role="contentinfo"]', '[class*="footer"]', '[id*="footer"]'];
  const footerSeen = new Set<string>();
  for (const sel of footerSels) {
    $(sel).each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t && !footerSeen.has(t)) {
        footerSeen.add(t);
        parts.push(t);
      }
    });
  }

  // Qualifying paragraphs
  $("p").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (!t) return;
    if (ENTITY_SUFFIX.test(t) || CONTACT_PATTERN.test(t) || GOVERNING_LAW.test(t)) {
      parts.push(t);
    }
  });

  const text = Array.from(new Set(parts)).join("\n").trim();
  return { url, title, text };
}

/**
 * Prunes multiple pages and enforces an 8 000-character total cap across
 * all blocks (truncating in fetch order).
 */
export function prunePages(pages: Array<{ url: string; html: string }>): PageBlock[] {
  const blocks = pages.map(({ url, html }) => prunePage(url, html));
  let remaining = TOTAL_CHAR_CAP;
  const capped: PageBlock[] = [];

  for (const block of blocks) {
    if (remaining <= 0) break;
    const truncated = block.text.slice(0, remaining);
    remaining -= truncated.length;
    capped.push({ ...block, text: truncated });
  }

  return capped;
}
