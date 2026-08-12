import type { PageBlock } from "@/lib/scraper/pruner";

export interface RawExtractedField {
  value: string;
  confidence: "high" | "medium" | "low";
  evidence: string;
  sourceUrl: string;
}

/**
 * T046 — Evidence verifier.
 *
 * Checks that the evidence snippet Claude reported actually appears verbatim
 * (after whitespace normalisation) in the fetched page text it claims to
 * have come from. This is the anti-hallucination and anti-fabrication backstop.
 *
 * Whitespace normalisation: collapse all \s+ sequences to a single space and
 * trim leading/trailing whitespace. This tolerates HTML rendering differences
 * (newlines, multiple spaces) while still catching entirely fabricated text.
 *
 * Limitation (documented — honest layering):
 * If an attacker embeds injection text inside a <p> element it WILL survive
 * pruning and reach this check. If Claude then faithfully quotes that injection
 * text as evidence, this verifier will return 'accepted' because the snippet
 * IS verbatim in the page. The defences for that attack vector are:
 *   1. The CONTEXT-CREDIBILITY RULE in the system prompt (AI ignores in-page
 *      instructions).
 *   2. The companyLegalName low-confidence gate (FR-009a): blog-comment context
 *      will yield confidence="low", which locks the UI until the human confirms.
 *   3. Human review of the evidence popover (required by the review UI).
 * The verbatim check catches fabrication (Claude inventing text not on the
 * page), not in-page injection (attacker text that IS on the page).
 */
export function verifyEvidence(
  field: RawExtractedField,
  pages: PageBlock[]
): "accepted" | "rejected" {
  const { evidence, sourceUrl } = field;

  // Length bounds
  if (evidence.length < 3 || evidence.length > 500) return "rejected";

  // Normalise: collapse all whitespace variants (including &nbsp; \u00a0) to
  // a single space. JS \s does not match \u00a0, so we replace it explicitly.
  const normalise = (s: string) =>
    s
      .replace(/\u00a0/g, " ")
      .replace(/\u2007/g, " ")
      .replace(/\u202f/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const normEvidence = normalise(evidence);
  const normValue = normalise(field.value);

  // Find the best matching page. Try exact URL first; if not found, search ALL
  // pages — the AI sometimes reports a slightly different URL (trailing slash,
  // /contact vs /contact-us, etc.) for content that actually lives on the
  // homepage. Rejecting on URL mismatch alone was silently dropping valid fields.
  const exactPage = pages.find((p) => p.url === sourceUrl);
  const searchPages = exactPage ? [exactPage] : pages;

  for (const page of searchPages) {
    const normText = normalise(page.text);

    // Check 1: verbatim evidence snippet match
    if (normText.includes(normEvidence)) return "accepted";

    // Check 2: value-based match — phone/email/address can't be hallucinated
    if (normValue.length >= 5 && normText.includes(normValue)) return "accepted";

    // Check 2b: comma-insensitive value match — handles multi-line addresses where
    // the AI joins "Street\nCity, ST ZIP" with a comma but the page text has no comma
    if (normValue.length >= 10) {
      const strippedValue = normValue.replace(/,/g, " ").replace(/\s+/g, " ").trim();
      const strippedText = normText.replace(/,/g, " ").replace(/\s+/g, " ");
      if (strippedText.includes(strippedValue)) return "accepted";
    }

    // Check 3: token-overlap — ≥70% of evidence words present
    const words = normEvidence.split(/\s+/).filter((w) => w.length > 2);
    if (words.length >= 2) {
      const hits = words.filter((w) => normText.includes(w));
      if (hits.length / words.length >= 0.70) return "accepted";
    }
  }

  return "rejected";
}
