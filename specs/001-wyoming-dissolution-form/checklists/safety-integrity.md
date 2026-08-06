# Safety & Integrity Checklist: Wyoming Dissolution Form Preparation

**Purpose**: Requirements quality validation across six high-stakes areas — extraction
integrity, scraping safety, legal safety, single source of truth, privacy, and resilience.
Each item tests whether the requirements are complete, clear, consistent, and measurable.
NOT an implementation test.
**Created**: 2026-08-06
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)

---

## 1. Extraction Integrity

- [ ] CHK001 — Is the `{ value, confidence, evidence, sourceUrl }` shape required for every AI-extracted field, with no exception path that permits a field lacking `evidence` to enter application state? [Completeness, Spec FR-006, FR-008]
- [ ] CHK002 — Are the acceptance bounds for `evidence` string length (3–500 characters) specified in requirements, and is the rejection behavior for out-of-bounds lengths defined? [Clarity, Data Model §1, research.md §4]
- [ ] CHK003 — Is the evidence-verification backstop described in requirements as a structural gate (not a best-effort check) — i.e., is it explicit that a field failing snippet verification is treated identically to an absent field? [Clarity, Spec FR-008, Data Model §2]
- [ ] CHK004 — Does the spec define the normalization strategy for the verbatim snippet check precisely enough to be testable — specifically, is "normalized whitespace" defined rather than left as an implementation detail? [Clarity, Gap, research.md §4]
- [ ] CHK005 — Is the `sourceUrl` membership rule stated in requirements: that a field's `sourceUrl` must belong to the set of pages actually fetched in the current run, and that a mismatch is grounds for rejection? [Completeness, Data Model §1]
- [ ] CHK006 — Is the prohibition on any code path allowing the extractor to populate `certificationAffirmed` stated as a structural requirement rather than a guideline — i.e., is it clear this must be enforced in the tool schema and prompt, not only in the UI? [Clarity, Spec FR-013, Constitution §II]
- [ ] CHK007 — Are the `provenance` (`'extracted' | 'manual'`) and `userOverridden` fields documented as defensive invariants that MUST NOT be removed as dead code, with an explicit rationale for retaining them in v1? [Completeness, Data Model §1, Spec FR-010, Clarification Q3]
- [ ] CHK008 — Is the `companyLegalName` low-confidence acknowledgement gate specified separately from the general completeness gate, with a written rationale explaining why this field alone requires explicit acknowledgement? [Clarity, Spec FR-009a, FR-009b, Clarification Q4]
- [ ] CHK009 — Are the two independent gates (completeness gate for absent required fields; confidence gate for `companyLegalName` at low confidence) defined without overlap, and is it explicit that they MUST NOT be implemented as a single unified check? [Consistency, Spec FR-009b, Clarification Q4]
- [ ] CHK010 — Does the spec define what "absent" means in requirements terms — specifically, that an absent field surfaces as "needs your input" and is never populated by a default or a guess? [Clarity, Spec FR-007, Constitution §II]

---

## 2. Scraping Safety

