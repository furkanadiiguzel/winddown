# Data Model: Wyoming Dissolution Form Preparation

**Feature**: 001-wyoming-dissolution-form | **Date**: 2026-08-06

All types are TypeScript. Zod schemas are the authoritative runtime validators; the
TypeScript types below are their inferred counterparts (`z.infer<typeof Schema>`).
Every entity that crosses a trust boundary (AI output, request body, sessionStorage)
must be validated by its Zod schema before use.

---

## 1. ExtractedField

Represents one piece of AI-extracted information, including full provenance metadata.

```typescript
type Confidence = 'high' | 'medium' | 'low';
type Provenance = 'extracted' | 'manual';

interface ExtractedField {
  fieldId: string;           // canonical field key, e.g. "companyLegalName"
  value: string;             // non-empty string (absent fields use AbsentField)
  confidence: Confidence;
  evidence: string;          // verbatim snippet from the source page (3–500 chars)
  sourceUrl: string;         // URL of the page the evidence was found on
  provenance: Provenance;    // 'extracted' = AI pipeline; 'manual' = user typed
  userOverridden: boolean;   // true when user has edited this field
}
```

**Validation rules** (enforced by Zod):
- `evidence` length: 3–500 characters.
- `sourceUrl` must be a valid HTTPS URL present in the set of pages fetched during
  the current analysis run.
- `value` must be non-empty.
- `fieldId` must be a key defined in the active `FormTemplate.fieldMap`.

**Defensive invariants** (retained even though v1 has no re-extraction runtime path):
- `provenance` and `userOverridden` ensure a future "Re-analyze" feature cannot
  silently overwrite user edits. These fields MUST NOT be removed as dead code.

---

## 2. AbsentField

Represents a field the AI did not find or that was rejected by the evidence backstop.

```typescript
interface AbsentField {
  fieldId: string;
  status: 'absent' | 'rejected';
  // 'absent': no evidence found in any scraped page
  // 'rejected': AI returned a value but evidence snippet failed verification
}
```

---

## 3. ExtractionResult

The complete output of a successful `/api/analyze` run, delivered in the SSE `done` event.

```typescript
interface ExtractionResult {
  fields: Record<string, ExtractedField | AbsentField>;
  pagesAnalyzed: string[];         // URLs of pages that were successfully fetched
  analysisMode: 'extraction' | 'manual-fallback';
  // 'manual-fallback' when AI call failed after retries or Tier 2 unavailable
  failureReason?: {
    errorClass: string;            // e.g. 'ai_rate_limit', 'ai_auth', 'ai_timeout'
    message: string;               // human-readable, safe to display
  };
}
```

**Zod validation**: Applied server-side before streaming `done` event; applied again
client-side on receipt. Fields failing schema validation are coerced to `AbsentField`.

---

## 4. FormState (Zustand store)

Client-side only. Persisted to `sessionStorage` under key `winddown-form-state`.
Never sent to the server as a persisted record; only the derived `IntakeState` (§5)
is sent to `/api/generate-pdf`.

```typescript
type FlowStep =
  | 'landing'
  | 'analyzing'
  | 'review'
  | 'gap-completion'
  | 'certification'
  | 'preview'
  | 'done';

type SignerTitle = 'Member' | 'Manager' | 'Other' | '';

interface FormState {
  // Navigation
  currentStep: FlowStep;

  // Extraction output (populated after /api/analyze completes)
  extractedFields: Record<string, ExtractedField | AbsentField>;
  analysisMode: 'extraction' | 'manual-fallback' | null;

  // User-supplied gap-completion fields
  signerName: string;
  signerTitle: SignerTitle;
  signerTitleCustom: string;   // used when signerTitle === 'Other'
  signingDate: string;         // ISO date string, defaults to today
  wyomingConfirmed: boolean;   // explicit confirmation that entity is WY-formed

  // Landing page authorization
  authorizationAffirmed: boolean;

  // Snapshot-bound confirmation flags
  // INVARIANT: any call to setFieldValue() MUST call resetConfirmations() atomically.
  // These attach to the data snapshot at the time of affirmation, not to the session.
  certificationAffirmed: boolean;    // W.S. 17-29-701 certification checkbox
  userConfirmedReview: boolean;      // final "I reviewed and certify accuracy" checkbox
}
```

**State transitions**:

```
landing
  → (URL submitted + authorizationAffirmed) → analyzing
  → (SSE done / manual-entry chosen) → review
  → (all required fields complete) → gap-completion (within /review)
  → (gap fields complete) → certification (within /review)
  → (certificationAffirmed) → preview (within /review)
  → (userConfirmedReview) → [download] → done
  ← (Start over, any step) → landing + full state reset
```

Backward navigation is free between all steps except `landing` (requires Start over).
Editing any field after `certificationAffirmed` or `userConfirmedReview` was set resets
both flags to `false` atomically.

**Start-over reset**: Dispatching `reset()` sets every field to its initial value and calls
`sessionStorage.removeItem('winddown-form-state')`. A unit test asserts no field value
survives a `reset()` call.

---

## 5. IntakeState

The payload sent to `POST /api/generate-pdf`. Derived from `FormState` by extracting
only confirmed field values. Validated server-side by the `IntakeState` Zod schema before
PDF generation begins; request is rejected with 422 if validation fails.

