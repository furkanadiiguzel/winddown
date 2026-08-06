# Feature Specification: Wyoming Dissolution Form Preparation

**Feature Branch**: `001-wyoming-dissolution-form`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Build Winddown — a web application that prepares the official Wyoming company dissolution form by having an AI read the company's own public website, automatically extract the information the form requires, let the owner fill the few gaps a website can never answer, and produce a completed, download-ready document."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Pre-filled Dissolution from Company Website (Priority: P1)

An LLC owner who has decided to close their Wyoming company visits Winddown, enters their company's website URL, confirms they are authorized to act for the company, and watches the system read their site and pre-fill the dissolution form. They review each extracted value alongside the exact evidence snippet, correct anything that needs fixing, fill the few fields no website can answer (signer name, title, signing date), acknowledge the certification, review the completed form preview, and download the PDF — all without deciphering a government form.

**Why this priority**: This is the product's core value proposition. Everything else supports or protects this flow. Without it there is no product.

**Independent Test**: A tester submits a real Wyoming LLC website URL → the system returns a pre-filled review board with at least the company legal name extracted from a visible source snippet → the tester completes the form and downloads a PDF containing the correct company name. Delivers value as a standalone slice.

**Acceptance Scenarios**:

1. **Given** a valid, publicly reachable company website URL and the authorization checkbox ticked, **When** the user submits the form, **Then** the system fetches the homepage and discovers linked legal/about/contact pages on the same domain, showing live progress messages for each step.
2. **Given** a site that prominently displays the legal company name (e.g., in the footer copyright line or Terms of Service), **When** extraction completes, **Then** the review board shows the legal name field pre-filled with the verbatim value, the source page label ("from your site footer"), the confidence level (high/medium/low), and the exact evidence snippet.
3. **Given** pre-filled fields on the review board, **When** the user edits a field manually, **Then** the edited value is permanently stored and is not overwritten if the user triggers re-analysis.
3a. **Given** `companyLegalName` is extracted at low confidence, **When** the user attempts to advance past the review board without editing or acknowledging the field, **Then** advancement is blocked and the field is highlighted with an explicit prompt to confirm or correct it.
3b. **Given** any other field (not `companyLegalName`) is extracted at low confidence, **When** the user attempts to advance, **Then** they are not blocked; the field retains its extracted value with a visual warning indicator.
3c. **Given** any required field is absent (null/empty), **When** the user attempts to advance, **Then** advancement is blocked by the completeness gate regardless of confidence level — this is independent of and does not replace the confidence gate.
4. **Given** all required fields are filled and the certification checkbox is ticked, **When** the user completes the final accuracy confirmation, **Then** the download button becomes active and clicking it delivers a PDF named `{company-name}-articles-of-dissolution.pdf` with all confirmed field values and the signature line left blank.

---

### User Story 2 — Honest Failure with Manual-Entry Fallback (Priority: P2)

An owner whose site is built on a JavaScript-heavy SPA, or whose site is unreachable, uses Winddown. The system either attempts rendered-page extraction and reports what it could and could not find, or reports the failure honestly. In either case the user can proceed via full manual entry without being blocked.

**Why this priority**: Without a reliable fallback, a scraping failure is a product failure. The fallback path ensures Winddown is always useful, even when extraction is impossible.

**Independent Test**: A tester submits a URL that returns a 403 or a JS-only shell with no SSR content → the system displays an honest error state with a clear "Enter details manually" option → the tester completes the form via manual entry and downloads a valid PDF.

**Acceptance Scenarios**:

1. **Given** a URL that is unreachable (DNS failure, timeout, HTTP 4xx/5xx), **When** the fetch attempt completes, **Then** the system displays a clear error message describing what went wrong and presents a "Enter details manually" call-to-action — it does not show a blank review board silently.
2. **Given** a JavaScript-heavy site where the renderer returns a page with no extractable text, **When** extraction completes, **Then** all fields are marked "needs your input" and the user is directed to fill them manually; no field is guessed or fabricated.
3. **Given** the user chooses to skip URL submission entirely (manual-entry path), **When** they proceed, **Then** they reach the same review board with all fields empty and editable, and the full form completion and download flow works identically to the extraction path.

