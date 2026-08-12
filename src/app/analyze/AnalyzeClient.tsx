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
  tier3_jina: "Direct fetch blocked — trying Jina AI Reader…",
  tier4_wayback: "Jina unavailable — trying Wayback Machine archive…",
  extracting: "Analysing content with AI…",
  retrying_ai: "AI request failed, retrying…",
};

const ERROR_MESSAGES: Record<string, string> = {
  ssrf_blocked: "That URL points to a private or restricted address and cannot be analysed.",
  ssrf_error: "We couldn't verify that URL is safe to access. Please check the URL and try again.",
  robots_blocked: "The site's robots.txt disallows automated access. Please enter your details manually.",
  robots_disallowed: "The site's robots.txt disallows automated access. Please enter your details manually.",
  fetch_error: "We couldn't reach that site. It may be down, blocking scrapers, or require a login. Please enter your details manually.",
  fetch_failed: "We couldn't reach that site. It may be down, blocking scrapers, or require a login. Please enter your details manually.",
  too_large: "The site's content is too large to analyse.",
  timeout: "The request timed out. The site may be slow or unreachable.",
  ai_auth: "AI service authentication failed. Please contact support.",
  ai_invalid_request: "The AI request was invalid. Please try again.",
  ai_rate_limit: "The AI service is temporarily rate-limited. Please try again shortly.",
  ai_server_error: "The AI service encountered an error. Please try again.",
  ai_timeout: "The AI request timed out. Please try again.",
  tier2_unavailable: "Headless rendering is unavailable. You can enter details manually.",
  rate_limit_exceeded: "You've reached the hourly analysis limit. You can continue with manual entry now, or try again in an hour.",
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
    if (!url) { router.replace("/"); return; }

    esRef.current?.close();
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
              // malformed event — ignore
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
  const visibleEvents = events.filter((e) => e.type !== "done" && e.type !== "error");

  return (
    <main className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="border-b-2 border-navy bg-cream px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-navy flex items-center justify-center">
          <span className="font-display text-white text-lg leading-none">W</span>
        </div>
        <span className="font-display text-xl tracking-wide text-navy">WINDDOWN</span>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-16 space-y-8">
        <div>
          <span className="inline-block bg-brand-yellow border-2 border-navy px-3 py-1 text-xs font-bold uppercase tracking-widest text-navy shadow-brutal-sm mb-4">
            Analysis In Progress
          </span>
          <h1 className="font-display text-4xl sm:text-5xl uppercase text-navy leading-none">
            Analysing<br />Your Site
          </h1>
          <p className="mt-3 text-sm text-navy/60 font-medium">
            We&apos;re reading your company website to pre-fill the dissolution form.
          </p>
        </div>

        {!errorMessage && (
          <div className="border-2 border-navy bg-white shadow-brutal p-6 space-y-3">
            {visibleEvents.map((e, i) => (
              <div key={i} className="flex items-center gap-3 text-sm font-medium text-navy">
                <div className="w-5 h-5 bg-navy flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {EVENT_LABELS[e.type] ?? e.type}
              </div>
            ))}
            {!done && !errorMessage && (
              <div className="flex items-center gap-3 text-sm font-medium text-navy/40">
                <div className="w-5 h-5 border-2 border-navy/30 flex items-center justify-center shrink-0 animate-pulse">
                  <div className="w-2 h-2 bg-navy/30" />
                </div>
                Working…
              </div>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="border-2 border-brand-red bg-white shadow-[4px_4px_0px_0px_#DC2626] p-6 space-y-4">
            <span className="inline-block bg-brand-red border-2 border-navy px-3 py-1 text-xs font-bold uppercase tracking-widest text-white">
              Error
            </span>
            <p className="text-sm font-medium text-navy leading-relaxed">{errorMessage}</p>
            <Button variant="outline" onClick={() => router.push("/review?manual=true")} className="w-full">
              Enter Details Manually →
            </Button>
          </div>
        )}

        <LegalDisclaimer />
      </div>
    </main>
  );
}