```typescript
interface IntakeState {
  // Confirmation flags — server re-validates these; 422 if either is false for mode=final
  certificationAffirmed: boolean;
  userConfirmedReview: boolean;
  mode: 'preview' | 'final';

  // Form fields (all strings; empty string = absent)
  companyLegalName: string;
  entityType: 'wyoming-llc';        // only supported type in v1
  stateOfFormation: string;
  contactEmail: string;
  contactPhone: string;
  physicalAddress: string;
  signerName: string;
  signerTitle: string;
  signingDate: string;              // ISO date

  // Provenance metadata (for audit trail in preview vs final distinction)
  fieldProvenances: Record<string, Provenance>;
}
```

---

## 6. FormTemplate

Configuration-driven registry entry defining one dissolution form variant.
Loaded at server startup from `src/schemas/form-templates/`.

```typescript
type FieldMapEntryAcroForm = {
  type: 'acroform';
  pdfFieldName: string;
};

type FieldMapEntryCoordinates = {
  type: 'coordinates';
  page: number;          // 0-indexed
  x: number;
  y: number;
  fontSize: number;
  maxWidth?: number;     // for line-wrapping
};

type FieldMapEntry = FieldMapEntryAcroForm | FieldMapEntryCoordinates;

interface FormTemplate {
  id: string;                        // e.g. 'wyoming-llc-dissolution'
  entityType: string;                // matches IntakeState.entityType
  pdfAssetPath: string;              // relative to src/assets/forms/
  fieldMap: Record<string, FieldMapEntry>;
  // Keys are IntakeState field names; values describe how to write them into the PDF.
  // The signature field is ABSENT from fieldMap — it is never written by code.
  schema: ZodSchema<IntakeState>;    // validates the intake before PDF fill
}
```

**Registry**: `src/lib/pdf/form-template-registry.ts` exports a `Map<string, FormTemplate>`
keyed by `entityType`. Unsupported entity types have no entry; the route handler returns 422.

---

## 7. ProceduralConfig (wyoming.ts)

The sole authoritative source of procedural facts. Imported by UI components, prompts,
and the next-steps page. Never extracted from third-party pages, never hard-coded elsewhere.

```typescript
interface WyomingConfig {
  mailingAddress: {
    line1: string;       // e.g. "Herschler Building East"
    line2: string;       // e.g. "122 W 25th St, Ste 600"
    city: string;        // "Cheyenne"
    state: string;       // "WY"
    zip: string;         // "82002-0020"
  };
  feeNote: string;       // includes "verify current amount at wyomingsos.gov"
  statuteRef: string;    // "W.S. 17-29-701"
  processingTimeNote: string;  // "approximately 1 week for mailed filings"
  sosFormsUrl: string;         // Wyoming SOS forms page (for unsupported entity exit)
  sosBusinessSearchUrl: string; // Wyoming SOS business search (for name verification)
  lastVerified: string;        // ISO date; displayed in UI as "Verified [date]"
}
```

---

## 8. ScrapeResult (transient, server-side only)

Internal to the scraper pipeline. Discarded after the extraction response is sent.
Never logged, never stored.

```typescript
interface PageResult {
  url: string;
  prunedText: string;    // output of pruner.ts; ≤ 8k chars total across all pages
  rawText: string;       // full page text pre-pruning; used only for evidence verification
  httpStatus: number;
  tier: 1 | 2;
}

interface ScrapeResult {
  pages: PageResult[];
  errors: Array<{
    url: string;
    errorClass: string;  // e.g. 'timeout', 'ssrf_blocked', 'robots_disallowed', 'too_large'
    // no message field in logs; error class only per Constitution Principle V
  }>;
}
```

**Important**: `rawText` is never logged and never included in any SSE event or API response.
It is retained in memory only for the duration of the evidence-verification step, then GC'd
with the request scope.

---

## 9. RateLimitRecord (Upstash Redis)

Not a TypeScript type — a Redis key-value pattern.

```
Key:   ratelimit:analyze:{sha256hex(clientIp)}
Value: managed by @upstash/ratelimit sliding-window algorithm
TTL:   3600 seconds (rolling)
```

No IP address, URL, page content, or form data is stored. The `sha256hex` is
irreversible. Only the counter integer and TTL are stored by the Upstash library.

---

## Field Registry: Required vs Optional

| Field ID | Required? | Source | Notes |
|---|---|---|---|
| `companyLegalName` | Required | Extracted or manual | Low-confidence triggers explicit acknowledgement gate |
| `entityType` | Required | Extracted or manual | Unsupported type triggers exit flow |
| `stateOfFormation` | Required (if not confirmed WY) | Extracted or manual | `wyomingConfirmed` checkbox resolves if absent |
| `signerName` | Required | Manual (pre-suggested) | Never populated by extractor alone |
| `signerTitle` | Required | Manual | Member / Manager / Other |
| `signingDate` | Required | Manual | Defaults to today |
| `contactEmail` | Optional | Extracted or manual | — |
| `contactPhone` | Optional | Extracted or manual | — |
| `physicalAddress` | Optional | Extracted or manual | — |
| `certificationAffirmed` | Required | User action only | Never extractable; snapshot-bound |
| `userConfirmedReview` | Required | User action only | Never extractable; snapshot-bound |
