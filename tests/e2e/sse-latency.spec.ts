/**
 * T076 — SC-005 SSE first-event latency assertion.
 * Asserts that the first SSE data event (fetching_home) is received
 * within 1 000 ms of the POST /api/analyze request.
 *
 * Uses the fixture server on http://localhost:4000.
 * Uses page.evaluate() to stream the response in the browser context
 * so we can time the first chunk rather than waiting for the full body.
 */
import { test, expect } from "@playwright/test";

const FIXTURE_URL = "http://localhost:4000/footer-name.html";
const MAX_FIRST_EVENT_MS = 1_000;

test("T076 — first SSE event (fetching_home) arrives within 1 000 ms", async ({
  page,
}) => {
  // Navigate to the app first so fetch() uses the same origin
  await page.goto("/");

  const result = await page.evaluate(
    async ({ url, maxMs }: { url: string; maxMs: number }) => {
      const start = performance.now();

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        return { error: `HTTP ${res.status}`, elapsed: -1, firstType: null };
      }

      const reader = res.body?.getReader();
      if (!reader) return { error: "no reader", elapsed: -1, firstType: null };

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const elapsed = performance.now() - start;

        // Parse any complete SSE messages
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          try {
            const event = JSON.parse(line) as { type: string };
            // Return on first data event
            reader.cancel();
            return { error: null, elapsed, firstType: event.type };
          } catch {
            // ignore parse error
          }
        }

        // Give up if it's taking too long (10× limit)
        if (elapsed > maxMs * 10) {
          reader.cancel();
          return {
            error: `first event not received within ${maxMs * 10}ms`,
            elapsed,
            firstType: null,
          };
        }
      }

      return { error: "stream ended without data event", elapsed: -1, firstType: null };
    },
    { url: FIXTURE_URL, maxMs: MAX_FIRST_EVENT_MS }
  );

  expect(result.error).toBeNull();
  expect(result.firstType).toBe("fetching_home");
  expect(result.elapsed).toBeLessThan(MAX_FIRST_EVENT_MS);
});
