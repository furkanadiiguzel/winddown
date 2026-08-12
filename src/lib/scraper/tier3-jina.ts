const TIMEOUT_MS = 20_000;
const MAX_BODY = 2 * 1024 * 1024;

/**
 * Tier 3 — Jina AI Reader (r.jina.ai).
 * Prepend the target URL with https://r.jina.ai/ and Jina returns clean
 * readable text, bypassing most anti-scraper measures. No API key required.
 */
export async function fetchViaJina(url: string): Promise<{ text: string }> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(jinaUrl, {
      headers: {
        Accept: "text/plain",
        "User-Agent": "WinddownBot/1.0 (+https://winddown.app)",
        // Ask Jina for the raw content without its own annotation
        "X-No-Cache": "true",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!res.ok) throw new Error(`Jina returned ${res.status}`);

    let text = await res.text();
    if (text.length > MAX_BODY) text = text.slice(0, MAX_BODY);
    if (text.trim().length < 50) throw new Error("Jina returned empty content");

    return { text };
  } finally {
    clearTimeout(timer);
  }
}