- [ ] CHK011 — Are all blocked IP ranges enumerated in requirements rather than deferred to implementation? Specifically: RFC 1918 private ranges (10/8, 172.16/12, 192.168/16), loopback (127/8, ::1), link-local (169.254/16), and known cloud metadata endpoints (169.254.169.254, fd00:ec2::254). [Completeness, Spec FR-002, Constitution §IV, contracts/analyze-sse.md]
- [ ] CHK012 — Is the requirement to resolve DNS before the IP-range check specified — i.e., is it clear that hostname-only validation is insufficient and that the resolved IP must be checked? [Clarity, Spec FR-002, research.md §7]
- [ ] CHK013 — Are all four numeric safeguard limits (2 MB body cap, 10 s static timeout, 20 s rendered timeout, 5 redirect cap) stated as hard limits in requirements, with the expected behavior on each limit being reached (truncate, abort, reject)? [Completeness, Spec FR-004]
- [ ] CHK014 — Is the maximum page count (5 pages: home + up to 4 candidates) stated as a hard cap with an explicit requirement that the scraper stops rather than queues additional pages? [Clarity, Spec FR-003, Constitution §IV]
- [ ] CHK015 — Is robots.txt compliance required per-path (not per-domain) — i.e., does the spec clarify that a disallowed path is skipped individually rather than blocking the entire site? [Clarity, Spec FR-003]
- [ ] CHK016 — Is the same-domain boundary defined in terms of registrable domain (handling subdomains and public-suffix edge cases) rather than as an exact hostname match? [Clarity, research.md §7, plan.md Technical Context]
- [ ] CHK017 — Is the `User-Agent` string requirement specific (`WinddownBot/1.0 (+<site-url>)`) rather than generic ("a descriptive string")? [Clarity, plan.md Technical Context]
- [ ] CHK018 — Are the Tier 1 → Tier 2 escalation criteria (body text < 500 chars OR SPA shell detected) specified in requirements, and is the fallback behavior when Tier 2 is disabled or unavailable also defined? [Completeness, Spec FR-002, research.md §1]
- [ ] CHK019 — Is there a requirement that fetching is server-side only — explicitly prohibiting any client-side fetch of third-party URLs — stated in a way that covers all analysis paths including the manual-entry fallback? [Completeness, Constitution §IV, Spec FR-021]

---

## 3. Legal Safety

- [ ] CHK020 — Is "every screen that renders form data" enumerated or defined precisely enough that implementers know exactly which screens require the `LegalDisclaimer` component? [Clarity, Spec FR-020, Constitution §III]
- [ ] CHK021 — Is the download gate specified as requiring BOTH `certificationAffirmed` AND `userConfirmedReview` — stated conjunctively, not disjunctively — and is this validated server-side (not only client-side) for `mode=final`? [Completeness, Spec FR-014, FR-015, contracts/generate-pdf.md]
- [ ] CHK022 — Is the `preview` vs. `final` mode distinction in `/api/generate-pdf` specified in requirements, including which confirmations are waived in `preview` mode and what visual indicator (watermark or equivalent) distinguishes a preview PDF? [Clarity, contracts/generate-pdf.md]
- [ ] CHK023 — Is the prohibition on "legal advice" defined with enough precision to be testable — e.g., is there a requirement that strings must not claim the product advises on, interprets, or guarantees legal outcomes? [Clarity, Spec FR-001, FR-020, Gap]
- [ ] CHK024 — Are the required contents of the certification explanation screen specified (plain-language explanation of W.S. 17-29-701, winding-up duties checklist items) rather than left as "explain in plain language"? [Completeness, Spec FR-013]
- [ ] CHK025 — Is the `certificationAffirmed` default state (unchecked) specified as a requirement rather than an assumed UI behavior, and is it explicit that no code path — including progressive form restoration — may pre-check it? [Clarity, Spec FR-013, Clarification Q1]
- [ ] CHK026 — Is the unsupported entity type exit behavior fully specified: which entity strings trigger it, that PDF generation is blocked at this point, and that the link to the SOS forms page is sourced from `wyoming.ts` rather than hard-coded? [Completeness, Spec FR-012, Data Model §7]

---

## 4. Single Source of Truth

- [ ] CHK027 — Are all procedural fact fields that must live in `wyoming.ts` enumerated in requirements — mailing address, fee note, statute reference, processing-time note, SOS forms URL, SOS business search URL, and `lastVerified` date — so that omitting any one would be a detectable violation? [Completeness, Spec FR-019, Data Model §7]
- [ ] CHK028 — Is the `lastVerified` date required to be displayed to the user in the UI (not just stored internally), so staleness is visible and not silently assumed current? [Clarity, Spec FR-019, research.md §5 — verify display requirement]
- [ ] CHK029 — Is there a requirement explicitly prohibiting hard-coding of procedural facts in UI components, API route handlers, AI prompts, and next-steps content — not only in `wyoming.ts` itself — so the prohibition covers all locations? [Completeness, Constitution §III, Spec FR-019]
- [ ] CHK030 — Is the fee note requirement specified to include a user-visible instruction to verify the current amount on the Secretary of State's website (not merely to display a stored value as authoritative)? [Clarity, Spec FR-017, FR-019]

---

## 5. Privacy

