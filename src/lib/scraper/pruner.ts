import * as cheerio from "cheerio";

const ENTITY_SUFFIX = /\b(?:LLC|L\.L\.C\.|Inc\.?|Corp\.?|Ltd\.?|Company)(?=[\s,.;:)!]|$)/i;
const CONTACT_PATTERN = /[\w.+-]+@[\w-]+\.[a-z]{2,}|\+?[\d][\d\s\-().]{6,}\d/;
const GOVERNING_LAW = /governing\s+law|jurisdiction|formed\s+in|organized\s+under/i;
const ADDRESS_PATTERN =
  /\d{1,5}\s+\w[\w\s.,-]{2,}\s+(?:street|st|avenue|ave|road|rd|blvd|boulevard|drive|dr|lane|ln|way|place|pl|suite|ste|floor|fl|hwy|highway|pkwy|parkway)\.?\b|\b(?:po\s+box|p\.o\.\s+box)\s+\d+/i;
const STATE_ZIP_PATTERN = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;

const TOTAL_CHAR_CAP = 12_000;

export interface PageBlock {
  url: string;
  title: string;
  text: string;
}

function qualifies(t: string): boolean {
  return (
    ENTITY_SUFFIX.test(t) ||
    CONTACT_PATTERN.test(t) ||
    GOVERNING_LAW.test(t) ||
    ADDRESS_PATTERN.test(t) ||
    STATE_ZIP_PATTERN.test(t)
  );
}

export function prunePage(url: string, html: string): PageBlock {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg").remove();

  const title = $("title").first().text().trim();
  const parts: string[] = [];
  const seen = new Set<string>();

  function add(t: string) {
    const normalized = t.replace(/\s+/g, " ").trim();
    if (normalized.length > 3 && !seen.has(normalized)) {
      seen.add(normalized);
      parts.push(normalized);
    }
  }

  if (title) add(title);

  $("h1, h2, h3").each((_, el) => add($(el).text()));

  // Footer / contentinfo areas — always include fully
  const footerSels = [
    "footer",
    '[role="contentinfo"]',
    '[class*="footer"]',
    '[id*="footer"]',
  ];
  for (const sel of footerSels) {
    $(sel).each((_, el) => add($(el).text()));
  }

  // Contact / address containers — always include
  const contactSels = [
    "address",
    '[class*="address"]',
    '[id*="address"]',
    '[class*="contact"]',
    '[id*="contact"]',
    '[class*="location"]',
    '[id*="location"]',
    '[class*="phone"]',
    '[id*="phone"]',
    '[class*="email"]',
    '[id*="email"]',
    '[class*="info"]',
    '[id*="info"]',
    '[class*="about"]',
    '[id*="about"]',
  ];
  for (const sel of contactSels) {
    $(sel).each((_, el) => add($(el).text()));
  }

  // Qualifying leaf elements: p, li, span, td, div — filtered by content patterns
  const leafSels = ["p", "li", "td", "span", "div"];
  for (const sel of leafSels) {
    $(sel).each((_, el) => {
      // Skip elements that contain other block children (avoid duplicating containers)
      const $el = $(el);
      if (sel === "div" || sel === "span") {
        const hasBlockChild = $el.find("p, div, li, table, article, section").length > 0;
        if (hasBlockChild) return;
      }
      const t = $el.text().replace(/\s+/g, " ").trim();
      if (t.length < 5 || t.length > 1_000) return;
      if (qualifies(t)) add(t);
    });
  }

  // Meta tags — description, keywords can hold company name
  const metaDesc = $('meta[name="description"]').attr("content") ?? "";
  if (metaDesc && qualifies(metaDesc)) add(metaDesc);

  const text = parts.join("\n").trim();
  return { url, title, text };
}

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
