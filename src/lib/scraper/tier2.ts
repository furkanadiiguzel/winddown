import type { ScraperTier } from "./index";
import { Tier2UnavailableError } from "./index";

const TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Tier 2 headless scraper using Playwright + @sparticuz/chromium.
 * Only instantiated when ENABLE_TIER2_RENDER=true; any init failure
 * throws Tier2UnavailableError so the orchestrator can emit the event
 * and degrade honestly to the Tier 1 result.
 */
export class PlaywrightScraper implements ScraperTier {
  private browserPromise: Promise<import("playwright-core").Browser> | null = null;

  private async getBrowser(): Promise<import("playwright-core").Browser> {
    if (!this.browserPromise) {
      this.browserPromise = this.initBrowser();
    }
    return this.browserPromise;
  }

  private async initBrowser(): Promise<import("playwright-core").Browser> {
    if (process.env.ENABLE_TIER2_RENDER !== "true") {
      throw new Tier2UnavailableError("ENABLE_TIER2_RENDER is not set");
    }
    try {
      // @sparticuz/chromium provides a Lambda/Vercel-compatible Chromium binary.
      // In local dev, playwright-core finds a local browser; in production,
      // chromium.executablePath() returns the bundled binary path.
      let executablePath: string | undefined;
      try {
        const chromium = await import("@sparticuz/chromium");
        executablePath = await chromium.default.executablePath();
      } catch {
        // Not available (local dev) — let playwright-core find its own binary
      }

      const { chromium: pw } = await import("playwright-core");
      return pw.launch({
        executablePath,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        headless: true,
      });
    } catch (err) {
      throw new Tier2UnavailableError(
        `Browser init failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async fetch(url: string): Promise<{ html: string }> {
    let browser: import("playwright-core").Browser;
    try {
      browser = await this.getBrowser();
    } catch (err) {
      if (err instanceof Tier2UnavailableError) throw err;
      throw new Tier2UnavailableError(String(err));
    }

    const context = await browser.newContext({
      extraHTTPHeaders: { "User-Agent": "WinddownBot/1.0 (+https://winddown.app)" },
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT_MS });

      // Enforce body size cap
      const html = await page.content();
      const bytes = new TextEncoder().encode(html).length;
      await context.close();
      return { html: bytes > MAX_BODY_BYTES ? html.slice(0, MAX_BODY_BYTES) : html };
    } catch (err) {
      await context.close().catch(() => {});
      throw new Tier2UnavailableError(
        `Page fetch failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async close(): Promise<void> {
    if (this.browserPromise) {
      const browser = await this.browserPromise.catch(() => null);
      await browser?.close().catch(() => {});
      this.browserPromise = null;
    }
  }
}

/**
 * Returns a PlaywrightScraper when ENABLE_TIER2_RENDER=true, or null
 * when disabled, so the orchestrator can pass undefined to disable Tier 2.
 */
export function createTier2Scraper(): PlaywrightScraper | null {
  if (process.env.ENABLE_TIER2_RENDER !== "true") return null;
  return new PlaywrightScraper();
}
