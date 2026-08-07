import { describe, it, expect } from "vitest";
import { IntakeStateSchema } from "@/schemas/intake";

const validPreview = {
  mode: "preview" as const,
  certificationAffirmed: false,
  userConfirmedReview: false,
  companyLegalName: "Acme Solutions LLC",
  entityType: "wyoming-llc",
  signerName: "Jane Doe",
  signerTitle: "Member",
  signingDate: "2026-08-06",
};

const validFinal = {
  ...validPreview,
  mode: "final" as const,
  certificationAffirmed: true,
  userConfirmedReview: true,
};

describe("IntakeStateSchema", () => {
  it("accepts valid preview payload with confirmations false", () => {
    expect(() => IntakeStateSchema.parse(validPreview)).not.toThrow();
  });

  it("accepts valid final payload with both confirmations true", () => {
    expect(() => IntakeStateSchema.parse(validFinal)).not.toThrow();
  });

  it("rejects mode=final when certificationAffirmed is false", () => {
    const result = IntakeStateSchema.safeParse({
      ...validFinal,
      certificationAffirmed: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("certificationAffirmed");
    }
  });

  it("rejects mode=final when userConfirmedReview is false", () => {
    const result = IntakeStateSchema.safeParse({
      ...validFinal,
      userConfirmedReview: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("userConfirmedReview");
    }
  });

  it("rejects empty companyLegalName", () => {
    const result = IntakeStateSchema.safeParse({
      ...validFinal,
      companyLegalName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing signerName", () => {
    const { signerName: _, ...noSigner } = validFinal;
    const result = IntakeStateSchema.safeParse(noSigner);
    expect(result.success).toBe(false);
  });

  it("accepts optional contactEmail as empty string", () => {
    expect(() =>
      IntakeStateSchema.parse({ ...validPreview, contactEmail: "" })
    ).not.toThrow();
  });

  it("accepts optional contactEmail as valid email", () => {
    expect(() =>
      IntakeStateSchema.parse({ ...validPreview, contactEmail: "hello@acme.com" })
    ).not.toThrow();
  });

  it("rejects invalid contactEmail", () => {
    const result = IntakeStateSchema.safeParse({
      ...validPreview,
      contactEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});
