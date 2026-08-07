/**
 * T066 — "Start over" E2E assertion.
 * Verifies that StartOverLink clears sessionStorage and redirects to /.
 */
import { test, expect } from "@playwright/test";

test.describe("T066 — Start over resets state and redirects to /", () => {
  test("from review page: start over clears session and lands on /", async ({ page }) => {
    // Reach /review in stub mode
    await page.goto("/review?stub=true", { waitUntil: "networkidle" });

    // Advance to certification section to ensure store is populated
    const continueBtn = page.getByRole("button", { name: /continue/i }).first();
    await continueBtn.click();

    // Fill mandatory gap fields so the gate passes
    await page.getByLabel(/signer.*name|authorised signatory/i).fill("Jane Doe");
    await page.getByLabel(/signer.*title|title/i).fill("Member");
    await page.locator('input[type="date"]').first().fill("2026-08-07");

    const continueToSert = page.getByRole("button", { name: /continue/i }).first();
    await continueToSert.click();

    // Tick certification checkbox
    const certCheckbox = page.getByRole("checkbox", { name: /certif|under penalty|17-29-701/i });
    await certCheckbox.check();
    await expect(certCheckbox).toBeChecked();

    // Now click Start over
    const startOver = page.getByRole("link", { name: /start over/i });
    await startOver.click();

    // Should redirect to /
    await page.waitForURL("/");

    // Session must be cleared
    const stored = await page.evaluate(() =>
      sessionStorage.getItem("winddown-form-state")
    );
    expect(stored).toBeNull();

    // URL input must be empty (landing form reset)
    const urlInput = page.getByRole("textbox", { name: /website|url|company/i });
    await expect(urlInput).toHaveValue("");
  });
});
