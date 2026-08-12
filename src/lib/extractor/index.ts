import Anthropic from "@anthropic-ai/sdk";
import type { ScrapeResult } from "@/lib/scraper/index";
import type { ExtractionResult, ExtractedField, AbsentField } from "@/schemas/extraction";
import { REPORT_EXTRACTED_FIELDS_TOOL, EXTRACTABLE_FIELD_IDS } from "./tool-schema";
import { SYSTEM_PROMPT, assemblePageBlocks } from "./prompt";
import { verifyEvidence, type RawExtractedField } from "./evidence-verifier";

const MODEL = "claude-sonnet-4-6";
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 1_000;

/** Error classes that warrant a retry. */
function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * T048 — Extractor orchestrator.
 *
 * Single batched Anthropic SDK call with the report_extracted_fields tool.
 * Retries on 429/5xx only (up to 3 total attempts, exponential backoff).
 * Zod-parses the tool response, then runs verifyEvidence per field.
 * Fields failing verification → AbsentField { status: 'rejected' }.
 * Any non-retryable or exhausted error → analysisMode: 'manual-fallback'.
 *
 * FR-021: only latency, HTTP status, and errorClass are ever logged.
 * Page content, URLs, and extracted values are never logged.
 */
export async function extract(scrapeResult: ScrapeResult): Promise<ExtractionResult> {
  const pageBlocks = scrapeResult.pages;
  const pageContent = assemblePageBlocks(pageBlocks);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let lastErrorClass = "ai_unknown";
  let lastMessage = "Unknown error";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const startMs = Date.now();

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        temperature: 0,
        system: SYSTEM_PROMPT,
        tools: [REPORT_EXTRACTED_FIELDS_TOOL],
        tool_choice: { type: "tool", name: "report_extracted_fields" },
        messages: [{ role: "user", content: pageContent }],
      });

      const latencyMs = Date.now() - startMs;
      console.info(`[extractor] ai_call latency=${latencyMs}ms status=200 attempt=${attempt + 1}`);

      // Extract the tool use block
      const toolUse = message.content.find((b) => b.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        return manualFallback("ai_no_tool_use", "Model did not call the extraction tool.");
      }

      const raw = toolUse.input as { fields?: Record<string, RawExtractedField> };
      const rawFields = raw?.fields ?? {};

      // Build ExtractionResult — verify each field's evidence
      const fields: ExtractionResult["fields"] = {};

      const totalChars = pageBlocks.reduce((a, p) => a + p.text.length, 0);
      console.info(`[extractor] pages=${pageBlocks.length} total_chars=${totalChars} ai_fields_reported=${Object.keys(rawFields).length}`);

      for (const fieldId of EXTRACTABLE_FIELD_IDS) {
        const rawField = rawFields[fieldId];
        if (!rawField) {
          console.info(`[extractor] field=${fieldId} ai_reported=false`);
          const absent: AbsentField = { fieldId, status: "absent" };
          fields[fieldId] = absent;
          continue;
        }

        const verdict = verifyEvidence(rawField, pageBlocks);
        console.info(`[extractor] field=${fieldId} ai_reported=true verdict=${verdict} evidence_len=${rawField.evidence.length} value_len=${rawField.value.length} confidence=${rawField.confidence}`);
        if (verdict === "rejected") {
          const rejected: AbsentField = { fieldId, status: "rejected" };
          fields[fieldId] = rejected;
          continue;
        }

        const extracted: ExtractedField = {
          fieldId,
          value: rawField.value,
          confidence: rawField.confidence,
          evidence: rawField.evidence,
          sourceUrl: rawField.sourceUrl,
          provenance: "extracted",
          userOverridden: false,
        };
        fields[fieldId] = extracted;
      }

      return {
        fields,
        pagesAnalyzed: pageBlocks.map((p) => p.url),
        analysisMode: "extraction",
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startMs;
      const status = (err as { status?: number }).status ?? 0;
      lastErrorClass = classifyError(err);
      lastMessage = err instanceof Error ? err.message : String(err);

      console.warn(
        `[extractor] ai_call latency=${latencyMs}ms status=${status} errorClass=${lastErrorClass} attempt=${attempt + 1}`
      );

      // Non-retryable: bail immediately
      if (status === 401) return manualFallback("ai_auth", lastMessage);
      if (status === 400) return manualFallback("ai_invalid_request", lastMessage);
      if (!isRetryable(status) && status !== 0) return manualFallback(lastErrorClass, lastMessage);

      // Retryable: wait with exponential backoff before next attempt
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
      }
    }
  }

  return manualFallback(lastErrorClass, lastMessage);
}

function manualFallback(errorClass: string, message: string): ExtractionResult {
  return {
    fields: {},
    pagesAnalyzed: [],
    analysisMode: "manual-fallback",
    failureReason: { errorClass, message },
  };
}

function classifyError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 401) return "ai_auth";
    if (err.status === 400) return "ai_invalid_request";
    if (err.status === 429) return "ai_rate_limit";
    if (err.status != null && err.status >= 500) return "ai_server_error";
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) return "ai_timeout";
  return "ai_unknown";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
