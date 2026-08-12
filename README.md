# Winddown

**Wyoming LLC & Corporation dissolution form preparation tool.**

Winddown scrapes your company website, uses AI to extract the fields needed for Wyoming Articles of Dissolution, and lets you review, correct, and download a filled PDF ready to sign and mail. It is document preparation software — not legal advice.

---

## What it does

1. **You enter your company website URL.** Winddown fetches the homepage and up to 4 sub-pages (Terms, About, Contact, Legal) using a four-tier scraping pipeline.
2. **AI extracts the form fields.** Claude reads the pruned page text and fills in company name, contact email, phone, and address — each with a confidence level and a verbatim evidence snippet so you can verify the source.
3. **You review everything.** Every extracted field is shown with an "Edit" button. Low-confidence fields require explicit confirmation before you can proceed.
4. **You complete the signer details** (name, title, signing date) and select the correct dissolution form from the three available.
5. **You certify.** The statutory W.S. 17-29-701 certification checkbox must be ticked by you — it cannot be pre-checked or set by the AI.
6. **You download the filled PDF.** Print it, sign in ink, and mail to the Wyoming Secretary of State.

---

## Company name extraction & trade names

Winddown extracts the company name in two tiers:

**Tier A — Entity-suffixed legal name (preferred).** If the site shows a name with a legal suffix (LLC, Inc, Corp, etc.) in a copyright line, terms of service, or formal context, that form is extracted and shown with high confidence.

**Tier B — Trade name / brand name (fallback).** Many companies — particularly those operating primarily in another state but holding a Wyoming registration for trademark or compliance reasons — do not display their legal entity name on their website. They operate under a brand or trade name instead. In these cases, Winddown extracts the dominant brand name used across the site and marks it **low confidence**, signalling to the user that the actual legal entity name needs manual verification.

> **Tip for trade names:** If the extracted name is shown as low confidence, look up the exact registered entity name on the Wyoming Secretary of State's business registry: [wyobiz.wyo.gov/Business/FilingSearch.aspx](https://wyobiz.wyo.gov/Business/FilingSearch.aspx). Enter the trade name and the system will return the registered legal entity with its exact suffix and filing details. This is the name that must appear on the dissolution form.

This two-tier approach avoids leaving the field blank when the entity does have a Wyoming registration but does not advertise its full legal name publicly. The user always verifies before the PDF is generated.

---

## How the agent works

When you submit a URL, the backend runs this pipeline:

```
URL submitted
  │
  ├─ SSRF guard — DNS resolves hostname; rejects private/loopback/metadata IPs
  ├─ robots.txt check — per-path, fail-open with logging
  │
  ├─ Tier 1 scraper (fetch + cheerio)
  │     ├─ Homepage fetch (10 s timeout, 2 MB cap, max 5 redirects)
  │     ├─ Raw HTML preserved for link discovery and structured data extraction
  │     ├─ Link discovery (same domain, /terms|privacy|legal|about|contact|imprint/, max 4)
  │     └─ Sub-page fetches (same guards applied per hop)
  │
  ├─ Tier 2 fallback (Playwright headless) — only when body < 500 chars (SPA detected)
  │     └─ Isolated behind an interface; degrades honestly to Tier 3 when unavailable
  │
  ├─ Tier 3 fallback (Firecrawl) — when Tier 1/2 yield an SPA shell or are blocked
  │     ├─ Cloud-rendered markdown; uses Tier-1-discovered links as crawl targets
  │     ├─ Tier-1 raw HTML kept alongside Firecrawl pages so JSON-LD is not lost
  │     └─ Markdown stripped to plain text before pruning
  │
  ├─ Tier 4 fallback (Wayback Machine — archive.org) — when Firecrawl also fails
  │     └─ Two-step: snapshot lookup → fetch archived HTML
  │
  ├─ Content pruner — extracts clean text from raw HTML per page
  │     │
  │     ├─ STRUCTURED DATA EXTRACTION (before any DOM removal)
  │     │     ├─ JSON-LD (script[type="application/ld+json"]) — schema.org
  │     │     │   telephone, email, address, name from LocalBusiness/Organization
  │     │     ├─ HTML microdata (itemprop attributes) — streetAddress,
  │     │     │   addressLocality, addressRegion, postalCode, telephone, email, name
  │     │     └─ tel:/mailto: href attributes — phone numbers and emails from
  │     │         link hrefs (captured before nav/header removal strips them)
  │     │
  │     ├─ DOM pruning — removes scripts, styles, nav, cookie banners, ads,
  │     │   modals, social icons, aria-hidden elements
  │     │
  │     ├─ Leaf-node text walk — depth-first, deduplicating, space-normalised
  │     │
  │     ├─ Fallback: if walk produces < 800 chars, falls back to full body text
  │     │   (picks whichever is longer — walk result or raw body)
  │     │
  │     └─ Output: [STRUCTURED CONTACT DATA] block prepended to page text,
  │         capped at 20 000 chars total across all pages
  │
  └─ Claude claude-sonnet-4-6 — single batched call
        ├─ Each page block wrapped as <page url="...">…</page>
        ├─ report_extracted_fields tool (structured output, 4 fields)
        ├─ certificationAffirmed structurally ABSENT from tool schema
        ├─ Company name: Tier A (entity suffix) preferred; Tier B (trade name)
        │   extracted as low-confidence fallback when no suffix found
        ├─ Evidence verifier — each field's evidence snippet is checked:
        │   1. Verbatim match (whitespace-normalised)
        │   2. Value-based match (phone/email/address ≥ 5 chars)
        │   3. Comma-insensitive match (multi-line addresses ≥ 10 chars)
        │   4. 70% token-overlap match
        │   Fabricated snippets → field marked absent
        ├─ Up to 3 retries on 429 / 5xx with exponential backoff
        └─ manual-fallback on auth error or exhausted retries
```

