/**
 * T065 — Full journey E2E test.
 * Requires:
 *  - Next.js dev/prod server on http://localhost:3000 (playwright webServer)
 *  - Fixture static server on http://localhost:4000 (globalSetup in setup.ts)
 *  - NEXT_PUBLIC_STUB=false (real extraction path, but mocked AI in CI is not wired here —
 *    run with NEXT_PUBLIC_STUB=true to skip SSE and go straight to /review with stub data)
 *
 * This test exercises the STUB path (NEXT_PUBLIC_STUB=true) for CI reliability.
 * The real SSE path is covered by the quickstart.md smoke test (T067).
 */
import { test, expect } from "@playwright/test";

const STUB_URL = "http://localhost:4000/footer-name.html";

test.describe("T065 — Full dissolution journey (stub mode)", () => {
  test.beforeEach(async ({ page }) => {
    // Clear session storage between tests to avoid state bleed
    await page.goto("/");
    await page.evaluate(() => sessionStorage.removeItem("winddown-form-state"));
  });

  test("navigates from landing → review (stub) → certification → download → done", async ({
    page,
  }) => {
    // ── Landing page ─────────────────────────────────────────────────────────
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Authorization checkbox must be ticked before submit
    const authCheckbox = page.getByRole("checkbox", { name: /authorise|authorize|I authorise|I authorize/i });
    await authCheckbox.check();
    await expect(authCheckbox).toBeChecked();

    // Go directly to /review?stub=true to bypass real SSE
    await page.goto("/review?stub=true", { waitUntil: "networkidle" });

    // ── Review page — extraction board ────────────────────────────────────────
    await expect(page.getByRole("heading", { name: /company information|review|extraction/i })).toBeVisible();

    // Fixture stub has companyLegalName: "Acme Solutions LLC"
    await expect(page.getByText("Acme Solutions LLC")).toBeVisible();

    // LegalDisclaimer must be present
    await expect(page.getByText(/document preparation/i)).toBeVisible();

    // ── Gap completion ────────────────────────────────────────────────────────
    // Click continue from review section
    const continueToGaps = page.getByRole("button", { name: /continue/i }).first();
    await continueToGaps.click();

    // Fill signer details
    await page.getByLabel(/signer.*name|authorised signatory/i).fill("Jane Doe");
    await page.getByLabel(/signer.*title|title/i).fill("Member");
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill("2026-08-07");

    // ── Certification ─────────────────────────────────────────────────────────
    const continueToSert = page.getByRole("button", { name: /continue/i }).first();
    await continueToSert.click();

    // Certification checkbox defaults to unchecked
    const certCheckbox = page.getByRole("checkbox", { name: /certif|under penalty|17-29-701/i });
    await expect(certCheckbox).not.toBeChecked();
    await certCheckbox.check();
    await expect(certCheckbox).toBeChecked();

    // ── Preview + download ────────────────────────────────────────────────────
    const continueToPreview = page.getByRole("button", { name: /continue|proceed/i }).first();
    await continueToPreview.click();

    // Final confirmation checkbox
    const reviewConfirmCheckbox = page.getByRole("checkbox", {
      name: /reviewed|confirm.*review|I have reviewed/i,
    });
    await expect(reviewConfirmCheckbox).not.toBeChecked();
    await reviewConfirmCheckbox.check();
    await expect(reviewConfirmCheckbox).toBeChecked();

    // Download button triggers file download
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /download/i }).click();
    const download = await downloadPromise;

    // Filename should contain company name
    expect(download.suggestedFilename()).toMatch(/acme|dissolution/i);

    // ── /done page ────────────────────────────────────────────────────────────
    await page.waitForURL(/\/done/);
    // Mailing address from wyoming.ts must appear
    await expect(page.getByText(/cheyenne|wyoming|wy\s+82002/i)).toBeVisible();
  });

  test("'Start over' resets session and returns to landing", async ({ page }) => {
    await page.goto("/review?stub=true", { waitUntil: "networkidle" });

    // StartOverLink should be present
    const startOver = page.getByRole("link", { name: /start over/i });
    await expect(startOver).toBeVisible();
    await startOver.click();

    await page.waitForURL("/");
    const stored = await page.evaluate(() =>
      sessionStorage.getItem("winddown-form-state")
    );
    expect(stored).toBeNull();
  });
});
