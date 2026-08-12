# Winddown

**Wyoming LLC & Corporation dissolution form preparation tool.**

Winddown scrapes your company website, uses AI to extract the fields needed for Wyoming Articles of Dissolution, and lets you review, correct, and download a filled PDF ready to sign and mail. It is document preparation software — not legal advice.

---

## What it does

1. **You enter your company website URL.** Winddown fetches the homepage and up to 4 sub-pages (Terms, About, Contact, Legal) using a two-tier scraping pipeline.
2. **AI extracts the form fields.** Claude reads the pruned page text and fills in company name, contact email, phone, and address — each with a confidence level and a verbatim evidence snippet so you can verify the source.
3. **You review everything.** Every extracted field is shown with an "Edit" button. Low-confidence fields require explicit confirmation before you can proceed.
4. **You complete the signer details** (name, title, signing date) and select the correct dissolution form from the three available.
5. **You certify.** The statutory W.S. 17-29-701 certification checkbox must be ticked by you — it cannot be pre-checked or set by the AI.
6. **You download the filled PDF.** Print it, sign in ink, and mail to the Wyoming Secretary of State.

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
  │     ├─ Link discovery (same domain, /terms|privacy|legal|about|contact|imprint/, max 4)
  │     └─ Sub-page fetches (same guards applied per hop)
  │
  ├─ Tier 2 fallback (Playwright headless) — only when body < 500 chars (SPA detected)
  │
  ├─ Content pruner — keeps title + headings + footer + qualifying <p> elements
  │     (entity-suffix regex, contact patterns, governing-law sentences)
  │     8 000-char cap across all pages
  │
  └─ Claude claude-sonnet-4-6 — single batched call
        ├─ Each page block wrapped as <page url="...">…</page>
        ├─ report_extracted_fields tool (structured output, 4 fields)
        ├─ certificationAffirmed structurally ABSENT from tool schema
        ├─ Evidence verifier — each field's evidence snippet must appear
        │   verbatim (whitespace-normalised) in the fetched page text;
        │   fabricated snippets → field marked absent
        ├─ Up to 3 retries on 429 / 5xx with exponential backoff
        └─ manual-fallback on auth error or exhausted retries
```

Progress is streamed to the browser via SSE (`text/event-stream`) so you see each step as it happens.

### Anti-hallucination design

The evidence verifier catches **fabricated** snippets — if Claude invents a value not present on the page, the field is dropped and shown as "Needs your input".

Prompt-injection text that genuinely appears in the page (e.g. in a blog comment paragraph) is **not** caught by the verifier by design — it IS verbatim on the page. The defences at that layer are:

- System prompt **CONTEXT-CREDIBILITY RULE**: all page content is explicitly labelled untrusted user-controlled text; Claude is instructed not to follow instructions embedded in it.
- **Low-confidence gate**: suspicious extractions surface as amber-bordered cards requiring explicit human confirmation.
- **Human review step**: every field is shown before the PDF is generated.

### Rate limiting

5 analyses per hour per IP address. The key stored in Redis is `sha256(ip)` — raw IPs are never persisted (FR-021). When Redis is unavailable the system fails open (allows the request) and logs a warning.

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
| Scraping | fetch + cheerio (Tier 1); Playwright + @sparticuz/chromium (Tier 2) |
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
      tier1.ts                # fetch + cheerio + link discovery
      tier2.ts                # Playwright headless fallback
      pruner.ts               # Content pruning (8k cap)
      index.ts                # Scraper orchestrator
    extractor/
      tool-schema.ts          # report_extracted_fields JSON schema
      prompt.ts               # System prompt + CONTEXT-CREDIBILITY RULE
      evidence-verifier.ts    # Verbatim snippet backstop
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
    FieldCard.tsx             # Extracted field display + inline edit
    EvidencePopover.tsx       # Source snippet on hover/tap
    CertificationStep.tsx     # W.S. 17-29-701 certification (unchecked by default)
    PdfPreview.tsx            # Embedded PDF preview iframe
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
ENABLE_TIER2_RENDER=false             # true to enable Playwright headless (slower)
NEXT_PUBLIC_STUB=false                # true for hardcoded stub data (no API calls)
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
pnpm run test:unit        # 119 unit tests (no external APIs)
pnpm run test:pdf         # 14 golden-file PDF tests
pnpm run test:extraction  # 20 fixture extraction tests (Anthropic mocked)

# E2E (requires app running + Playwright browsers installed)
pnpm exec playwright install chromium
pnpm build && pnpm start &
pnpm test:e2e

# Accessibility audit only
pnpm a11y
```

---

## Vercel deployment

See **[Deploying to Vercel](#deploying-to-vercel)** below. Never add secrets to `vercel.json` or commit `.env.local`.

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

## Deploying to Vercel

See the dedicated section below for the step-by-step guide including environment variable configuration.

---

## Legal

Winddown is document preparation software. It does not provide legal advice, does not file documents, and does not guarantee legal outcomes. Consult a licensed attorney before proceeding with a dissolution.

All procedural facts (mailing address, filing fee note, processing time, statute reference) are sourced exclusively from `src/config/wyoming.ts` and should be verified against the current Wyoming Secretary of State website before filing.
