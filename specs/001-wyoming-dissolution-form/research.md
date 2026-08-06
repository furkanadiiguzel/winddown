# Research: Wyoming Dissolution Form Preparation

**Feature**: 001-wyoming-dissolution-form | **Date**: 2026-08-06

All technical unknowns identified during planning are resolved here. Each decision is stated
with rationale and alternatives considered.

---

## 1. Playwright on Vercel Fluid Compute

**Decision**: Use `playwright-core` + `@sparticuz/chromium` for Tier 2 headless rendering.
The Tier 2 scraper is hidden behind a `ScraperTier` interface so it can be feature-flagged
or replaced without changing callers.

**Rationale**: Vercel's Fluid Compute now supports up to 5 GB package size and runs full
Node.js, making `@sparticuz/chromium` (a pre-built, compressed Chromium binary sized for
serverless) viable. The interface isolation means that if Tier 2 proves undeployable
(binary too large after tree-shaking, cold-start too slow), the fallback path is an honest
"rendered sites not supported — please enter details manually" rather than a silent failure,
consistent with Constitution Principle I and the spec's honest-failure requirement (FR-005).

**Alternatives considered**:
- `puppeteer` + full Chrome: too large even at 5 GB limit.
- External browser-as-a-service (Browserless.io, Playwright Cloud): introduces a third-party
  data dependency inconsistent with the privacy posture; rejected.
- No Tier 2 at all: violates the spec requirement to support JS-heavy sites (User Story 2);
  rejected.

**Feature flag**: `ENABLE_TIER2_RENDER=true|false` environment variable. When false, the
scraper always returns Tier 1 results; if body text < 500 chars, the SSE stream emits a
`tier2_unavailable` event and the review board opens in manual-entry mode.

---

## 2. Rate Limiting on Vercel Serverless

**Decision**: `@upstash/ratelimit` sliding-window algorithm, 5 requests per 3600 seconds,
keyed by `ratelimit:analyze:{sha256(ip)}`. Upstash Redis (serverless-native HTTP client,
no persistent TCP connection).

**Rationale**: Vercel routes concurrent requests to different function instances, making any
in-memory counter useless across invocations. Upstash Redis uses an HTTP API so connections
work in serverless without connection pooling. The sliding-window algorithm prevents burst
abuse more effectively than a fixed window (which resets at a clock boundary). SHA-256 of
the raw IP ensures no plaintext IP address is stored. Counter record stores only the integer
count; the key is the hashed IP plus the algorithm's internal TTL management.

**Privacy compliance**: The Redis key is `sha256(ip)` — irreversible. The value is an
integer counter. No URL, page text, company name, or form data is stored. This is
documented explicitly in FR-021/FR-026 and the plan's Privacy carve-out section to prevent
it from being misread as a privacy violation during code review.

**Retry-After calculation**: The sliding-window `@upstash/ratelimit` response includes
`reset` (epoch ms). `Retry-After` header value = `Math.ceil((reset - Date.now()) / 1000)`.

**Alternatives considered**:
- Vercel KV: no longer offered; replaced by Marketplace integrations.
- In-memory Map: does not survive across invocations; rejected.
- No rate limiting: leaves the scraping infrastructure open to abuse at Anthropic API cost;
  rejected.

---

## 3. SSE Streaming in Next.js App Router Route Handlers

**Decision**: Return `new Response(new ReadableStream({ start(controller) { … } }), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })` from the route handler. Run on Node.js runtime (Fluid Compute, default). No `runtime = 'edge'`.

**Rationale**: Streaming `text/event-stream` works natively on the Node.js runtime in Next.js
App Router route handlers. Edge runtime is not needed and would lose Node.js APIs required
by the scraper. Each SSE event is a JSON payload encoded as `data: {...}\n\n`. The client
uses the native `EventSource` API.

**Event format**: See `contracts/analyze-sse.md` for the full event schema.

**Alternatives considered**:
- WebSocket: heavier protocol; SSE is sufficient for unidirectional progress updates.
- Edge runtime streaming: would require removing all Node.js dependencies from the route;
  incompatible with the SSRF guard's DNS lookup and Playwright's Tier 2; rejected.
- Long-polling: poor UX for a 15–30 s operation; rejected.

---

## 4. Evidence Verification (Anti-Hallucination Backstop)

**Decision**: After Zod parsing the Claude tool call response, for each field where
`evidence` is non-null: normalize both the `evidence` string and the full fetched page text
for the `sourceUrl` (collapse all `\s+` sequences to a single space, trim) and assert
`normalizedPageText.includes(normalizedEvidence)`. Fields failing this check are set to
`{ status: 'rejected' }` and surfaced as missing.

**Rationale**: This is the primary defence against both AI hallucination (fabricated values
not in the source) and prompt-injection attacks (injected text claiming to be evidence but
not present in the actual page). The verbatim check cannot be gamed by the LLM without the
injected text also appearing in the actual page HTML — which the SSRF guard and domain cap
already constrain. Normalization handles minor whitespace differences between HTML rendering
and snippet extraction.

