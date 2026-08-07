// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { fillPdf } from "@/lib/pdf";
import { getTemplate } from "@/lib/pdf/form-template-registry";
import { IntakeStateSchema } from "@/schemas/intake";
import type { IntakeState } from "@/schemas/intake";
import pdfParse from "pdf-parse";
import fixtureJson from "./fixtures/acme-solutions-intake.json";
import path from "path";
import fs from "fs";

// Pin timestamps for deterministic output
process.env.DETERMINISTIC_PDF = "true";

const intakeState: IntakeState = IntakeStateSchema.parse(fixtureJson);

async function generatePdf(state: IntakeState): Promise<Uint8Array> {
  const template = getTemplate(state.entityType);
  if (!template) throw new Error(`No template for entityType: ${state.entityType}`);
  return fillPdf({ template, intakeState: state, mode: state.mode as "preview" | "final" });
}

describe("Golden-file PDF test", () => {
  let pdfBytes1: Uint8Array;
  let pdfBytes2: Uint8Array;
  let pdfText: string;

  beforeAll(async () => {
    pdfBytes1 = await generatePdf(intakeState);
    pdfBytes2 = await generatePdf(intakeState);
    const parsed = await pdfParse(Buffer.from(pdfBytes1));
    pdfText = parsed.text;
  });

  it("generates a non-empty PDF", () => {
    expect(pdfBytes1.length).toBeGreaterThan(1000);
  });

  it("PDF contains the company legal name", () => {
    expect(pdfText).toContain("Acme Solutions LLC");
  });

  it("PDF contains the signer name", () => {
    expect(pdfText).toContain("Jane Doe");
  });

  it("PDF contains the signer title", () => {
    expect(pdfText).toContain("Member");
  });

  it("PDF contains the signing date", () => {
    expect(pdfText).toContain("2026-08-06");
  });

  it("PDF does not contain the certification checkbox value as text", () => {
    // The certification checkbox must remain blank (ink-only signature)
    // We verify the field name itself doesn't appear as filled text
    expect(pdfText).not.toContain("Certification check box");
  });

  it("generation is deterministic — two runs produce identical bytes", () => {
    expect(pdfBytes1.length).toBe(pdfBytes2.length);
    for (let i = 0; i < pdfBytes1.length; i++) {
      if (pdfBytes1[i] !== pdfBytes2[i]) {
        throw new Error(`Byte mismatch at position ${i}`);
      }
    }
  });

  it("preview mode adds PREVIEW watermark text", async () => {
    const previewState: IntakeState = { ...intakeState, mode: "preview", certificationAffirmed: false, userConfirmedReview: false };
    const previewBytes = await generatePdf(previewState);
    const parsed = await pdfParse(Buffer.from(previewBytes));
    expect(parsed.text).toContain("PREVIEW");
  });

  it("final mode does not include PREVIEW watermark", () => {
    expect(pdfText).not.toContain("PREVIEW");
  });
});

describe("IntakeState validation for PDF generation", () => {
  it("rejects mode=final with certificationAffirmed=false", () => {
    const result = IntakeStateSchema.safeParse({
      ...fixtureJson,
      certificationAffirmed: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects mode=final with userConfirmedReview=false", () => {
    const result = IntakeStateSchema.safeParse({
      ...fixtureJson,
      userConfirmedReview: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty companyLegalName", () => {
    const result = IntakeStateSchema.safeParse({
      ...fixtureJson,
      companyLegalName: "",
    });
    expect(result.success).toBe(false);
  });
});