---

### User Story 3 — Unsupported Entity Type Exit (Priority: P3)

A corporation founder visits Winddown expecting to dissolve their Wyoming corporation. After entering their URL and reviewing the results, they learn that Winddown only supports LLCs (or whichever entity types it handles) and the product plainly says so, directing them to the Secretary of State forms page instead of attempting to fill an incorrect form.

**Why this priority**: Filing the wrong form variant is a legal error. An honest "we don't support this" is better than a silently incorrect form, so this safety exit is required even though it is a minority path.

**Independent Test**: A tester supplies a site that signals "Corporation" or "Inc." entity type → the review board displays an unsupported-entity notice with the detected type → a direct link to the Wyoming Secretary of State forms page is shown → no PDF can be generated.

**Acceptance Scenarios**:

1. **Given** extraction signals a corporate entity type (e.g., "Inc.", "Corp.", "Corporation"), **When** the review board loads, **Then** an unsupported-entity notice replaces the normal completion flow and a link to the Secretary of State forms page is displayed.
2. **Given** the user manually selects an unsupported entity type in the gap-completion step, **When** they confirm the selection, **Then** the same unsupported-entity notice is shown and PDF generation is blocked.

---

### User Story 4 — Certification and Legal Clarity (Priority: P2)

Before downloading the PDF, the user reads a plain-language explanation of what the W.S. 17-29-701 certification means — that they attest statutory winding-up requirements are met and that they have authority to dissolve the company. The product lists the winding-up duties as an informational checklist. The user must actively tick the certification checkbox; nothing pre-ticks it.

**Why this priority**: The certification is a legal declaration with personal liability implications. Ensuring it is understood and actively chosen — never pre-filled, never AI-settable — is a non-negotiable safety requirement from the project constitution.

**Independent Test**: A tester reaches the certification step → the certification checkbox is unchecked by default → ticking it and proceeding unlocks the review screen → the PDF contains a blank signature/certification line.

**Acceptance Scenarios**:

1. **Given** the user has filled all required fields, **When** they arrive at the certification step, **Then** the certification checkbox is unchecked by default and the "Continue" button is disabled.
2. **Given** the certification step, **When** the user ticks the checkbox, **Then** the "Continue" button becomes active.
3. **Given** the completed PDF is generated, **When** a reviewer examines the PDF, **Then** the signature line is blank — no name, no AI-generated text, no extracted signer value appears on the signature line itself.
4. **Given** `certificationAffirmed` or `userConfirmedReview` was previously set to true, **When** the user navigates back to any prior step and edits any field, **Then** both confirmation flags are immediately and automatically reset to false — the user must re-affirm both before PDF generation is re-enabled.

---

### Edge Cases