Progress is streamed to the browser via SSE (`text/event-stream`) so you see each step as it happens.

### Anti-hallucination design

The evidence verifier catches **fabricated** snippets — if Claude invents a value not present on the page, the field is dropped and shown as "Needs your input".

The verifier applies four checks in order: exact verbatim match → value-based match → comma-insensitive match (for multi-line addresses where line breaks are joined with a comma) → 70% word-token overlap. This tolerates minor whitespace and formatting differences while still catching entirely invented content.

Prompt-injection text that genuinely appears in the page (e.g. in a blog comment paragraph) is **not** caught by the verifier by design — it IS verbatim on the page. The defences at that layer are:

- System prompt **CONTEXT-CREDIBILITY RULE**: all page content is explicitly labelled untrusted user-controlled text; Claude is instructed not to follow instructions embedded in it.
- **Low-confidence gate**: suspicious extractions surface as amber-bordered cards requiring explicit human confirmation.
- **Human review step**: every field is shown before the PDF is generated.

### Rate limiting

20 analyses per hour per IP address by default (configurable via `RATE_LIMIT_MAX` environment variable). The key stored in Redis is `sha256(ip)` — raw IPs are never persisted (FR-021). When Redis is unavailable the system fails open (allows the request) and logs a warning.

---

## Forms supported

| Entity type | Form | Selected in UI as |
|---|---|---|
| Wyoming LLC | Articles of Dissolution (W.S. 17-29-701) | `wyoming-llc` |
| Wyoming Corporation | Dissolution by Directors & Shareholders | `wyoming-corp-directors` |
| Wyoming Corporation | Dissolution by Incorporators / Initial Directors | `wyoming-corp-shareholders` |

The user explicitly selects the correct form in Step 2. The AI never chooses the form.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router, TypeScript strict |
| Hosting | Vercel (Fluid Compute) |
| UI | Tailwind CSS, shadcn/ui |
| State | Zustand v5 with sessionStorage persistence |
| Scraping | fetch + cheerio (Tier 1); Playwright + @sparticuz/chromium (Tier 2); Firecrawl (Tier 3); Wayback Machine (Tier 4) |
| Structured data | JSON-LD, HTML microdata (itemprop), tel:/mailto: href extraction |
| AI | Anthropic Claude claude-sonnet-4-6 via `@anthropic-ai/sdk` |
| PDF | pdf-lib (fill) + pdf-parse (test extraction) |
| Rate limiting | Upstash Redis, @upstash/ratelimit (sliding window) |
| Testing | Vitest (unit/extraction/pdf), Playwright (E2E + a11y) |

---

## Project structure