**Boundary conditions**:
- Evidence longer than 500 characters: reject (implausibly long; likely hallucinated).
- Evidence shorter than 3 characters: reject (too short to be meaningful).
- `sourceUrl` not in the set of fetched pages: reject immediately (cannot verify).

**Alternatives considered**:
- Semantic similarity check (embeddings): too slow and introduces another API dependency;
  verbatim check is simpler, faster, and more conservative (appropriate for legal context).
- No evidence check (trust Zod only): insufficient; Zod validates shape, not truthfulness.

---

## 5. PDF Generation: AcroForm vs. Coordinate Fallback

**Decision**: The `FormTemplate.fieldMap` entry for each field specifies `type: 'acroform'
| 'coordinates'`. The PDF generation pipeline attempts AcroForm first; if the official PDF
lacks the named field, it falls back to coordinate-based `drawText()`. Both paths are
defined in the field map at registration time, not discovered at runtime.

**Rationale**: Official government PDF forms vary: some use fillable AcroForm fields, others
are image-based or have inconsistent field naming. Defining the fallback coordinates in the
FormTemplate registry means the switch is predictable, testable, and covered by the
golden-file test. The golden-file test exercises both paths.

**Signature line**: The signature field is explicitly excluded from the field map. It appears
on the form only as static printed text ("Signature: ___________"). No code path writes to
the signature area. The golden-file test asserts the signature area contains no filled text.

**Alternatives considered**:
- Pure coordinate rendering: removes AcroForm dependency entirely but produces PDFs that
  fail accessibility and PDF/A compliance checks on some processors; hybrid is better.
- Runtime field-map discovery (inspect PDF structure at runtime): unpredictable; makes the
  golden-file test non-deterministic; rejected.

---

## 6. sessionStorage + Zustand Persistence

**Decision**: Zustand `persist` middleware with a custom `sessionStorage` adapter. The store
is partitioned under key `winddown-form-state`. On "Start over", the store dispatches a
`reset()` action that sets all fields to initial values and then calls
`sessionStorage.removeItem('winddown-form-state')` to guarantee no residue survives a
page reload.

**Rationale**: `sessionStorage` is cleared automatically when the browser tab is closed,
which aligns with the privacy requirement that no user data outlives the session without
explicit action. The explicit `removeItem` in `reset()` handles the in-tab start-over case.

**Snapshot-bound confirmations**: `certificationAffirmed` and `userConfirmedReview` are
Zustand fields initialized to `false`. Any action that mutates a form field (via
`setFieldValue`) calls `resetConfirmations()` as part of the same dispatch, ensuring both
flags return to `false` atomically.

**Test assertion requirement (per spec FR-025)**: A unit test verifies that after `reset()`
is called, every field in the store returns to its initial value and `sessionStorage` contains
no `winddown-form-state` key.

**Alternatives considered**:
- `localStorage`: survives tab close; inconsistent with the session-bound privacy posture;
  rejected.
- Server-side session: contradicts the zero-persistence requirement; rejected.

---

## 7. Same-Domain Enforcement

**Decision**: Use `tldts` to extract the registrable domain (e.g., `example.com` from
`www.example.com`) from the user-submitted URL. During page discovery, candidate links are
filtered to only those whose `tldts`-parsed registrable domain matches the submitted URL's
registrable domain. Subdomains of the same registrable domain are allowed (e.g.,
`legal.example.com` when the submitted URL is `www.example.com`); cross-registrable-domain
links are discarded.

**Rationale**: `tldts` correctly handles public suffix list edge cases (e.g.,
`example.co.uk`, `example.github.io` is a different registrable domain from
`other.github.io`). A naive hostname comparison would allow or block incorrectly on these
cases.

**Alternatives considered**:
- `new URL().hostname` comparison: fails on public-suffix-list edge cases; rejected.
- Exact hostname match (no subdomains): too restrictive — many legal pages live on
  subdomains; rejected.

---

## 8. Content Pruning Strategy

**Decision**: Per fetched page, extract and concatenate:
1. `<title>` text
2. All `<h1>`–`<h3>` text
3. Footer element text (`<footer>`, elements with `role="contentinfo"`, elements with
   class/id containing "footer")
4. All `<p>` text containing a match for the entity-suffix regex
   `/\b(LLC|L\.L\.C\.|Inc\.?|Corp\.?|Ltd\.?|Company|L\.P\.|LP|PLC)\b/i`
5. All `<p>` text containing an email address or phone number pattern
6. All `<p>` text containing governing-law signals
   (`/governing law|jurisdiction|formed (in|under)|incorporated (in|under)/i`)

Total across all pages is capped at 8,000 characters. Pages are truncated in fetch order
(home first) if the cap is reached.

**Rationale**: This is a targeted extraction, not a full-text dump. It reduces tokens sent
to Claude (cost + latency), focuses the model on the content most likely to contain
identifying information, and reduces the surface area for prompt injection (only
structured, context-rich paragraphs are included, not raw comment sections or hidden text).

**Alternatives considered**:
- Full page text: too large for the context window efficiently; exposes more injection
  surface; rejected.
- LLM-based selector (ask Claude what to include): circular dependency; rejected.
