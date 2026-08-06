<!--
SYNC IMPACT REPORT
==================
Version change:    (none) → 1.0.0  (initial ratification)
Added sections:    Core Principles (I–V), Testing Standards, UX & Simplicity, Governance
Removed sections:  n/a (template placeholders replaced)
Modified sections: n/a
Deferred TODOs:    none
-->

# Winddown Constitution

## Core Principles

### I. Type Safety & Validated Inputs (NON-NEGOTIABLE)

TypeScript strict mode MUST be enabled across the entire codebase. The `any` type is
forbidden without an inline comment that names the specific constraint preventing a typed
alternative.

All LLM outputs AND all scraped web content are untrusted input and MUST be treated as
adversarial data — never as executable instructions. Every field entering application state
MUST pass a Zod schema validation boundary first. No raw LLM response or raw HTML/text
fragment may be stored or rendered without first being validated.

Rationale: LLM outputs and third-party web content are the two primary attack surfaces. A
strict type boundary at ingestion prevents prompt-injection escalation into application logic
and provides a single, auditable validation layer.

### II. Extraction Integrity (NON-NEGOTIABLE)

Every AI-extracted field MUST carry the shape `{ value, confidence, evidence, sourceUrl }`.
`evidence` is a verbatim snippet from the scraped source page that proves `value`. A field
without evidence MUST be rejected — it may not enter application state.

The extractor MUST NOT fabricate a value absent from the scraped content. A missing field is
a first-class state surfaced as "needs your input", not a failure and never a guess.

Legal declarations (specifically, the W.S. 17-29-701 certification) are categorically
outside extraction scope. No code path may allow the extractor to populate or suggest a
certification value. Only an explicit, informed user action may set a certification field.

Manual user edits ALWAYS take precedence over extracted values. Re-extraction MUST NOT
overwrite any field the user has manually edited.

Rationale: Dissolution documents have binding legal consequences. Fabricated or
unverifiable values, and any extractor influence over legal certifications, create liability
that the application must structurally eliminate, not merely warn against.

### III. Legal Safety & Correctness (NON-NEGOTIABLE)

This product prepares documents; it does not give legal advice. Every screen that renders
form data MUST also render the legal disclaimer component — there is no exception path.

Procedural facts (filing fee, mailing address, statute references, processing time) MUST
live exclusively in `src/config/wyoming.ts` with a `lastVerified` date field. They MUST NOT
be extracted from third-party pages and MUST NOT be hard-coded anywhere else in the codebase.

The user MUST review every form field and tick an explicit accuracy confirmation before PDF
generation is unlocked. No silent scrape → fill → download code path may exist at any layer
of the application.

Rationale: Incorrect procedural facts (wrong fee, wrong address) can void a dissolution
filing. A single authoritative config file with a verification date makes staleness
detectable and corrections atomic.

### IV. Scraping Safety & Ethics (NON-NEGOTIABLE)

Web fetching MUST be server-side only. Every fetch MUST enforce:

- **SSRF protection**: block private IPv4/IPv6 ranges, loopback addresses, and known cloud
  metadata endpoints (169.254.169.254, fd00:ec2::254, etc.) before initiating any connection.
- **Response size cap**: 2 MB maximum; responses exceeding this limit are rejected.
- **Timeout**: 10 s for static pages, 20 s for rendered (JS-executed) pages.
- **Redirect cap**: 5 redirects maximum; further redirects abort the request.
- **User-Agent**: a descriptive, honest User-Agent string identifying the application.
- **robots.txt compliance**: the disallow directives for any fetched path MUST be respected.

Analysis is bounded to at most 5 pages per run: the home page plus up to 4
legal/about/contact candidate pages. Crawling beyond the target site's own registered domain
is prohibited.

Rationale: SSRF vulnerabilities in server-side scrapers are a critical class of cloud
security bug. The page cap and domain boundary prevent the application from being used as an
unconstrained crawler.

### V. Privacy by Default (NON-NEGOTIABLE)

No scraped content, extracted data, or generated PDFs may be persisted server-side beyond
the lifetime of the originating request. Server logs MUST record only latency, HTTP status
codes, and error class names — never page content, extracted field values, or PDF bytes.

The Anthropic API key MUST remain server-side only and MUST NOT be exposed to the client
bundle, browser environment, or any log output.

Rationale: The scraped pages and dissolution forms may contain sensitive personal or
business information. Zero server-side retention is the only guarantee that eliminates data
breach scope entirely.

## Testing Standards

The following test categories are mandatory. A feature is not shippable unless all
applicable tests exist and pass:

- **Zod schema unit tests**: every schema requires passing, failing, and boundary-condition
  test cases. Schema tests MUST run in isolation without network or file-system access.
- **Extraction fixture tests**: the extractor MUST be tested against fixture HTML pages
  covering: footer-embedded company name, terms-page company name, SPA shell with no SSR
  content, and an adversarial prompt-injection page. Each fixture has a declared expected
  output; the test asserts exact match.
- **PDF golden-file test**: given a fully-specified known form state, the pipeline generates
  a PDF whose extracted text matches expected field values. The signature/certification line
  MUST remain blank in the output — any non-blank value is a test failure.
- **Playwright E2E**: one full happy-path test covering URL input → extraction → field
  review and manual completion → accuracy confirmation → PDF download. This test MUST run in
  CI against a locally-served instance.

## UX & Simplicity

- A single design system MUST be used throughout. All interactive components MUST meet
  WCAG 2.1 AA contrast and keyboard navigability requirements.
- The landing page MUST be statically generated and score Lighthouse ≥ 90 on all four
  categories (Performance, Accessibility, Best Practices, SEO).
- No database, authentication system, or payment integration is permitted. These are
  explicitly out of scope.
- Client-side state MUST use Zustand exclusively; no additional state-management libraries.
- Form definitions MUST be driven by a `FormTemplate` registry (configuration over code).
  Adding a new form field MUST not require changes outside the registry entry and its
  corresponding Zod schema.

## Governance

This constitution is the supreme governance document for the Winddown project. It supersedes
all other written or verbal conventions. Any practice that conflicts with a principle stated
here is non-compliant regardless of precedent or convenience.

**Amendment procedure**:
1. Propose the amendment with a written rationale explaining why the current principle is
   insufficient or incorrect.
2. All NON-NEGOTIABLE designations require explicit confirmation that the safety/legal
   rationale has been considered and is still satisfied by the amended text.
3. Update `LAST_AMENDED_DATE` and increment `CONSTITUTION_VERSION` per the versioning policy
   below.
4. Commit with message format: `docs: amend constitution to vX.Y.Z (<summary>)`.

**Versioning policy**:
- MAJOR: removal or redefinition of a NON-NEGOTIABLE principle, or removal of a mandatory
  test category.
- MINOR: new principle or section added; materially expanded guidance on an existing
  principle.
- PATCH: wording clarification, typo fix, or non-semantic refinement.

**Compliance review**: every pull request description MUST include a one-line compliance
attestation ("No constitution principles are violated by this change") or an explicit
deviation note citing which principle is affected and why the amendment procedure was not
followed (e.g., an in-progress amendment is open).

**Version**: 1.0.0 | **Ratified**: 2026-08-06 | **Last Amended**: 2026-08-06
