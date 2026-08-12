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
    const t = raw.replace(/\s+/g, " ").trim();
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

  // 3. Fallback: if we got very little, use full body text
  const joined = parts.join("\n");
  if (joined.length < 200) {
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    return { url, title, text: bodyText.slice(0, TOTAL_CHAR_CAP) };
  }

  return { url, title, text: joined };
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
