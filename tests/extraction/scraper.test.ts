// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fetchPage } from "@/lib/scraper/tier1";
import { prunePage } from "@/lib/scraper/pruner";
import { scrape, type ScraperTier } from "@/lib/scraper/index";

const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures"
);

// ── Local static fixture server ───────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const file = path.join(FIXTURES_DIR, req.url ?? "/");
    try {
      const html = fs.readFileSync(file, "utf8");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// Bypass SSRF guard for localhost in tests (fixture server is intentionally local)
vi.mock("@/lib/scraper/ssrf-guard", () => ({
  checkUrl: vi.fn().mockResolvedValue(undefined),
  SsrfBlockedError: class SsrfBlockedError extends Error {
    constructor(msg: string) { super(msg); this.name = "SsrfBlockedError"; }
  },
}));

// Bypass robots.txt check — fixture server serves no robots.txt
vi.mock("@/lib/scraper/robots", () => ({
  isAllowed: vi.fn().mockResolvedValue(true),
}));

// ── T043 fixture tests ────────────────────────────────────────────────────────

// Read raw fixture HTML directly — pruner must work on real HTML, not a
// reconstructed summary, so the adversarial / inclusion tests are meaningful.
function fixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8");
}

describe("T043 — scraper fixture tests", () => {
  it("footer-name: pruned text includes LLC name from footer © line", () => {
    const block = prunePage(`${baseUrl}/footer-name.html`, fixture("footer-name.html"));
    expect(block.text).toContain("Acme Solutions LLC");
  });

  it("footer-name: pruned text includes contact email from footer", () => {
    const block = prunePage(`${baseUrl}/footer-name.html`, fixture("footer-name.html"));
    expect(block.text).toContain("contact@acme-solutions.example.com");
  });

  it("spa-shell: body text < 500 chars triggers Tier 2 path (via fetchPage)", async () => {
    const page = await fetchPage(`${baseUrl}/spa-shell.html`);
    expect(page.bodyText.length).toBeLessThan(500);
  });

  it("spa-shell: orchestrator emits tier2_unavailable when no Tier 2 provided", async () => {
    const result = await scrape(`${baseUrl}/spa-shell.html`);
    const event = result.events.find((e) => e.type === "tier2_unavailable");
    expect(event).toBeDefined();
  });

  it("spa-shell: orchestrator uses Tier 2 when provided and body is thin", async () => {
    const mockTier2: ScraperTier = {
      fetch: vi.fn().mockResolvedValue({
        html: `<html><body><footer>© 2024 Rendered LLC.</footer></body></html>`,
      }),
    };
    const result = await scrape(`${baseUrl}/spa-shell.html`, mockTier2);
    expect(mockTier2.fetch).toHaveBeenCalled();
    const combined = result.pages.map((p) => p.text).join("\n");
    expect(combined).toContain("Rendered LLC");
  });

  it("adversarial: blog-comment injection text is NOT in pruned output", () => {
    const block = prunePage(`${baseUrl}/adversarial.html`, fixture("adversarial.html"));
    // blog-comment <div> is not a footer, <p> with entity suffix, or heading —
    // the pruner must not pick it up even though it contains "FRAUD LLC"
    expect(block.text).not.toContain("ignore previous instructions");
    expect(block.text).not.toContain("FRAUD LLC");
    expect(block.text).not.toContain("INJECTED Corp");
  });

  it("adversarial: legitimate footer name IS retained despite injection noise", () => {
    const block = prunePage(`${baseUrl}/adversarial.html`, fixture("adversarial.html"));
    expect(block.text).toContain("Legitimate Business Co.");
  });

  // adversarial-p fixture: injection in <p> DOES survive pruning.
  // This is intentional — the pruner's structural filter is the first layer
  // only. The evidence verifier (verbatim check) and AI prompt
  // context-credibility rules are the second and third layers. See
  // tests/extraction/extractor.test.ts for the full defence-chain assertions.
  it("adversarial-p: injection <p> SURVIVES pruning (honest layering — defence is at extraction layer)", () => {
    const block = prunePage(`${baseUrl}/adversarial-p.html`, fixture("adversarial-p.html"));
    expect(block.text).toContain("FRAUD LLC");
  });

  it("adversarial-p: legitimate footer name is still retained", () => {
    const block = prunePage(`${baseUrl}/adversarial-p.html`, fixture("adversarial-p.html"));
    expect(block.text).toContain("Legitimate Business Co.");
  });

  it("no-name: non-matching paragraphs outside footer are excluded", () => {
    const block = prunePage(`${baseUrl}/no-name.html`, fixture("no-name.html"));
    expect(block.text).not.toContain("We make great products");
    expect(block.text).not.toContain("passionate about design");
  });

  it("terms-name: governing-law paragraph captures company name", () => {
    const block = prunePage(`${baseUrl}/terms-name.html`, fixture("terms-name.html"));
    expect(block.text).toMatch(/Zenith Digital Corp\./);
  });
});

