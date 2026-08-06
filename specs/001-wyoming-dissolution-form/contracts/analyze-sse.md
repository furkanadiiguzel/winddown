# Contract: POST /api/analyze (SSE)

**Feature**: 001-wyoming-dissolution-form | **Date**: 2026-08-06

---

## Overview

Accepts a company website URL, runs the two-tier scraping pipeline and AI extraction, and
streams progress events back to the client as Server-Sent Events (`text/event-stream`).
This is the only endpoint that invokes the Anthropic API and the only endpoint subject to
rate limiting.

---

## Request

```
POST /api/analyze
Content-Type: application/json
```

```json
{
  "url": "https://www.example-company.com"
}
```

**Validation**:
- `url` must be a valid HTTPS URL (Zod `z.string().url()`).
- The URL must not resolve to a private, loopback, or cloud metadata IP range (SSRF guard
  applied before any network connection is opened).
- `url` is the only accepted request body field; additional fields are stripped.

**Rate limiting**:
- 5 requests per IP per hour (sliding window).
- Counter key: `ratelimit:analyze:{sha256(ip)}`.
- Exceeded: `HTTP 429` with `Retry-After: <seconds>` header — no SSE stream is opened.

---

## Response (success): `HTTP 200 text/event-stream`

Each line is a JSON-encoded SSE event: `data: <json>\n\n`

### Event types

#### `fetching_home`
Emitted immediately after SSRF guard passes.

```json
{
  "type": "fetching_home",
  "url": "https://www.example-company.com"
}
```

#### `found_pages`
Emitted after the homepage is parsed and candidate sub-pages are discovered.

```json
{
  "type": "found_pages",
  "urls": [
    "https://www.example-company.com/terms",
    "https://www.example-company.com/about"
  ]
}
```

#### `fetching_page`
Emitted once per sub-page before it is fetched.

```json
{
  "type": "fetching_page",
  "url": "https://www.example-company.com/terms",
  "tier": 1
}
```

`tier` is `1` (fetch + cheerio) or `2` (Playwright headless).

#### `tier2_fallback`
Emitted when Tier 1 body text is < 500 chars and Tier 2 is attempted.

```json
{
  "type": "tier2_fallback",
  "url": "https://www.example-company.com"
}
```

#### `extracting`
Emitted when all pages are fetched and the Anthropic API call begins.

```json
{
  "type": "extracting"
}
```

#### `retrying_ai`
Emitted when a retryable AI error (429, 5xx, timeout) causes a retry attempt.

```json
{
  "type": "retrying_ai",
  "attempt": 2,
  "maxAttempts": 3,
  "waitMs": 2000
}
```

#### `done`
Terminal event on success. Contains the full `ExtractionResult`.

```json
{
  "type": "done",
  "result": {
    "fields": {
      "companyLegalName": {
        "fieldId": "companyLegalName",
        "value": "Acme Solutions LLC",
        "confidence": "high",
        "evidence": "© 2024 Acme Solutions LLC. All rights reserved.",
        "sourceUrl": "https://www.example-company.com",
        "provenance": "extracted",
        "userOverridden": false
      },
      "contactEmail": {
        "fieldId": "contactEmail",
        "status": "absent"
      }
    },
    "pagesAnalyzed": [
      "https://www.example-company.com",
      "https://www.example-company.com/terms"
    ],
    "analysisMode": "extraction"
  }
}
```

For `manual-fallback` mode:

```json
{
  "type": "done",
  "result": {
    "fields": {},
    "pagesAnalyzed": ["https://www.example-company.com"],
    "analysisMode": "manual-fallback",
    "failureReason": {
      "errorClass": "ai_rate_limit",
      "message": "AI service temporarily unavailable. Please fill in the details below."
    }
  }
}
```

#### `error`
Terminal event on unrecoverable failure (fetch failure, SSRF block, robots disallow,
non-retryable AI error). The client MUST show the manual-entry path after this event.

```json
{
  "type": "error",
  "errorClass": "robots_disallowed",
  "message": "This site's robots.txt does not allow us to read it. You can enter your details manually below."
}
```

**`errorClass` values**:
- `ssrf_blocked` — URL resolved to a private/loopback/metadata IP
- `robots_disallowed` — robots.txt disallows the homepage path
- `fetch_failed` — DNS failure, connection refused, or HTTP 4xx/5xx on homepage
- `too_large` — homepage response body exceeded 2 MB
- `timeout` — homepage fetch exceeded timeout
- `ai_auth` — Anthropic API returned 401 or 403 (non-retryable)
- `ai_invalid_request` — Anthropic API returned 400 (non-retryable)
- `ai_rate_limit` — Anthropic API returned 429 after exhausting retries
- `ai_server_error` — Anthropic API returned 5xx after exhausting retries
- `ai_timeout` — Anthropic API timed out after exhausting retries
- `tier2_unavailable` — Tier 2 headless renderer is disabled or failed to initialize

---

## Response (rate limited): `HTTP 429`

```
HTTP/1.1 429 Too Many Requests
Retry-After: 1847
Content-Type: application/json
```

```json
{
  "error": "rate_limited",
  "message": "You've reached the analysis limit (5/hour). You can continue with manual entry now, or try again in 30 minutes.",
  "retryAfterSeconds": 1847
}
```

No SSE stream is opened for rate-limited requests.

---

## Response (validation error): `HTTP 422`

```
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json
```

```json
{
  "error": "invalid_url",
  "message": "Please enter a valid website URL starting with https://"
}
```

---

## Security Constraints

- SSRF guard runs synchronously before any network call. Private CIDRs blocked:
  `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `::1`,
  `169.254.169.254/32` (AWS metadata), `fd00::/8` (cloud metadata IPv6), and others.
- The Anthropic API key is read from a server-side environment variable; it is never
  included in any SSE event, error message, or log line.
- Logs for this endpoint record: request latency (ms), HTTP status, `errorClass` (if any).
  No URL, page content, or extracted field values are logged.
