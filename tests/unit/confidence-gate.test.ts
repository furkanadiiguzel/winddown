import { describe, it, expect, beforeEach } from "vitest";
import { useFormState } from "@/lib/form-state";
import type { ExtractedField } from "@/schemas/extraction";

// Helpers mirroring the gate logic in /review/page.tsx
function isAbsent(field: unknown): boolean {
  return typeof field === "object" && field !== null && "status" in field;
}

function isLowConfidenceLocked(fields: Record<string, unknown>): boolean {
  const field = fields["companyLegalName"];
  if (!field || isAbsent(field)) return false;
  const extracted = field as ExtractedField;
  return extracted.confidence === "low" && !extracted.userOverridden;
}

const baseExtracted: ExtractedField = {
  fieldId: "companyLegalName",
  value: "Acme Solutions LLC",
  confidence: "high",
  evidence: "© 2024 Acme Solutions LLC. All rights reserved.",
  sourceUrl: "https://acme-solutions.com",
  provenance: "extracted",
  userOverridden: false,
};

describe("FR-009a — companyLegalName low-confidence acknowledgement gate", () => {
  beforeEach(() => {
    useFormState.setState((s) => ({ ...s, extractedFields: {} }));
  });

  it("high confidence: gate is NOT locked (user can advance freely)", () => {
    const fields = { companyLegalName: { ...baseExtracted, confidence: "high" } };
    expect(isLowConfidenceLocked(fields)).toBe(false);
  });

  it("medium confidence: gate is NOT locked", () => {
    const fields = { companyLegalName: { ...baseExtracted, confidence: "medium" } };
    expect(isLowConfidenceLocked(fields)).toBe(false);
  });

  it("low confidence + not overridden: gate IS locked (blocks advancement)", () => {
    const fields = { companyLegalName: { ...baseExtracted, confidence: "low", userOverridden: false } };
    expect(isLowConfidenceLocked(fields)).toBe(true);
  });

  it("low confidence + userOverridden=true: gate is unlocked (user acknowledged)", () => {
    const fields = { companyLegalName: { ...baseExtracted, confidence: "low", userOverridden: true } };
    expect(isLowConfidenceLocked(fields)).toBe(false);
  });

  it("absent companyLegalName: gate is NOT locked (completeness gate handles absent fields, not confidence gate — FR-009b)", () => {
    const fields = { companyLegalName: { fieldId: "companyLegalName", status: "absent" } };
    expect(isLowConfidenceLocked(fields)).toBe(false);
  });

  it("missing companyLegalName key: gate is NOT locked", () => {
    expect(isLowConfidenceLocked({})).toBe(false);
  });

  it("setFieldValue on companyLegalName sets userOverridden=true, unlocking gate", () => {
    useFormState.setState((s) => ({
      ...s,
      extractedFields: {
        companyLegalName: { ...baseExtracted, confidence: "low", userOverridden: false },
      },
    }));

    useFormState.getState().setFieldValue("companyLegalName", "Acme Solutions LLC");

    const updated = useFormState.getState().extractedFields["companyLegalName"] as ExtractedField;
    expect(updated.userOverridden).toBe(true);
    expect(isLowConfidenceLocked({ companyLegalName: updated })).toBe(false);
  });

  it("setFieldValue also resets certificationAffirmed (snapshot-bound invariant, FR-010)", () => {
    useFormState.setState((s) => ({
      ...s,
      certificationAffirmed: true,
      extractedFields: {
        companyLegalName: { ...baseExtracted, confidence: "low", userOverridden: false },
      },
    }));

    useFormState.getState().setFieldValue("companyLegalName", "Acme Solutions LLC");

    expect(useFormState.getState().certificationAffirmed).toBe(false);
  });

  it("gate is independent of other low-confidence fields (FR-009b)", () => {
    // A low-confidence contactEmail does NOT lock the companyLegalName gate
    const fields = {
      companyLegalName: { ...baseExtracted, confidence: "high" },
      contactEmail: { ...baseExtracted, fieldId: "contactEmail", confidence: "low", userOverridden: false },
    };
    expect(isLowConfidenceLocked(fields)).toBe(false);
  });
});