- What happens when the submitted URL redirects more than 5 times? → The redirect chain is aborted; the system reports the error and falls back to manual entry.
- What happens when a discovered sub-page is on a different domain (CDN, legal-service host)? → The page is skipped; only pages on the exact submitted domain are fetched.
- What happens when the response body exceeds 2 MB? → The fetch is terminated at the size limit; the system reports partial content and processes what was received, noting the truncation.
- What happens when the extracted legal name differs from what appears in the Wyoming Secretary of State records? → Winddown cannot know; the review board instructs the user to verify the name matches state records exactly and provides a link to the SOS business search.
- What happens when the signing date is in the past? → The field accepts any date the user enters; no validation blocks historical signing dates (dissolution paperwork may be backdated in some cases).
- What happens when `companyLegalName` is extracted at low confidence and the user tries to advance without acknowledging it? → Advancement is blocked with a targeted prompt; all other low-confidence fields do not block advancement.
- What happens when a required field is absent vs. when a field is present but low-confidence? → These are two independent gates: the completeness gate blocks absent required fields; the confidence gate blocks only `companyLegalName` at low confidence when a value is present but unacknowledged. They MUST NOT be conflated in implementation.
- What happens when the user navigates back and edits a field after having already certified or confirmed accuracy? → Both `certificationAffirmed` and `userConfirmedReview` are immediately reset to false; the user must re-read and re-affirm both confirmations before the download button is re-enabled.
- What happens when the user clicks "Start over" mid-flow? → All session state is fully cleared including sessionStorage, the authorization checkbox, all field values, and both confirmation flags. The user is returned to the landing page. No value from the previous run survives.
- What happens when the site's robots.txt disallows fetching the homepage? → The system respects the disallow, reports that it cannot read the site, and offers the manual-entry path.
- What happens when two pages on the site give conflicting legal names? → Both candidates are surfaced with their respective sources; the user chooses which is correct.
- What happens when the Anthropic API returns a retryable error (429, 5xx, timeout) during extraction? → The system retries up to 2 times with exponential backoff, showing "AI service is slow, retrying…" in the progress UI. After exhausting retries it opens the review board in manual-entry mode with all fields absent and a clear error banner; the fetched page text may be shown as a read-only reference panel.
- What happens when the Anthropic API returns a non-retryable error (401, 400) during extraction? → Retries are skipped; the system proceeds immediately to the manual-entry fallback with a banner identifying the error class. No shadow extraction is attempted.
- What happens when a user has submitted 5 analysis requests within the current hour and tries a sixth? → The server returns HTTP 429 with a `Retry-After` header. The UI shows an honest message with the wait time and offers the manual-entry path immediately. PDF generation is unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a landing page with a single URL input as the primary call-to-action, an authorization checkbox, a three-step process explanation, an FAQ section, and a persistent legal disclaimer stating this is document preparation, not legal advice or filing assistance.
- **FR-002**: The system MUST validate the submitted URL for basic format correctness and MUST block URLs that resolve to private, loopback, or cloud metadata IP ranges before initiating any network request.
- **FR-003**: The system MUST fetch the submitted homepage and discover up to four additional candidate pages (legal/about/contact/terms) on the same registered domain, respecting robots.txt disallow directives for each path.
- **FR-004**: The system MUST enforce a 2 MB response size cap, a 10-second timeout for static pages and 20-second timeout for rendered pages, and a maximum of 5 redirects per request.
- **FR-005**: The system MUST display live progress feedback during site analysis ("Reading homepage…", "Found Terms of Service, reading…", "Extracting company details…") with honest error states for unreachable, blocked, or empty responses. During AI retry attempts the progress UI MUST show an honest status message (e.g., "AI service is slow, retrying…"); it MUST NOT freeze silently.
- **FR-006**: The system MUST extract the following fields using AI and return each as `{ value, confidence, evidence, sourceUrl }`: legal company name (with entity suffix), entity type, state of formation/governing law signals, contact email, contact phone, physical address, candidate signer names.
- **FR-007**: The extractor MUST NOT fabricate any value. Fields for which no evidence exists on the scraped pages MUST be returned as absent/missing, never guessed.
- **FR-008**: Every AI-extracted field MUST be validated against a Zod schema before entering application state; fields failing validation are treated as absent.
- **FR-009**: The system MUST display extracted fields as review cards showing: the field label, the extracted value, a source badge ("from your site footer"), a confidence indicator, and the verbatim evidence snippet accessible on hover or tap. Low-confidence fields MUST be visually distinct (e.g., amber border and warning icon) with an inline prompt encouraging the user to verify the value. High- and medium-confidence fields carry no blocking gate; low-confidence populated fields are freely passable — with one targeted exception (see FR-009a).
- **FR-009a**: `companyLegalName` extracted at low confidence MUST require explicit user acknowledgement before the user can advance past the review board. The user MUST either edit the field or tap an explicit "This is correct" affordance. Rationale: the legal name is the only field whose silent error causes a filing to be rejected by the state — it must match state records character-for-character. All other fields are either user-supplied or trivially correctable.
- **FR-009b**: The confidence gate (FR-009a) and the completeness gate are independent and MUST NOT be conflated. The completeness gate blocks advancement when any required field is absent (null/empty), regardless of confidence level. The confidence gate blocks advancement only for `companyLegalName` at low confidence when a value is present but unacknowledged. A field that is absent is caught by the completeness gate; a field that is present but low-confidence for `companyLegalName` is caught by the confidence gate.
- **FR-010**: Every field on the review board MUST be editable inline; a manual user edit MUST permanently mark that field as user-overridden and MUST NOT be overwritten by any subsequent extraction or re-analysis. The user MUST be able to navigate back to any prior step at any time with all state preserved. If any field is edited after `certificationAffirmed` or `userConfirmedReview` was set, both flags MUST be automatically reset to false and the user MUST re-affirm them before PDF generation is re-enabled; confirmations are snapshot-bound to the data at the time of affirmation, not to the session. Note: the "never overwrite user-overridden fields" rule is a defensive invariant maintained in the schema even though no runtime path in v1 exercises re-extraction; it exists to make a future "Re-analyze" feature safe to add without data-corruption risk and MUST NOT be removed as dead code.
- **FR-011**: The system MUST collect the following fields that a website cannot supply: signer full name (pre-suggested from any extracted candidate signers but freely editable), signer title (Member / Manager / Other), signing date (defaulting to today's date), and explicit confirmation that the company was formed in Wyoming if the site did not establish this.
- **FR-012**: If the detected or user-confirmed entity type is not supported by the product, the system MUST display an unsupported-entity notice naming the detected type, block PDF generation, and provide a direct link to the Wyoming Secretary of State forms page.
- **FR-013**: The certification step MUST display a plain-language explanation of what the W.S. 17-29-701 certification attests and an informational winding-up duties checklist (creditors notified, debts settled, final tax return filed, accounts closed, unanimous member vote where applicable). The certification checkbox MUST default to unchecked; no code path may pre-check it or allow the extractor to set it.
- **FR-014**: The system MUST present a visual preview of the filled official form and require an explicit final accuracy confirmation ("I reviewed this information and certify it is accurate") before enabling the download button.
- **FR-015**: Document generation MUST be deterministic: identical confirmed form state MUST always produce an identical PDF. The signature line MUST always be blank in the generated PDF.
- **FR-016**: The generated PDF MUST be named `{company-name}-articles-of-dissolution.pdf` where `{company-name}` is the confirmed legal company name, sanitized for use in a filename.
- **FR-017**: After download, the system MUST display a "What happens next" page containing: the full official Cheyenne mailing address, a note instructing the user to verify the current filing fee on the Secretary of State's website, guidance to make two copies, expected ~1 week processing time, and how the stamped confirmation is returned.
- **FR-018**: The system MUST provide a manual-entry path that bypasses URL submission and allows the user to type all fields directly, proceeding through the same gap-completion, certification, review, and download flow.
- **FR-025**: Extraction is one-shot per session; there is no "Re-analyze my site" affordance in v1. A "Start over" link MUST be present on every step of the flow. Activating it MUST return the user to the landing page and fully clear all session state — including any sessionStorage persistence, the authorization checkbox, all form fields, and both confirmation flags (`certificationAffirmed`, `userConfirmedReview`). No field value, user edit, or confirmation state from the previous run may survive a start-over. A dedicated test assertion (unit or E2E) MUST verify that zero field values persist after start-over is triggered.
- **FR-019**: All procedural facts (mailing address, statute references, processing guidance) MUST be sourced exclusively from a single auditable configuration with a visible last-verified date; they MUST NOT be extracted from third-party pages or hard-coded in multiple places.
- **FR-020**: Every screen that renders form data MUST also render a legal disclaimer component identifying the product as document preparation only, not legal advice.
- **FR-021**: No scraped content, extracted data, or generated PDFs may be persisted server-side beyond the lifetime of the originating request; server-side logs MUST record only latency, HTTP status codes, and error class names. Exception: the rate-limit counter store (see FR-026) persists `hash(IP) + counter + TTL` only — this is explicitly not a violation of the no-persistence principle because no URL, page content, field value, or form data is stored. This distinction MUST be documented in the implementation plan to prevent the two requirements from being flagged as contradictory.
- **FR-026**: The `/api/analyze` endpoint MUST enforce a per-IP rate limit of 5 user-initiated analyses per hour. Because serverless deployments may route concurrent requests to different instances, an in-memory counter MUST NOT be used; the counter MUST be stored in a small external key-value store (e.g., Upstash Redis) keyed by a cryptographic hash of the client IP address, with a TTL of 1 hour. Only `hash(IP)`, the integer counter, and the TTL are stored — no URLs, page content, or form data. Internal Anthropic API retries triggered by the system (see FR-022) count as one analysis against the rate limit, not three; the limit meters user-initiated analysis requests only.
- **FR-027**: When the rate limit is reached, the server MUST respond with HTTP 429 and a `Retry-After` header indicating seconds until the counter resets. The UI MUST display an honest, actionable message (e.g., "You've reached the analysis limit (5/hour). You can continue with manual entry now, or try again in N minutes.") and MUST offer the manual-entry path as an immediate alternative. The manual-entry flow and PDF generation endpoint are NEVER rate limited; only `/api/analyze` is subject to this restriction. The FAQ on the landing page MUST disclose the 5/hour limit.
- **FR-022**: On AI extraction failure, the system MUST retry the AI call up to 2 times with short exponential backoff, but ONLY for retryable error classes (HTTP 429, HTTP 5xx, network timeout). Non-retryable errors (HTTP 401, HTTP 400, invalid-request responses) MUST skip retries entirely and proceed immediately to the fallback state to avoid wasting time on unfixable failures.
- **FR-023**: After exhausting retries (or on an immediate non-retryable error), the system MUST open the review board in manual-entry mode: all fields absent, no values pre-populated, and a prominent banner explaining that AI extraction was unavailable. The system MUST NOT perform any shadow or regex-based extraction that populates fields outside the validated AI evidence pipeline — every value on the review board MUST originate from either the validated AI extraction path or the user's own keyboard input.
- **FR-024**: When falling back to manual-entry mode after a successful page fetch, the system MAY present the fetched page text as a read-only reference panel ("Here's what we read from your site") to help the user find and type the values themselves. This panel MUST be clearly labelled as reference only and MUST NOT auto-fill any field.

### Key Entities *(include if feature involves data)*

- **ExtractedField**: Represents one piece of information pulled from a scraped page. Carries: field identifier, value (string or null), confidence (high / medium / low), evidence (verbatim snippet string), sourceUrl (the page it came from), provenance (`"extracted"` | `"manual"`), and a userOverridden flag. The `provenance` field and the `userOverridden` flag are defensive invariants: in v1 no runtime path re-runs extraction over an existing FormState, but these fields ensure a future "Re-analyze" feature cannot silently overwrite user input. They MUST be preserved in the schema and MUST NOT be removed as dead code.
- **FormState**: The complete in-session representation of the dissolution form. Contains all ExtractedFields plus user-supplied fields (signer name, title, signing date, entity type confirmation) and two snapshot-bound boolean flags: `certificationAffirmed` (W.S. 17-29-701 certification ticked) and `userConfirmedReview` (final accuracy confirmation ticked). Both flags reset to false whenever any form field is edited after they were set. Held exclusively in client-side state; never sent to a server as a persisted record.
- **ScrapeResult**: The transient server-side output of one analysis run. Contains page text per URL, HTTP status, and any error information. Discarded after the extraction response is sent.
- **FormTemplate**: A configuration-driven registry entry defining which fields appear on a given Wyoming form variant (LLC dissolution vs. others). Controls field ordering, labels, required/optional status, and the Zod schema to validate against.
- **ProceduralConfig**: The single authoritative source (`wyoming.ts`) containing the mailing address, statute reference, filing fee guidance, and processing-time note, each stamped with a lastVerified date.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Against a benchmark set of 10 real Wyoming-style company websites, the extractor correctly identifies the legal company name on at least 8 sites and never asserts an incorrect name at high confidence.
- **SC-002**: A first-time test user with no prior product familiarity completes the full flow from URL submission to PDF download in under 5 minutes on a static-site target.
- **SC-003**: The generated PDF passes a field-by-field comparison against a manually completed reference form for the same company data; the signature line is blank in every generated PDF.
- **SC-004**: The landing page achieves a Lighthouse score of 90 or above across all four categories (Performance, Accessibility, Best Practices, SEO).
- **SC-005**: Live progress feedback appears within 1 second of URL submission; the user is never presented with a blank screen or spinner without an explanatory message during site analysis.
- **SC-006**: Every required form field that the user could not extract from a site (all fields absent) can be completed and a valid PDF generated within the manual-entry path, with no dependency on the extraction flow.
- **SC-007**: All interactive elements are reachable and operable via keyboard alone; the product meets WCAG 2.1 AA contrast and labelling requirements throughout.

## Assumptions

- The target audience is Wyoming LLC owners; the initial supported entity type is Wyoming LLC. Corporations and other entity types are explicitly unsupported in v1 and trigger the unsupported-entity exit.
- Users access the product on a modern browser (last two major versions of Chrome, Firefox, Safari, Edge); IE and legacy browsers are out of scope.
- The Wyoming Articles of Dissolution form for LLCs (SOS form) is the only form template required for v1; the FormTemplate registry is designed to accommodate additional form variants in the future without code changes outside the registry.
- "Rendered page" fetching (for JavaScript-heavy sites) uses a headless browser on the server side; the 20-second timeout and 2 MB cap apply equally to rendered and static fetches.
- The product does not verify that the submitted URL belongs to the company the user claims to represent; the authorization checkbox is a user attestation, not a technical verification.
- No analytics, session tracking, or third-party scripts are included in v1 to preserve the privacy-first posture.
- The filing fee and mailing address in `wyoming.ts` are initialized from the Wyoming Secretary of State's website at build time and marked with a lastVerified date; users are instructed to re-verify before mailing.
- The rate-limit counter store (e.g., Upstash Redis) is the only server-side persistent store in the product. It holds `hash(IP) + counter + TTL(1h)` exclusively. This is not a violation of the no-persistence principle; the implementation plan must document this distinction explicitly.
- Multi-language support is out of scope for v1; the product is English-only.

## Clarifications

### Session 2026-08-06

- Q: Can users navigate backward through the form flow after passing a step? → A: Yes, free backward navigation to any prior step with all state preserved. Invariant: editing any field after `certificationAffirmed` or `userConfirmedReview` was set automatically resets both flags to false; confirmations are snapshot-bound to the data at the time of affirmation, not to the session.
- Q: What should the product do when the Anthropic API is unavailable or errors during extraction? → A: Retry up to 2 times with exponential backoff for retryable errors (429, 5xx, network timeout) only; skip retries for non-retryable errors (401, 400). Progress UI must show "AI service is slow, retrying…" during retries. On final failure, open the review board in manual-entry mode with all fields absent and a clear banner. The fetched page text may be shown as a read-only reference panel but MUST NOT auto-fill any field; no shadow/regex extraction permitted.
- Q: Should the product apply rate limiting on the site analysis endpoint? → A: Yes — 5 analyses per IP per hour, disclosed in the FAQ. Implementation must use an external counter store (e.g., Upstash Redis) keyed by hashed IP with a 1-hour TTL; in-memory counters do not work on serverless. Store only `hash(IP) + counter + TTL` — no URLs or content. Internal Anthropic retries count as one analysis. On limit hit: HTTP 429 + Retry-After, UI offers manual-entry path. Manual entry and PDF generation are never rate limited. The counter store is not a violation of the no-persistence principle; the plan must document this distinction explicitly.
- Q: What are the functional boundaries of confidence levels — do low-confidence fields block advancement? → A: All confidence levels freely passable with visual flagging (amber border, warning icon), with one targeted exception: `companyLegalName` at low confidence requires explicit acknowledgement ("This is correct" or edit) before advancing. Rationale: legal name is the only field whose silent error causes the state to reject the filing. Absent required fields block via a separate completeness gate, independent of confidence; the two gates MUST NOT be conflated.
- Q: Can users trigger re-extraction after reviewing fields, or is extraction one-shot per session? → A: One-shot per session; no "Re-analyze" button in v1. "Start over" returns to the landing page and fully clears all state — sessionStorage, authorization checkbox, all fields, both confirmation flags. A test assertion must verify zero field values persist after start-over. The `provenance` and `userOverridden` fields on ExtractedField are retained as defensive invariants for future "Re-analyze" safety; they must not be removed as dead code.
