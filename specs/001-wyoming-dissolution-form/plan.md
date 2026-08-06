# Implementation Plan: Wyoming Dissolution Form Preparation

**Branch**: `001-wyoming-dissolution-form` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-wyoming-dissolution-form/spec.md`

## Summary

Winddown is a Next.js 14 App Router web application that prepares Wyoming LLC Articles of
Dissolution by reading a company's public website. A two-tier server-side scraping pipeline
(fetch + cheerio → Playwright fallback) extracts candidate page text, which is pruned and
sent in a single Anthropic Claude call. Every AI-returned field is validated through a Zod
schema and an evidence-verification backstop (verbatim snippet present in fetched page text)
before entering client-side Zustand state. The user reviews, edits, and supplements extracted
fields on a single review screen, actively affirms the statutory certification, confirms
accuracy, and downloads a pdf-lib–generated PDF. Nothing is persisted server-side except an
Upstash Redis counter (`hash(IP) + counter + TTL 1h`) used for rate limiting.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS

**Primary Dependencies**:
- Next.js 14 App Router (React 18, Server Components, Route Handlers)
- Zustand 4 + sessionStorage persistence adapter
- Tailwind CSS + shadcn/ui component library
- cheerio (Tier 1 HTML parsing)
- Playwright + @sparticuz/chromium (Tier 2 headless render; interface-isolated)
- pdf-lib (server-side PDF generation; streams, no disk writes)
- Zod (schema validation at every ingestion boundary)
- @anthropic-ai/sdk (Claude claude-sonnet-4-6; server-side only)
- @upstash/redis + @upstash/ratelimit (rate-limit counter store)
- robots-parser (robots.txt compliance)
- tldts (registrable domain extraction for same-domain guard)
- pdf-parse (PDF text extraction in golden-file tests only)

**Storage**: Upstash Redis — rate-limit counter only (`ratelimit:analyze:{hash(ip)}`,
integer counter, TTL 3600 s). No URLs, page content, field values, or form data stored.
This is the sole server-side persistent store; it is explicitly not a violation of
Constitution Principle V (Privacy by Default) because no user data is retained. All other
state is client-side (Zustand + sessionStorage) or transient per-request.

**Testing**: Vitest (unit + fixture extraction + golden-file), Playwright (E2E), pdf-parse
(PDF text extraction in tests)

**Target Platform**: Vercel Fluid Compute (Node.js 20 runtime). Playwright chromium is
viable with @sparticuz/chromium within Vercel's 5 GB package size limit. The Tier 2 scraper
is interface-isolated so it can be feature-flagged or swapped without changing callers.

**Project Type**: Full-stack web application (Next.js, single repo)

**Performance Goals**:
- Static-site extraction end-to-end: < 15 s
- Rendered-site extraction end-to-end: < 30 s
- SSE progress first event: < 1 s after URL submission
- Landing page Lighthouse: ≥ 90 all four categories

**Constraints**:
- 2 MB response cap per fetched page; 10 s timeout (static), 20 s timeout (rendered)
- Max 5 redirects, max 5 pages per analysis run
- Zero server-side persistence of user data, page content, or PDFs
- Rate limit: 5 user-initiated analyses per IP per hour

**Scale/Scope**: Consumer web app, no auth, no database. Rate-limited at infrastructure
layer. v1 supports one form template (Wyoming LLC dissolution).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design below.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Type Safety & Validated Inputs | ✅ PASS | TypeScript strict throughout; Zod validates all LLM output and scraped content at ingestion boundary; `any` forbidden without inline justification |
| II. Extraction Integrity | ✅ PASS | Evidence backstop rejects fields whose snippets are not verbatim in page text; `provenance` + `userOverridden` flags are schema-level defensive invariants; certifications excluded from extraction scope in tool schema and prompt |
| III. Legal Safety & Correctness | ✅ PASS | `LegalDisclaimer` component rendered on every form screen; procedural facts sourced exclusively from `src/config/wyoming.ts`; server-side re-validates confirmations before PDF generation; signature line structurally blank |
| IV. Scraping Safety & Ethics | ✅ PASS | SSRF guard (DNS resolve → IP range check) before any connection; 2 MB cap, 10/20 s timeouts, 5 redirects, 5 pages, robots.txt per path, `WinddownBot/1.0` User-Agent; tldts same-domain enforcement |
| V. Privacy by Default | ✅ PASS | Rate-limit store: `hash(IP) + counter + TTL` only — not user data. All other server paths are stateless. Logs: latency + status code + error class only. API key server-side env var only. |

**Privacy carve-out (explicit)**: The Upstash Redis counter stores only `hash(IP) + integer
counter + TTL(1h)`. No URL, page content, extracted field, or form value is stored at any
point. This store does not violate Principle V; the distinction is documented here and in
FR-021/FR-026 to prevent it from being flagged as contradictory during analysis.

**Post-Phase-1 re-check**: All principles remain satisfied. No complexity violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-wyoming-dissolution-form/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── analyze-sse.md   # POST /api/analyze SSE contract
│   └── generate-pdf.md  # POST /api/generate-pdf contract
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── page.tsx                        # / — static landing page
│   ├── analyze/
│   │   └── page.tsx                    # /analyze — SSE progress screen
│   ├── review/
│   │   └── page.tsx                    # /review — board + gap-completion +
│   │                                   #   certification + preview + download
│   ├── done/
│   │   └── page.tsx                    # /done — next-steps page
│   └── api/
│       ├── analyze/
│       │   └── route.ts                # POST /api/analyze → SSE stream
│       └── generate-pdf/
│           └── route.ts                # POST /api/generate-pdf → application/pdf
├── components/
│   ├── ui/                             # shadcn/ui primitives (auto-generated)
│   ├── LegalDisclaimer.tsx             # Persistent disclaimer (mandatory on every
│   │                                   #   screen that renders form data)
│   ├── FieldCard.tsx                   # Extracted field review card (value +
│   │                                   #   source badge + confidence + inline edit)
│   ├── EvidencePopover.tsx             # Verbatim evidence snippet popover
│   ├── ProgressStream.tsx              # SSE consumer + progress message list
│   ├── CertificationStep.tsx           # W.S. 17-29-701 explanation + duties list
│   │                                   #   + checkbox (never pre-checked)
│   └── PdfPreview.tsx                  # Embedded PDF preview (iframe/object)
├── lib/
│   ├── scraper/
│   │   ├── index.ts                    # Orchestrator: SSRF guard → robots → tier
│   │   │                               #   selection → page discovery → pruning
│   │   ├── tier1.ts                    # fetch() + cheerio extraction pipeline
│   │   ├── tier2.ts                    # Playwright headless pipeline (interface-
│   │   │                               #   isolated behind ScraperTier interface)
│   │   ├── ssrf-guard.ts               # DNS resolve + private/loopback/metadata
│   │   │                               #   IP range rejection
│   │   ├── robots.ts                   # robots.txt fetch, parse, path check
│   │   └── pruner.ts                   # Entity-regex + contact-pattern pruning;
│   │                                   #   8k char cap across all pages
│   ├── extractor/
│   │   ├── index.ts                    # Claude call + retry logic + post-validation
│   │   ├── prompt.ts                   # System prompt + <page> block assembly
│   │   ├── tool-schema.ts              # report_extracted_fields tool JSON schema
│   │   └── evidence-verifier.ts        # Verbatim snippet check (normalized WS);
│   │                                   #   rejects fields whose evidence is absent
│   ├── pdf/
│   │   ├── index.ts                    # PDF generation: load template → fill
│   │   │                               #   fields (AcroForm or coordinates) →
│   │   │                               #   stream bytes; signature line untouched
│   │   └── form-template-registry.ts   # FormTemplate loader + registry lookup
│   ├── rate-limit.ts                   # Upstash sliding-window counter;
│   │                                   #   stores hash(IP) + counter + TTL only
│   └── form-state.ts                   # Zustand store definition + sessionStorage
│                                       #   persist adapter + reset-on-start-over
├── config/
│   └── wyoming.ts                      # SOLE source of procedural facts:
│                                       #   mailing address, fee note, statute ref,
│                                       #   processing time, SOS URLs, lastVerified
├── schemas/
│   ├── extraction.ts                   # ExtractionResult + ExtractedField Zod schemas
│   ├── form-state.ts                   # FormState Zod schema
│   ├── intake.ts                       # IntakeState Zod schema (sent to /api/generate-pdf)
│   └── form-templates/
│       └── wyoming-llc.ts              # Wyoming LLC FormTemplate + field Zod schema
└── assets/
    └── forms/
        └── wyoming-llc-dissolution.pdf # Official blank dissolution form (committed asset)

tests/
├── unit/
│   ├── schemas/                        # Zod schema unit tests (valid / invalid /
│   │                                   #   boundary for every schema)
│   ├── ssrf-guard.test.ts              # Table-driven: private CIDRs, loopback,
│   │                                   #   metadata IPs must be rejected; public
│   │                                   #   IPs must pass
│   ├── pruner.test.ts                  # Entity-regex, contact-pattern, cap logic
│   ├── evidence-verifier.test.ts       # Fabricated snippet → rejected;
│   │                                   #   real snippet → accepted; WS normalization
│   └── rate-limit.test.ts              # Counter increment, TTL, 429 boundary
│                                       #   (Redis mocked)
├── fixtures/
│   ├── footer-name.html                # Legal name in footer © line
│   ├── terms-name.html                 # Legal name only in Terms of Service body
│   ├── spa-shell.html                  # JS SPA with no SSR text (< 500 chars body)
│   ├── no-name.html                    # Page with no detectable entity name
│   └── adversarial.html               # Prompt-injection text in non-legal context
├── extraction/
│   └── extractor.test.ts               # Fixture HTML → extraction result assertions
│                                       #   + evidence-backstop behavior
├── pdf/
│   └── golden-file.test.ts             # Known IntakeState → PDF bytes → pdf-parse
│                                       #   text → field match + signature line blank
└── e2e/
    └── full-journey.spec.ts            # Playwright: fixture site → URL submit →
                                        #   review → certify → confirm → download;
                                        #   assert PDF validity + company name
```

**Structure Decision**: Single Next.js App Router repo. Server-side logic lives in
`src/lib/` (scraper, extractor, pdf, rate-limit) and is invoked exclusively from API route
handlers. Client state is `src/lib/form-state.ts` (Zustand). No separate backend process.

## Complexity Tracking

> No constitution violations requiring justification. All complexity is mandated by
> functional requirements (two-tier scraper for SPA support, rate-limit store, evidence
> backstop) and constitutional constraints (SSRF guard, zero persistence, Zod validation).