```
src/
  app/
    page.tsx                  # Landing page (static)
    analyze/
      page.tsx                # Suspense wrapper (server component)
      AnalyzeClient.tsx       # SSE progress screen (client)
    review/
      page.tsx                # Suspense wrapper (server component)
      ReviewClient.tsx        # Full review/certify/download flow (client)
    done/
      page.tsx                # Next-steps page
    api/
      analyze/route.ts        # POST → SSE stream (scrape + extract)
      generate-pdf/route.ts   # POST → PDF bytes
  lib/
    scraper/
      ssrf-guard.ts           # DNS resolution + CIDR block list
      robots.ts               # robots.txt fetcher/parser
      tier1.ts                # fetch + cheerio + link discovery (returns rawHtml)
      tier2.ts                # Playwright headless fallback (SPA detection)
      tier3-firecrawl.ts      # Firecrawl cloud rendering fallback
      tier4-wayback.ts        # Wayback Machine fallback (archive.org)
      pruner.ts               # Content pruning: JSON-LD + microdata + tel/mailto
                              #   extraction → DOM pruning → leaf walk → 20k cap
      index.ts                # Scraper orchestrator (4-tier pipeline)
    extractor/
      tool-schema.ts          # report_extracted_fields JSON schema
      prompt.ts               # System prompt + CONTEXT-CREDIBILITY RULE
                              #   + Tier A/B company name extraction logic
      evidence-verifier.ts    # Verbatim/value/comma-insensitive/token-overlap backstop
      index.ts                # Claude call + retry + per-field verification
    pdf/
      index.ts                # pdf-lib fill service (AcroForm + coordinates)
      form-template-registry.ts
    rate-limit.ts             # Upstash sliding-window rate limiter
    form-state.ts             # Zustand store
  schemas/
    extraction.ts             # ExtractionResult Zod schema
    intake.ts                 # IntakeState Zod schema
    form-templates/
      wyoming-llc.ts
      wyoming-corp.ts         # Directors + Shareholders variants
  config/
    wyoming.ts                # Single source of truth for procedural facts
  components/
    FieldCard.tsx             # Extracted field display + inline edit + field-level validation
    EvidencePopover.tsx       # Source snippet on hover/tap
    CertificationStep.tsx     # W.S. 17-29-701 certification (unchecked by default)
    PdfPreviewModal.tsx       # Full-screen PDF preview modal (portal to document.body)
    SignaturePadModal.tsx     # Canvas signature drawing pad (mouse + touch)
    LandingClient.tsx         # URL input + auth checkbox
    StartOverLink.tsx         # Clears session and returns to /
  mcp/
    server.ts                 # MCP stdio server
    tools/
      analyze-company-site.ts # MCP tool (calls scrape/extract directly)
      prepare-dissolution.ts  # MCP tool (preview PDF only)
    TOOL-CONTRACTS.md         # Tool schemas + human-only certification gate

src/assets/forms/             # Official Wyoming blank PDF forms (committed)
tests/
  unit/                       # Schema, SSRF, pruner, evidence-verifier, rate-limit
  extraction/                 # Scraper + extractor fixture tests
  pdf/                        # Golden-file PDF test
  e2e/                        # Playwright: full journey, a11y, SSE latency
  fixtures/                   # HTML fixture sites (footer-name, adversarial, etc.)
```

---

## Local development

### Prerequisites

- Node.js 20 LTS
- pnpm (`npm install -g pnpm`)
- Anthropic API key
- Upstash Redis database (free tier works)

### Setup

```bash
git clone <repo>
cd winddown
pnpm install
cp .env.example .env.local   # fill in the values below
pnpm dev                     # http://localhost:3000
```

### Environment variables (`.env.local`)

```
ANTHROPIC_API_KEY=sk-ant-...          # from console.anthropic.com
UPSTASH_REDIS_REST_URL=https://...    # from console.upstash.com → REST API
UPSTASH_REDIS_REST_TOKEN=...          # same dashboard
FIRECRAWL_API_KEY=fc-...              # from firecrawl.dev (Tier 3 fallback)
ENABLE_TIER2_RENDER=false             # true to enable Playwright headless (slower)
NEXT_PUBLIC_STUB=false                # true for hardcoded stub data (no API calls)
RATE_LIMIT_MAX=20                     # analyses per hour per IP (default: 20)
```

**These values must never be committed.** `.env.local` is in `.gitignore`.

### Running without API keys (stub mode)

```bash
NEXT_PUBLIC_STUB=true pnpm dev
```

Open `http://localhost:3000/review?stub=true` — full UI flow with hardcoded "Acme Solutions LLC" data. No Anthropic or Redis needed.

---

## Running tests

```bash
pnpm run test:unit        # unit tests (no external APIs)
pnpm run test:pdf         # golden-file PDF tests
pnpm run test:extraction  # fixture extraction tests (Anthropic mocked)

# E2E (requires app running + Playwright browsers installed)
pnpm exec playwright install chromium
pnpm build && pnpm start &
pnpm test:e2e

# Accessibility audit only
pnpm a11y
```

---

## MCP server (stretch / Claude Code integration)

Winddown exposes an MCP server that lets an AI agent (e.g. Claude Code) assist with dissolution form preparation without a browser.

```bash
pnpm mcp:start    # starts the stdio MCP server
pnpm mcp:demo     # interactive demo script
```

### Tools

| Tool | What it does | Certification? |
|---|---|---|
| `analyze_company_site` | Scrapes URL + extracts fields | No |
| `prepare_dissolution` | Generates preview PDF | No — preview only |

**`certificationAffirmed` is not a tool parameter.** The MCP server intentionally cannot certify on behalf of a user. See `src/mcp/TOOL-CONTRACTS.md` for the full contract.

---

## Legal

Winddown is document preparation software. It does not provide legal advice, does not file documents, and does not guarantee legal outcomes. Consult a licensed attorney before proceeding with a dissolution.

All procedural facts (mailing address, filing fee note, processing time, statute reference) are sourced exclusively from `src/config/wyoming.ts` and should be verified against the current Wyoming Secretary of State website before filing.
