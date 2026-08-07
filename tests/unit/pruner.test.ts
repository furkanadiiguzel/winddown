import { describe, it, expect } from "vitest";
import { prunePage, prunePages } from "@/lib/scraper/pruner";

// ── Entity-suffix regex ───────────────────────────────────────────────────────

describe("T039 — entity-suffix pattern", () => {
  const cases: [string, boolean][] = [
    ["© 2024 Acme Solutions LLC. All rights reserved.", true],
    ["Formed under L.L.C. provisions", true],
    ["Registered as Inc. in Wyoming.", true],
    ["Acme Corp. dissolved 2020.", true],
    ["Acme Corp dissolved 2020.", true],
    ["Acme Ltd under Wyoming law.", true],
    ["Acme Company was founded in 2001.", true],
    ["This is a generic paragraph about software.", false],
    ["Contact us today!", false],
  ];

  for (const [text, expected] of cases) {
    it(`${expected ? "includes" : "excludes"}: "${text.slice(0, 50)}"`, () => {
      const html = `<html><body><p>${text}</p></body></html>`;
      const block = prunePage("https://example.com/", html);
      if (expected) {
        expect(block.text).toContain(text);
      } else {
        expect(block.text).not.toContain(text);
      }
    });
  }
});

// ── Contact pattern ───────────────────────────────────────────────────────────

describe("T039 — contact pattern", () => {
  const cases: [string, boolean][] = [
    ["Email us at support@acme-solutions.com for help.", true],
    ["Call us at +1 (800) 555-1234 during business hours.", true],
    ["Reach us: info@winddown.app", true],
    ["Phone: 307-555-0199", true],
    ["This paragraph has no contact details.", false],
  ];

  for (const [text, expected] of cases) {
    it(`contact ${expected ? "matches" : "skipped"}: "${text.slice(0, 50)}"`, () => {
      const html = `<html><body><p>${text}</p></body></html>`;
      const block = prunePage("https://example.com/", html);
      if (expected) {
        expect(block.text).toContain(text);
      } else {
        expect(block.text).not.toContain(text);
      }
    });
  }
});

// ── Governing-law signal ──────────────────────────────────────────────────────

describe("T039 — governing law signal", () => {
  const cases: [string, boolean][] = [
    ["The governing law of this agreement is Wyoming.", true],
    ["These terms are subject to the jurisdiction of Wyoming courts.", true],
    ["Acme Solutions LLC was formed in the State of Wyoming.", true],
    ["Organized under the laws of Wyoming.", true],
    ["We offer great products at fair prices.", false],
  ];

  for (const [text, expected] of cases) {
    it(`law ${expected ? "matches" : "skipped"}: "${text.slice(0, 50)}"`, () => {
      const html = `<html><body><p>${text}</p></body></html>`;
      const block = prunePage("https://example.com/", html);
      if (expected) {
        expect(block.text).toContain(text);
      } else {
        expect(block.text).not.toContain(text);
      }
    });
  }
});

// ── Footer text always included ───────────────────────────────────────────────

describe("T039 — footer text", () => {
  it("includes text from <footer> element", () => {
    const html = `<html><body>
      <p>Unrelated paragraph.</p>
      <footer>© 2024 Winddown Inc. All rights reserved.</footer>
    </body></html>`;
    const block = prunePage("https://example.com/", html);
    expect(block.text).toContain("© 2024 Winddown Inc.");
  });

  it("includes text from role=contentinfo", () => {
    const html = `<html><body>
      <div role="contentinfo">© 2024 Acme Corp.</div>
    </body></html>`;
    const block = prunePage("https://example.com/", html);
    expect(block.text).toContain("© 2024 Acme Corp.");
  });

  it("non-matching paragraphs outside footer are excluded", () => {
    const html = `<html><body>
      <p>We build great software.</p>
      <p>Our team is passionate about quality.</p>
    </body></html>`;
    const block = prunePage("https://example.com/", html);
    expect(block.text).not.toContain("We build great software.");
    expect(block.text).not.toContain("passionate about quality");
  });
});

// ── 8 000-char total cap ──────────────────────────────────────────────────────

describe("T039 — 8 000-char cap", () => {
  it("truncates total output to 8 000 chars across multiple pages", () => {
    const bigText = "A".repeat(5_000);
    const pages = [
      { url: "https://example.com/", html: `<html><body><footer>${bigText}</footer></body></html>` },
      { url: "https://example.com/about", html: `<html><body><footer>${bigText}</footer></body></html>` },
    ];
    const blocks = prunePages(pages);
    const total = blocks.reduce((s, b) => s + b.text.length, 0);
    expect(total).toBeLessThanOrEqual(8_000);
  });

  it("does not truncate when total is under cap", () => {
    const pages = [
      { url: "https://example.com/", html: `<html><body><footer>Short footer</footer></body></html>` },
    ];
    const blocks = prunePages(pages);
    expect(blocks[0].text).toContain("Short footer");
  });

  it("truncates in fetch order (first page gets priority)", () => {
    // First page exactly fills the cap — second page gets nothing
    const bigText = "X".repeat(8_000);
    const pages = [
      { url: "https://example.com/", html: `<html><body><footer>${bigText}</footer></body></html>` },
      { url: "https://example.com/about", html: `<html><body><footer>SHOULD_NOT_APPEAR</footer></body></html>` },
    ];
    const blocks = prunePages(pages);
    const total = blocks.reduce((s, b) => s + b.text.length, 0);
    expect(total).toBeLessThanOrEqual(8_000);
    // Second block is either absent or empty
    const secondText = blocks[1]?.text ?? "";
    expect(secondText).not.toContain("SHOULD_NOT_APPEAR");
  });
});
