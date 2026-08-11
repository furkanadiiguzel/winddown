"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormState } from "@/lib/form-state";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { Button } from "@/components/ui/button";
import type { ExtractionResult } from "@/schemas/extraction";

interface SseEvent {
  type: string;
  [key: string]: unknown;
}

const EVENT_LABELS: Record<string, string> = {
  fetching_home: "Fetching homepage…",
  found_pages: "Discovered candidate pages",
  fetching_page: "Fetching sub-page…",
  tier2_fallback: "Site appears JavaScript-rendered — switching to headless mode…",
  extracting: "Analysing content with AI…",
  retrying_ai: "AI request failed, retrying…",
};

const ERROR_MESSAGES: Record<string, string> = {
  ssrf_blocked: "That URL points to a private or restricted address and cannot be analysed.",
  robots_disallowed: "The site's robots.txt disallows automated access.",
  fetch_failed: "We couldn't reach the site. Please check the URL and try again.",
  too_large: "The site's content is too large to analyse.",
  timeout: "The request timed out. The site may be slow or unreachable.",
  ai_auth: "AI service authentication failed. Please contact support.",
  ai_invalid_request: "The AI request was invalid. Please try again.",
  ai_rate_limit: "The AI service is temporarily rate-limited. Please try again shortly.",
  ai_server_error: "The AI service encountered an error. Please try again.",
  ai_timeout: "The AI request timed out. Please try again.",
  tier2_unavailable: "Headless rendering is unavailable. You can enter details manually.",
  // T059 — rate limit message per spec: explicit retry-after hint + manual CTA
  rate_limit_exceeded: "You've reached the analysis limit (5/hour). You can continue with manual entry now, or try again later.",
  internal_error: "An unexpected error occurred. Please try again.",
};

export default function AnalyzeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useFormState();

  const url = searchParams.get("url") ?? "";
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [errorClass, setErrorClass] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) {
      router.replace("/");
      return;
    }

    // Abort any in-flight stream on remount
    esRef.current?.close();

    // POST /api/analyze and consume SSE via fetch + ReadableStream
    // (EventSource only supports GET; we use fetch for POST SSE)
    let cancelled = false;

    async function runAnalysis() {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const cls = (body as { error?: string }).error ?? "internal_error";
          if (!cancelled) setErrorClass(cls);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) { setErrorClass("internal_error"); return; }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (cancelled) { reader.cancel(); return; }
          if (streamDone) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.replace(/^data: /, "").trim();
            if (!line) continue;
            try {
              const event = JSON.parse(line) as SseEvent;
              setEvents((prev) => [...prev, event]);

              if (event.type === "done") {
                const result = event.result as ExtractionResult;
                // Write extraction result into Zustand store
                useFormState.setState({
                  analysisMode: result.analysisMode,
                  extractedFields: result.fields,
                  pagesAnalyzed: result.pagesAnalyzed,
                  failureReason: result.failureReason ?? null,
                  flowStep: "review",
                });
                setDone(true);
                router.push("/review");
              } else if (event.type === "error") {
                setErrorClass((event.class as string) ?? "internal_error");
              }
            } catch {
              // Malformed event — ignore
            }
          }
        }
      } catch {
        if (!cancelled) setErrorClass("internal_error");
      }
    }

    runAnalysis();
    return () => { cancelled = true; };
  }, [url, router]);

  const errorMessage = errorClass ? (ERROR_MESSAGES[errorClass] ?? ERROR_MESSAGES.internal_error) : null;

  return (
    <main className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Analysing your site</h1>
          <p className="mt-1 text-sm text-zinc-500">
            We&apos;re reading your company website to pre-fill the dissolution form.
          </p>
        </div>

        {/* Progress event list */}
        {!errorMessage && (
          <ul className="space-y-2">
            {events
              .filter((e) => e.type !== "done" && e.type !== "error")
              .map((e, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-zinc-700">
                  <span className="text-green-500">✓</span>
                  {EVENT_LABELS[e.type] ?? e.type}
                </li>
              ))}
            {!done && !errorMessage && (
              <li className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="animate-spin">⟳</span>
                Working…
              </li>
            )}
          </ul>
        )}

        {/* Error state */}
        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
            <p className="text-sm font-medium text-red-800">{errorMessage}</p>
            <Button
              variant="outline"
              onClick={() => router.push("/review?manual=true")}
              className="w-full"
            >
              Enter details manually
            </Button>
          </div>
        )}

        <LegalDisclaimer />
      </div>
    </main>
  );
}
