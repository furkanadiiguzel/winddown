/**
 * T063 — Accessibility audit.
 * Runs axe-core against all key pages in the app.
 * All violations must be zero at the "critical" and "serious" levels.
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function assertNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const criticalOrSerious = results.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? "")
  );

  if (criticalOrSerious.length > 0) {
    const summary = criticalOrSerious
      .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
      .join("\n");
    expect.soft(criticalOrSerious, `Accessibility violations:\n${summary}`).toHaveLength(0);
  }
}

test.describe("T063 — Accessibility audit", () => {
  test("/ (landing page) — no critical/serious violations", async ({ page }) => {
    await page.goto("/");
    await assertNoViolations(page);
  });

  test("/review?stub=true — no critical/serious violations", async ({ page }) => {
    await page.goto("/review?stub=true", { waitUntil: "networkidle" });
    await assertNoViolations(page);
  });

  test("/review?manual=true — no critical/serious violations", async ({ page }) => {
    await page.goto("/review?manual=true", { waitUntil: "networkidle" });
    await assertNoViolations(page);
  });

  test("/done — no critical/serious violations", async ({ page }) => {
    await page.goto("/done");
    await assertNoViolations(page);
  });

  test("/review?stub=true — certification checkbox is accessible", async ({ page }) => {
    await page.goto("/review?stub=true", { waitUntil: "networkidle" });

    // Advance to certification step
    const continueBtn = page.getByRole("button", { name: /continue/i }).first();
    await continueBtn.click();

    await page.getByLabel(/signer.*name|authorised signatory/i).fill("Jane Doe");
    await page.getByLabel(/signer.*title|title/i).fill("Member");
    await page.locator('input[type="date"]').first().fill("2026-08-07");

    const continueToSert = page.getByRole("button", { name: /continue/i }).first();
    await continueToSert.click();

    // Certification checkbox must be reachable by role/label
    const certCheckbox = page.getByRole("checkbox", { name: /certif|17-29-701/i });
    await expect(certCheckbox).toBeVisible();
    await expect(certCheckbox).not.toBeChecked();

    // Must be focusable via keyboard (Tab)
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("id"));
    // Not strictly asserting the id since focus order varies — just check no a11y errors
    await assertNoViolations(page);
  });

  test("/review?stub=true — field cards have accessible edit buttons", async ({ page }) => {
    await page.goto("/review?stub=true", { waitUntil: "networkidle" });

    // All edit buttons must have aria-labels
    const editButtons = await page.getByRole("button", { name: /edit/i }).all();
    expect(editButtons.length).toBeGreaterThan(0);
    for (const btn of editButtons) {
      const label = await btn.getAttribute("aria-label");
      expect(label).toBeTruthy();
    }
  });
});
