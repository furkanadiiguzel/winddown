import * as cheerio from "cheerio";

const ENTITY_SUFFIX = /\b(?:LLC|L\.L\.C\.|Inc\.?|Corp\.?|Ltd\.?|Company)(?=[\s,.;:)!]|$)/i;
const CONTACT_PATTERN = /[\w.+-]+@[\w-]+\.[a-z]{2,}|\+?[\d][\d\s\-().]{6,}\d/;
const GOVERNING_LAW = /governing\s+law|jurisdiction|formed\s+in|organized\s+under/i;
const ADDRESS_PATTERN =
  /\b\d{1,5}\s+[A-Za-z][A-Za-z0-9\s.,#-]{3,}\s+(?:street|st|avenue|ave|road|rd|blvd|boulevard|drive|dr|lane|ln|way|place|pl|suite|ste|floor|fl|hwy|highway|pkwy)\.?\b|\bpo\s*box\s+\d+/i;
const STATE_ZIP_PATTERN = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;
const COPYRIGHT_PATTERN = /©|\bCopyright\b|\ball rights reserved\b/i;

const TOTAL_CHAR_CAP = 14_000;

// Short-element threshold: elements under this length are included without
// pattern filtering — business sites pack contact info into tight blocks.
const SHORT_ELEMENT_THRESHOLD = 350;

export interface PageBlock {
  url: string;
  title: string;
  text: string;
}

function qualifiesLong(t: string): boolean {
  return (
    ENTITY_SUFFIX.test(t) ||
    CONTACT_PATTERN.test(t) ||
    GOVERNING_LAW.test(t) ||
    ADDRESS_PATTERN.test(t) ||
    STATE_ZIP_PATTERN.test(t) ||
    COPYRIGHT_PATTERN.test(t)
  );
}

export function prunePage(url: string, html: string): PageBlock {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, svg, nav, [role='navigation']").remove();

  const title = $("title").first().text().trim();
  const parts: string[] = [];
  const seen = new Set<string>();

  function add(raw: string) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (t.length > 2 && !seen.has(t)) {
      seen.add(t);
      parts.push(t);
    }
  }

  // 1. Always: title + headings + meta description
  if (title) add(title);
  $("h1, h2, h3, h4").each((_, el) => add($(el).text()));
  const metaDesc = $('meta[name="description"]').attr("content") ?? "";
  if (metaDesc) add(metaDesc);
  const ogName = $('meta[property="og:site_name"]').attr("content") ?? "";
  if (ogName) add(ogName);

  // 2. Always: footer + contentinfo (copyright line, registered name)
  const footerSels = [
    "footer",
    '[role="contentinfo"]',
    '[class*="footer"]',
    '[id*="footer"]',
    '[class*="bottom-bar"]',
    '[class*="site-bottom"]',
  ];
  for (const sel of footerSels) {
    $(sel).each((_, el) => add($(el).text()));
  }

  // 3. Always: any element that semantically indicates contact/address
  const contactSels = [
    "address",
    '[class*="address"]', '[id*="address"]',
    '[class*="contact"]', '[id*="contact"]',
    '[class*="location"]', '[id*="location"]',
    '[class*="phone"]', '[id*="phone"]',
    '[class*="email"]', '[id*="email"]',
    '[class*="reach"]', '[id*="reach"]',
    '[class*="office"]', '[id*="office"]',
    '[class*="headquarter"]', '[id*="headquarter"]',
    '[class*="company-info"]', '[id*="company-info"]',
    '[class*="get-in-touch"]',
    '[class*="about"]', '[id*="about-info"]',
    '[class*="sidebar"]', '[id*="sidebar"]',
  ];
  for (const sel of contactSels) {
    $(sel).each((_, el) => add($(el).text()));
  }

  // 4. Sweep all leaf text nodes:
  //    - under SHORT_ELEMENT_THRESHOLD chars → include unconditionally
  //    - 350–2000 chars → include only if matches qualifying pattern
  //    - over 2000 chars → skip (prose / blog content)
  const sweepSels = ["p", "li", "td", "address", "span", "div", "section", "article"];
  for (const sel of sweepSels) {
    $(sel).each((_, el) => {
      const $el = $(el);
      // Skip containers with significant block descendants (we want leaf-ish nodes)
      const blockDescendants = $el.find("p, article, section, blockquote, table").length;
      if (blockDescendants > 3) return;

      const t = $el.text().replace(/\s+/g, " ").trim();
      if (t.length < 3) return;

      if (t.length <= SHORT_ELEMENT_THRESHOLD) {
        add(t);
      } else if (t.length <= 2_000) {
        if (qualifiesLong(t)) add(t);
      }
      // > 2000: skip
    });
  }

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
