import { describe, it, expect, beforeEach } from "vitest";
import { useFormState } from "@/lib/form-state";
import { isAbsent, isLowConfidenceLocked } from "@/lib/confidence-gate";
import type { ExtractedField, AbsentField } from "@/schemas/extraction";

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
    const field = { ...baseExtracted, confidence: "high" } as ExtractedField;
    expect(isLowConfidenceLocked(field, undefined)).toBe(false);
  });

  it("medium confidence: gate is NOT locked", () => {
    const field = { ...baseExtracted, confidence: "medium" } as ExtractedField;
    expect(isLowConfidenceLocked(field, undefined)).toBe(false);
  });

  it("low confidence + not overridden: gate IS locked (blocks advancement)", () => {
    const field = { ...baseExtracted, confidence: "low", userOverridden: false } as ExtractedField;
    expect(isLowConfidenceLocked(field, undefined)).toBe(true);
  });

  it("low confidence + userOverridden=true: gate is unlocked (user acknowledged)", () => {
    const field = { ...baseExtracted, confidence: "low", userOverridden: true } as ExtractedField;
    expect(isLowConfidenceLocked(field, undefined)).toBe(false);
  });

  it("absent companyLegalName: gate is NOT locked (completeness gate handles absent fields, not confidence gate — FR-009b)", () => {
    const field: AbsentField = { fieldId: "companyLegalName", status: "absent" };
    expect(isLowConfidenceLocked(field, undefined)).toBe(false);
  });

  it("missing companyLegalName key: gate is NOT locked", () => {
    expect(isLowConfidenceLocked(undefined, undefined)).toBe(false);
  });

  it("storeOverride with userOverridden=true unlocks even when base field is low-confidence", () => {
    const field = { ...baseExtracted, confidence: "low", userOverridden: false } as ExtractedField;
    const storeOverride = { ...baseExtracted, confidence: "low", userOverridden: true } as ExtractedField;
    expect(isLowConfidenceLocked(field, storeOverride)).toBe(false);
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
    expect(isLowConfidenceLocked(updated, undefined)).toBe(false);
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
    const field = { ...baseExtracted, confidence: "high" } as ExtractedField;
    // A low-confidence contactEmail does NOT affect the companyLegalName gate
    expect(isLowConfidenceLocked(field, undefined)).toBe(false);
  });
});