- [ ] CHK031 — Is "content logging" defined precisely enough in requirements to distinguish prohibited log entries (URL of scraped page, page body text, extracted field values, PDF bytes) from permitted log entries (latency, HTTP status code, error class name)? [Clarity, Spec FR-021, Constitution §V]
- [ ] CHK032 — Is the requirement that `rawText` (full pre-pruning page text, retained for evidence verification) is never included in any SSE event, API response, or log line stated explicitly in requirements? [Completeness, Data Model §8, Gap]
- [ ] CHK033 — Is the Upstash Redis rate-limit store explicitly documented in requirements as storing only `hash(IP) + counter + TTL` — and is it explicit that no URL, company name, or form data is co-located in this store? [Clarity, Spec FR-021, FR-026, Clarification Q5]
- [ ] CHK034 — Is the privacy carve-out for the rate-limit store stated in requirements clearly enough that it cannot be misread as a contradiction of the no-persistence principle during code review or audit? [Consistency, Spec FR-021, plan.md Constitution Check]
- [ ] CHK035 — Is the requirement that the Anthropic API key must not appear in client bundles, SSE events, error messages, or log lines stated explicitly, or is it only implied by "server-side only"? [Completeness, Constitution §V, contracts/analyze-sse.md]
- [ ] CHK036 — Is the `sessionStorage` scope for client-side `FormState` persistence specified in requirements — i.e., is it stated that `localStorage` (cross-session) is not acceptable, and why? [Clarity, research.md §6, Gap]

---

## 6. Resilience & Failure Paths

- [ ] CHK037 — Are all six failure entry points (unreachable site, empty/no-extractable-text site, SPA with no SSR content, robots-blocked homepage, AI retryable failure after exhausted retries, AI non-retryable failure) individually specified with their respective outcomes in requirements? [Completeness, Spec FR-005, FR-022, FR-023, Clarification Q2]
- [ ] CHK038 — Is the distinction between retryable AI error classes (429, 5xx, network timeout) and non-retryable classes (401, 400) stated in requirements, not left to implementation judgement? [Clarity, Spec FR-022, Clarification Q2]
- [ ] CHK039 — Is the retry count (up to 2 retries = 3 total attempts) and backoff policy (exponential) specified in requirements precisely enough to write a deterministic test for the retry boundary? [Clarity, Spec FR-022, Clarification Q2]
- [ ] CHK040 — Is the requirement that internal AI retries count as one user-initiated analysis for rate-limiting purposes stated explicitly — i.e., is it clear that the counter increments once per user request, not once per upstream API call? [Completeness, Spec FR-026, Clarification Q5]
- [ ] CHK041 — Is the progress UI behavior during AI retries specified as a positive requirement ("MUST display 'AI service is slow, retrying…'") rather than only a negative one ("MUST NOT freeze silently"), so both the content and the behavior are testable? [Clarity, Spec FR-005, Clarification Q2]
- [ ] CHK042 — Is the read-only reference panel (fetched page text shown to user after AI fallback) specified as an optional affordance with an explicit constraint that it MUST NOT auto-fill any field — and is this framed as a requirements boundary, not just an implementation note? [Completeness, Spec FR-024, Clarification Q2]
- [ ] CHK043 — Is there a requirement that the manual-entry path is reachable from every failure mode — not only from the happy-path review board — including unreachable site, robots-blocked, rate-limited, and AI-failure states? [Coverage, Spec FR-018, FR-027, Clarification Q2]
- [ ] CHK044 — Is the HTTP 429 response shape (including the `Retry-After` header and the UI message that routes the user to manual entry) specified as a requirement rather than an implementation detail, so it is verifiable against a contract? [Completeness, Spec FR-027, contracts/analyze-sse.md]

## Notes

- Items marked `[Gap]` identify requirements that are partially implied but not yet stated
  with enough precision to be independently testable. These should be resolved before
  implementation begins.
- Reference format: `Spec FR-NNN` = functional requirement in spec.md; `Constitution §X` =
  principle in `.specify/memory/constitution.md`; `research.md §N` = decision in research.md.
- Check items off as completed: `[x]`
- Add inline findings, e.g.: `[x] CHK011 — Confirmed all CIDRs listed in contracts/analyze-sse.md`
