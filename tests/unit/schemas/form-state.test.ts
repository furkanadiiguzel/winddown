import { describe, it, expect } from "vitest";
import { FormStateSchema, initialFormState } from "@/schemas/form-state";

describe("FormStateSchema", () => {
  it("accepts initial state", () => {
    expect(() => FormStateSchema.parse(initialFormState)).not.toThrow();
  });

  it("initial state has all required field IDs at empty/false", () => {
    expect(initialFormState.certificationAffirmed).toBe(false);
    expect(initialFormState.userConfirmedReview).toBe(false);
    expect(initialFormState.authorizationAffirmed).toBe(false);
    expect(initialFormState.extractedFields).toEqual({});
    expect(initialFormState.signerName).toBe("");
    expect(initialFormState.signingDate).toBe("");
  });

  it("accepts state with populated extracted fields", () => {
    const state = {
      ...initialFormState,
      extractedFields: {
        companyLegalName: {
          fieldId: "companyLegalName",
          value: "Acme LLC",
          confidence: "high",
          evidence: "© 2024 Acme LLC",
          sourceUrl: "https://example.com",
          provenance: "extracted",
          userOverridden: false,
        },
      },
    };
    expect(() => FormStateSchema.parse(state)).not.toThrow();
  });

  it("accepts all flow steps", () => {
    const steps = ["landing", "analyzing", "review", "certification", "preview", "done"] as const;
    for (const step of steps) {
      expect(() =>
        FormStateSchema.parse({ ...initialFormState, flowStep: step })
      ).not.toThrow();
    }
  });

  it("rejects invalid flow step", () => {
    expect(() =>
      FormStateSchema.parse({ ...initialFormState, flowStep: "unknown" })
    ).toThrow();
  });
});
