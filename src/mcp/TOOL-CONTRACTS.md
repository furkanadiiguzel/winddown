# Winddown MCP Tool Contracts

## Overview

The Winddown MCP server exposes two tools that assist with Wyoming LLC dissolution form preparation. Both tools are designed to support human decision-making — neither tool files documents, provides legal advice, or completes the certification step on behalf of the user.

**Critical constraint**: `certificationAffirmed` is a human-only action. It is structurally absent from all tool input schemas and cannot be set, passed, or inferred by any tool.

---

## Tool: `analyze_company_site`

### Purpose
Fetches and analyses a company website to extract fields needed for a Wyoming dissolution form.

### Input Schema

```json
{
  "url": {
    "type": "string",
    "format": "uri",
    "description": "The company website URL (must be HTTPS)."
  }
}
```

### Output Schema

```json
{
  "analysisMode": "extraction | manual-fallback",
  "pagesAnalyzed": ["https://..."],
  "fields": {
    "companyLegalName": {
      "fieldId": "companyLegalName",
      "value": "Acme Solutions LLC",
      "confidence": "high | medium | low",
      "evidence": "verbatim snippet from page",
      "sourceUrl": "https://..."
    }
  }
}
```

### Human Judgement Required

- **Review all extracted fields**: AI extraction can produce errors, especially for low-confidence fields. An authorised human must verify each field before certifying.
- **Certification is never set by this tool**: The `certificationAffirmed` flag is structurally absent from all tool inputs and outputs.

### Safety Invariants

- SSRF guard fires inside `scrape()` — private IPs and metadata ranges are blocked before any fetch.
- robots.txt is respected per path.
- Page/size/timeout caps enforced inside shared functions, not duplicated in MCP layer.
- No scraped content is logged (FR-021).

---

## Tool: `prepare_dissolution`

### Purpose
Generates a **preview-only** Wyoming Articles of Dissolution PDF from provided intake state.

### Input Schema

```json
{
  "intakeState": {
    "companyLegalName": "string (required)",
    "entityType": "string (default: wyoming-llc)",
    "stateOfFormation": "string (default: Wyoming)",
    "signerName": "string (required)",
    "signerTitle": "string (required)",
    "signingDate": "string (ISO date, required)",
    "contactEmail": "string (optional)",
    "contactPhone": "string (optional)",
    "physicalAddress": "string (optional)"
  }
}
```

**Excluded fields** (structurally absent — cannot be passed):
- `mode` — always `"preview"` (hardcoded, final mode not exposed via MCP)
- `certificationAffirmed` — human-only, not a tool parameter
- `userConfirmedReview` — human-only, not a tool parameter

### Output Schema

```json
{
  "pdfBase64": "base64-encoded PDF bytes",
  "mimeType": "application/pdf",
  "fields": ["list of non-empty field names"],
  "note": "This is a PREVIEW only. To file: print, sign in ink, and mail to the Wyoming Secretary of State."
}
```

### Human Judgement Required

1. **Review the PDF carefully** before printing.
2. **Sign in ink** — electronic signatures are not accepted by Wyoming Secretary of State for this form.
3. **Complete the certification** — an authorised signatory must certify compliance with W.S. 17-29-701. This step cannot be delegated to an AI tool.
4. **Mail to Wyoming Secretary of State** — the tool provides a preview; filing is a human action.

### Operations Requiring Human Action

| Step | Tool Involvement | Human Requirement |
|------|-----------------|-------------------|
| Website analysis | `analyze_company_site` | Verify all extracted fields |
| Form preparation | `prepare_dissolution` | Review PDF content |
| Certification | **None — tool cannot certify** | Sign W.S. 17-29-701 certification in person |
| Filing | **None — tool cannot file** | Mail signed original to Secretary of State |

---

## Constitutional Constraints

- `certificationAffirmed` is human-only by design. No MCP tool, AI prompt, or automated process may set it to `true` on behalf of a user.
- The MCP layer calls `scrape()` and `extract()` directly (not via HTTP) to ensure all safety guards (SSRF, robots.txt, size caps) fire through shared code paths.
- No user content, scraped text, or PDF bytes are logged.
