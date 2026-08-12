import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkUrl, SsrfBlockedError } from "@/lib/scraper/ssrf-guard";
import { scrape } from "@/lib/scraper/index";
import { extract } from "@/lib/extractor/index";
import { createTier2Scraper } from "@/lib/scraper/tier2";
import { rateLimit } from "@/lib/rate-limit";

const RequestSchema = z.object({
  url: z.string().url(),
});

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function getClientIp(req: NextRequest): string {
  // Vercel sets x-forwarded-for; fall back to a placeholder for local dev.
  // FR-021: IP is only used for rate-limiting key derivation; never logged raw.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Parse & validate request body ────────────────────────────────────────
  let url: string;
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: parsed.error.issues[0]?.message ?? "Invalid URL" },
        { status: 422 }
      );
    }
    url = parsed.data.url;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Request body must be valid JSON" },
      { status: 422 }
    );
  }

  // ── SSRF guard (pre-stream) ───────────────────────────────────────────────
  try {
    await checkUrl(url);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return NextResponse.json(
        { error: "ssrf_blocked", message: "The provided URL is not allowed." },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "ssrf_error", message: "URL validation failed." },
      { status: 422 }
    );
  }

  // ── Rate limit (T058) ─────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const limitResult = await rateLimit(ip);
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", message: "Rate limit exceeded. Try again later or enter details manually." },
      {
        status: 429,
        headers: { "Retry-After": String(limitResult.retryAfterSeconds ?? 3600) },
      }
    );
  }

  // ── SSE stream ────────────────────────────────────────────────────────────
  const tier2 = createTier2Scraper() ?? undefined;
  const startMs = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (data: unknown) =>
        controller.enqueue(new TextEncoder().encode(sseEvent(data)));

      try {
        // Run scraping pipeline; translate ScrapeEvent → SSE events
        const scrapeResult = await scrape(url, tier2, {
          onEvent: (event) => {
            switch (event.type) {
              case "fetching_home":
                encode({ type: "fetching_home", url: event.url });
                break;
              case "found_pages":
                encode({ type: "found_pages", urls: event.urls });
                break;
              case "fetching_page":
                encode({ type: "fetching_page", url: event.url, tier: 1 });
                break;
              case "tier2_unavailable":
                encode({ type: "tier2_fallback", url });
                break;
              case "tier3_jina":
                encode({ type: "tier3_jina" });
                break;
              case "tier4_wayback":
                encode({ type: "tier4_wayback" });
                break;
              case "ssrf_blocked":
              case "robots_blocked":
                // Internal guard events — surfaced as part of done/error
                break;
            }
          },
        });

        if (scrapeResult.errorClass) {
          encode({ type: "error", class: scrapeResult.errorClass, message: "Scraping failed." });
          controller.close();
          return;
        }

        encode({ type: "extracting" });

        const extractionResult = await extract(scrapeResult);

        const latencyMs = Date.now() - startMs;
        // FR-021: log only latency + errorClass, not URL or content
        console.info(
          `[analyze] done latency=${latencyMs}ms mode=${extractionResult.analysisMode}`
        );

        encode({ type: "done", result: extractionResult });
      } catch (err: unknown) {
        const errorClass =
          err instanceof Error && err.message.includes("ssrf") ? "ssrf_blocked" : "internal_error";
        console.warn(`[analyze] errorClass=${errorClass}`);
        encode({ type: "error", class: errorClass, message: "An unexpected error occurred." });
      } finally {
        controller.close();
        await tier2?.close().catch(() => {});
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
