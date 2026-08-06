# Contract: POST /api/generate-pdf

**Feature**: 001-wyoming-dissolution-form | **Date**: 2026-08-06

---

## Overview

Accepts a confirmed `IntakeState` payload, re-validates it server-side, and streams a
completed PDF of the Wyoming Articles of Dissolution form. Nothing is written to disk
or stored in any database. The signature line is structurally absent from the field map
and is never written.

This endpoint is **not** rate-limited. Manual-entry users and extraction users share the
same PDF generation path.

---

## Request

```
POST /api/generate-pdf
Content-Type: application/json
```

```json
{
  "intakeState": {
    "certificationAffirmed": true,
    "userConfirmedReview": true,
    "mode": "final",
    "companyLegalName": "Acme Solutions LLC",
    "entityType": "wyoming-llc",
    "stateOfFormation": "Wyoming",
    "contactEmail": "hello@acme-solutions.com",
    "contactPhone": "",
    "physicalAddress": "123 Main St, Cheyenne, WY 82001",
    "signerName": "Jane Doe",
    "signerTitle": "Member",
    "signingDate": "2026-08-06",
    "fieldProvenances": {
      "companyLegalName": "extracted",
      "signerName": "manual"
    }
  }
}
```

**`mode` values**:
- `preview` — `certificationAffirmed` and `userConfirmedReview` are **not** required to be
  `true`. Returns a PDF with all confirmed field values but with a visible "PREVIEW" watermark
  (or equivalent visual indicator). Intended for the embedded preview on the `/review` screen.
- `final` — Both `certificationAffirmed: true` and `userConfirmedReview: true` are required.
  Returns the clean PDF without watermark. Download filename: `{companyLegalName}-articles-of-dissolution.pdf` (sanitized).

---

## Response (success): `HTTP 200 application/pdf`

```
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="acme-solutions-llc-articles-of-dissolution.pdf"
Cache-Control: no-store
```

Body: PDF bytes streamed directly from pdf-lib. No intermediate file write.

**Invariants enforced in the generated PDF**:
- Signature line: not written. The signature area contains only the pre-printed form text.
- All field values come exclusively from the validated `IntakeState`; no server-side
  lookups or AI calls occur during PDF generation.
- Generation is deterministic: identical `IntakeState` always produces identical PDF bytes
  (modulo pdf-lib version; golden-file test pins the expected output).

---

## Response (validation failure): `HTTP 422`

Returned when:
- `intakeState` fails the `IntakeState` Zod schema.
- `mode === 'final'` and `certificationAffirmed !== true`.
- `mode === 'final'` and `userConfirmedReview !== true`.
- `entityType` is not present in the `FormTemplate` registry.
- `companyLegalName` is empty.

```
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json
```

```json
{
  "error": "validation_failed",
  "details": [
    {
      "field": "certificationAffirmed",
      "message": "Certification must be affirmed before generating the final document."
    }
  ]
}
```

---

## Response (unsupported entity type): `HTTP 422`

```json
{
  "error": "unsupported_entity_type",
  "entityType": "wyoming-corporation",
  "message": "Winddown does not support this entity type. Please use the Wyoming Secretary of State forms page.",
  "sosFormsUrl": "https://sos.wyo.gov/Forms/Business/Dissolution.aspx"
}
```

---

## Filename Sanitization

`companyLegalName` is sanitized for use in `Content-Disposition` filename:
1. Lowercase.
2. Replace all non-alphanumeric characters (excluding spaces) with `-`.
3. Replace spaces with `-`.
4. Collapse consecutive `-` to single `-`.
5. Trim leading/trailing `-`.
6. Append `-articles-of-dissolution.pdf`.

Example: `"Acme Solutions LLC"` → `"acme-solutions-llc-articles-of-dissolution.pdf"`

---

## Security Constraints

- Server re-validates the full `IntakeState` Zod schema on every request regardless of
  client-side validation. Client validation is UX convenience only.
- `mode=final` without both confirmation flags returns 422; no PDF is generated.
- No `IntakeState` data is logged; only latency, HTTP status, and error class are recorded.
- No data is stored; the PDF bytes are streamed directly to the response and then GC'd.
