const TIMEOUT_MS = 15_000;
const MAX_BODY = 2 * 1024 * 1024;
const WAYBACK_API = "https://archive.org/wayback/available";

/**
 * Tier 4 — Wayback Machine (archive.org).
 * Fetches the most recent cached snapshot of a URL when direct access fails.
 * Two-step: (1) look up snapshot URL, (2) fetch the archived HTML.
 */
export async function fetchViaWayback(url: string): Promise<{ html: string }> {
  // Step 1: find the closest available snapshot
  const lookupCtrl = new AbortController();
  const t1 = setTimeout(() => lookupCtrl.abort(), TIMEOUT_MS);

  let snapshotUrl: string;
  try {
    const res = await fetch(
      `${WAYBACK_API}?url=${encodeURIComponent(url)}&output=json`,
      { signal: lookupCtrl.signal }
    );
    if (!res.ok) throw new Error(`Wayback API returned ${res.status}`);
    const data = (await res.json()) as {
      archived_snapshots?: { closest?: { available?: boolean; url?: string } };
    };
    const closest = data?.archived_snapshots?.closest;
    if (!closest?.available || !closest.url) throw new Error("No snapshot available");
    snapshotUrl = closest.url;
  } finally {
    clearTimeout(t1);
  }

  // Step 2: fetch the archived snapshot HTML
  const fetchCtrl = new AbortController();
  const t2 = setTimeout(() => fetchCtrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(snapshotUrl, {
      signal: fetchCtrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "WinddownBot/1.0 (+https://winddown.app)" },
    });
    if (!res.ok) throw new Error(`Wayback snapshot returned ${res.status}`);

    let html = await res.text();
    if (html.length > MAX_BODY) html = html.slice(0, MAX_BODY);
    if (html.trim().length < 50) throw new Error("Wayback returned empty content");

    return { html };
  } finally {
    clearTimeout(t2);
  }
}
