import * as cheerio from "cheerio";

// Total character cap sent to the AI.
// Claude Sonnet handles 200k tokens; 20k chars (~5k tokens) is generous but safe.
const TOTAL_CHAR_CAP = 20_000;

export interface PageBlock {
  url: string;
  title: string;
  text: string;
}

/**
 * Extracts ALL visible text from a page, removing only noise (scripts, styles,
 * navigation, cookie banners, ads). This approach is intentionally broad:
 * filtering by element type or content pattern was causing inconsistent
 * extractions because contact info appears in too many structural variations.
 * The AI is responsible for identifying relevant fields from the full text.
 */
export function prunePage(url: string, html: string): PageBlock {
  const $ = cheerio.load(html);

  // Extract JSON-LD structured data BEFORE removing scripts
  // Business sites embed phone/address/email in schema.org markup
  const jsonLdText: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).text();
      const data = JSON.parse(raw) as Record<string, unknown>;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const d = item as Record<string, unknown>;
        const phone = (d.telephone ?? d.phone ?? "") as string;
        const email = (d.email ?? "") as string;
        const nameVal = (d.name ?? "") as string;
        let addr = "";
        if (d.address && typeof d.address === "object") {
          const a = d.address as Record<string, string>;
          addr = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode]
            .filter(Boolean).join(", ");
        }
        const parts = [nameVal, phone, email, addr].filter((s) => s.length > 0);
        if (parts.length > 0) jsonLdText.push(parts.join("\n"));
      }
    } catch { /* skip malformed JSON-LD */ }
  });

  // Extract Schema.org microdata (itemprop attributes) BEFORE any removal
  // Many business sites use HTML microdata for address/phone even when CSS-hidden
  const microdataLines: string[] = [];
  const streetAddress = $('[itemprop="streetAddress"]').first().text().trim();
  const locality = $('[itemprop="addressLocality"]').first().text().trim();
  const region = $('[itemprop="addressRegion"]').first().text().trim();
  const postalCode = $('[itemprop="postalCode"]').first().text().trim();
  const microPhone = $('[itemprop="telephone"]').first().text().trim();
  const microEmail = $('[itemprop="email"]').first().text().trim();
  const microName = $('[itemprop="name"]').first().text().trim();
  if (streetAddress) {
    const addr = [streetAddress, locality, region, postalCode].filter(Boolean).join(", ");
    microdataLines.push(`Address: ${addr}`);
  }
  if (microPhone) microdataLines.push(`Phone: ${microPhone}`);
  if (microEmail) microdataLines.push(`Email: ${microEmail}`);
  if (microName) microdataLines.push(`Name: ${microName}`);

  // Extract tel: and mailto: href attributes BEFORE removing any elements
  // Many sites put phone/email in nav or footer links; .text() misses href values
  const telNumbers: string[] = [];
  const mailtoEmails: string[] = [];
  $('a[href^="tel:"]').each((_, el) => {
    const raw = ($(el).attr("href") ?? "").replace(/^tel:/, "").trim();
    // Normalize to readable format; skip shortcodes (< 7 digits)
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 7) telNumbers.push(raw);
  });
  $('a[href^="mailto:"]').each((_, el) => {
    const raw = ($(el).attr("href") ?? "").replace(/^mailto:/, "").split("?")[0].trim();
    if (raw.includes("@")) mailtoEmails.push(raw);
  });

  // Remove non-content elements
  $(
    "script, style, noscript, iframe, svg, " +
    "nav, [role='navigation'], " +
    "header nav, .nav, .navbar, .menu, #menu, " +
    "[class*='cookie'], [class*='gdpr'], [class*='banner'], [id*='cookie'], " +
    "[class*='popup'], [class*='modal'], " +
    "[class*='breadcrumb'], [class*='pagination'], " +
    "[class*='social-links'], [class*='social-icons'], " +
    "[aria-hidden='true']"
  ).remove();

  const title = $("title").first().text().trim();
  const parts: string[] = [];
  const seen = new Set<string>();

  function add(raw: string) {
    const t = raw
      .replace(/\u00a0/g, " ")  // non-breaking space
      .replace(/\u2007/g, " ")  // figure space
      .replace(/\u202f/g, " ")  // narrow no-break space
      .replace(/\s+/g, " ")
      .trim();
    if (t.length > 1 && !seen.has(t)) {
      seen.add(t);
      parts.push(t);
    }
  }

  // 1. Always: title + meta description + og:site_name
  if (title) add(title);
  add($('meta[name="description"]').attr("content") ?? "");
  add($('meta[property="og:site_name"]').attr("content") ?? "");

  // 2. Walk every visible element and collect text from leaf nodes.
  //    We walk depth-first so parent containers don't duplicate child text.
  //    An element is "leaf-like" if it has no block-level descendants.
  const BLOCK_TAGS = new Set([
    "div", "section", "article", "aside", "main", "header", "footer",
    "p", "ul", "ol", "li", "table", "tr", "td", "th", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6", "address", "form", "fieldset",
  ]);

  // Collect leaf element text (no block children = leaf)
  $("body *").each((_, el) => {
    if (el.type !== "tag") return;
    const $el = $(el);
    const tag = el.name.toLowerCase();

    // Skip if has block descendants (we'll pick up children individually)
    const hasBlockChild = $el
      .children()
      .toArray()
      .some((c) => c.type === "tag" && BLOCK_TAGS.has(c.name.toLowerCase()));

    if (hasBlockChild && !["footer", "address"].includes(tag)) return;

    const t = $el.text().replace(/\s+/g, " ").trim();
    if (t.length > 1) add(t);
  });

  // 3. Fallback: if DOM walk produced sparse results, use full body text instead
  const joined = parts.join("\n");

  // Prepend structured contact info so AI always sees it first
  const structuredLines: string[] = [...jsonLdText, ...microdataLines];
  if (telNumbers.length > 0) structuredLines.push(`Phone: ${[...new Set(telNumbers)].join(", ")}`);
  if (mailtoEmails.length > 0) structuredLines.push(`Email: ${[...new Set(mailtoEmails)].join(", ")}`);
  const jsonLdBlock = structuredLines.length > 0
    ? `[STRUCTURED CONTACT DATA]\n${structuredLines.join("\n")}\n[END STRUCTURED DATA]\n\n`
    : "";

  // Raise threshold: meta title + description alone can be ~200 chars;
  // use bodyText fallback if DOM walk contributed little real page content
  if (joined.length < 800) {
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    const content = bodyText.length > joined.length ? bodyText : joined;
    return { url, title, text: (jsonLdBlock + content).slice(0, TOTAL_CHAR_CAP) };
  }

  return { url, title, text: (jsonLdBlock + joined).slice(0, TOTAL_CHAR_CAP) };
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
