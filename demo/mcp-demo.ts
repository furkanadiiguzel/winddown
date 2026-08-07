/**
 * T072 — Winddown MCP demo script.
 *
 * Demonstrates the full dissolution preparation flow using the MCP tools:
 *  1. analyze_company_site — scrape and extract company details
 *  2. Human review step (prompted, not automated)
 *  3. prepare_dissolution — generate preview PDF
 *  4. Filing instructions from wyoming.ts
 *
 * Run: pnpm mcp:demo
 *
 * The certification step is intentionally NOT handled by this script.
 * An authorised human signatory must complete W.S. 17-29-701 certification.
 */
import { createInterface } from "readline";
import { writeFileSync } from "fs";
import { scrape } from "../src/lib/scraper/index.js";
import { extract } from "../src/lib/extractor/index.js";
import { fillPdf } from "../src/lib/pdf/index.js";
import { getTemplate } from "../src/lib/pdf/form-template-registry.js";
import wyomingConfig from "../src/config/wyoming.js";
import type { ExtractionResult } from "../src/schemas/extraction.js";
import type { IntakeState } from "../src/schemas/intake.js";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function printSection(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

async function main() {
  console.log("\n🏢  Winddown MCP Demo — Wyoming LLC Dissolution\n");
  console.log("This demo shows how an AI agent can assist with dissolution form");
  console.log("preparation. Certification and filing remain human responsibilities.\n");

  // ── Step 1: analyze_company_site ──────────────────────────────────────────
  printSection("Step 1 — Analyse Company Website");
  const url = await prompt("Enter company website URL (e.g. https://example.com): ");

  console.log("\n[tool: analyze_company_site] Fetching and analysing website…");

  let extractionResult: ExtractionResult;
  try {
    const scrapeResult = await scrape(url.trim());
    if (scrapeResult.errorClass) {
      console.error(`\n✗ Scraping failed: ${scrapeResult.errorClass}`);
      console.log("→ Proceeding with manual entry.\n");
      extractionResult = { analysisMode: "manual-fallback", pagesAnalyzed: [], fields: {} };
    } else {
      extractionResult = await extract(scrapeResult);
    }
  } catch (err) {
    console.error(`\n✗ Error: ${err instanceof Error ? err.message : String(err)}`);
    console.log("→ Proceeding with manual entry.\n");
    extractionResult = { analysisMode: "manual-fallback", pagesAnalyzed: [], fields: {} };
  }

  // ── Step 2: Display extracted fields ─────────────────────────────────────
  printSection("Step 2 — Extracted Fields (for human review)");
  const fields = extractionResult.fields;

  function getField(id: string): string {
    const f = fields[id];
    if (!f || !("value" in f)) return "(not extracted)";
    return `${f.value}  [${f.confidence} confidence]`;
  }

  console.log(`Company legal name : ${getField("companyLegalName")}`);
  console.log(`Contact email      : ${getField("contactEmail")}`);
  console.log(`Contact phone      : ${getField("contactPhone")}`);
  console.log(`Physical address   : ${getField("physicalAddress")}`);
  console.log(`\nPages analysed     : ${extractionResult.pagesAnalyzed.join(", ") || "none"}`);
  console.log(`\n⚠  Review all fields carefully. AI extraction can make errors.`);
  console.log(`   Low-confidence fields especially require human verification.\n`);

  // ── Step 3: Human completes signer details ────────────────────────────────
  printSection("Step 3 — Complete Signer Details (human input required)");

  const companyLegalName =
    fields.companyLegalName && "value" in fields.companyLegalName
      ? fields.companyLegalName.value
      : await prompt("Company legal name: ");
  const signerName = await prompt("Authorised signer full name: ");
  const signerTitle = await prompt("Signer title (e.g. Member, Manager): ");
  const signingDate = await prompt("Signing date (YYYY-MM-DD): ");
  const stateConfirmed = await prompt("Confirm this is a Wyoming-formed entity? (yes/no): ");

  if (!stateConfirmed.trim().toLowerCase().startsWith("y")) {
    console.log("\n✗ State confirmation declined. Exiting.");
    rl.close();
    return;
  }

  // ── Step 4: prepare_dissolution (preview mode) ────────────────────────────
  printSection("Step 4 — Prepare Dissolution PDF (Preview)");
  console.log("[tool: prepare_dissolution] Generating preview PDF…");

  const intakeState: IntakeState = {
    mode: "preview",
    certificationAffirmed: false, // hardcoded — certification is human-only
    userConfirmedReview: false,
    companyLegalName: companyLegalName.trim(),
    entityType: "wyoming-llc",
    stateOfFormation: "Wyoming",
    signerName: signerName.trim(),
    signerTitle: signerTitle.trim(),
    signingDate: signingDate.trim(),
  };

  const template = getTemplate("wyoming-llc");
  if (!template) {
    console.error("✗ Wyoming LLC template not found.");
    rl.close();
    return;
  }

  try {
    const pdfBytes = await fillPdf({ template, intakeState, mode: "preview" });
    const outputPath = "./demo-dissolution-preview.pdf";
    writeFileSync(outputPath, pdfBytes);
    console.log(`\n✓ Preview PDF written to ${outputPath}`);
  } catch (err) {
    console.error(`\n✗ PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Step 5: Filing instructions ───────────────────────────────────────────
  printSection("Step 5 — Next Steps (human actions required)");
  console.log("The following steps CANNOT be automated and must be completed by you:\n");
  console.log("1. Review the preview PDF carefully.");
  console.log("   Every field must be accurate — you are certifying under W.S. 17-29-701.");
  console.log("");
  console.log("2. DO NOT SKIP THE CERTIFICATION STEP.");
  console.log("   An authorised signatory must sign in ink on the printed form.");
  console.log("   Electronic signatures are not accepted for this filing.");
  console.log("");
  console.log("3. Mail the signed original to:");
  console.log(`     ${wyomingConfig.mailingAddress.recipient}`);
  console.log(`     ${wyomingConfig.mailingAddress.street}`);
  console.log(`     ${wyomingConfig.mailingAddress.city}, ${wyomingConfig.mailingAddress.state} ${wyomingConfig.mailingAddress.zip}`);
  console.log("");
  console.log(`4. Fee: ${wyomingConfig.feeNote}`);
  console.log("");
  console.log(`5. Processing: ${wyomingConfig.processingTimeNote}`);
  console.log("");
  console.log(`Statute reference: ${wyomingConfig.statuteRef}`);
  console.log(`SOS forms page   : ${wyomingConfig.sosFormsUrl}`);
  console.log("");
  console.log("⚠  This tool prepares documents only. It does not provide legal advice.");
  console.log("   If you are uncertain about any winding-up requirements, consult a");
  console.log("   licensed attorney before proceeding.\n");

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
