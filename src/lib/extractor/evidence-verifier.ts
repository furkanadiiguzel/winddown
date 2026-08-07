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

  // sourceUrl must be one of the fetched pages
  const page = pages.find((p) => p.url === sourceUrl);
  if (!page) return "rejected";

  // Verbatim check with whitespace normalisation
  const normalise = (s: string) => s.replace(/\s+/g, " ").trim();
  return normalise(page.text).includes(normalise(evidence)) ? "accepted" : "rejected";
}
