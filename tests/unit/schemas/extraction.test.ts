import { describe, it, expect } from "vitest";
import { ExtractedFieldSchema, AbsentFieldSchema, ExtractionResultSchema } from "@/schemas/extraction";

const validExtracted = {
  fieldId: "companyLegalName",
  value: "Acme Solutions LLC",
  confidence: "high" as const,
  evidence: "© 2024 Acme Solutions LLC. All rights reserved.",
  sourceUrl: "https://www.example.com",
  provenance: "extracted" as const,
  userOverridden: false,
};

describe("ExtractedFieldSchema", () => {
  it("accepts a valid extracted field", () => {
    expect(() => ExtractedFieldSchema.parse(validExtracted)).not.toThrow();
  });

  it("rejects when evidence is missing", () => {
    const { evidence: _, ...noEvidence } = validExtracted;
    expect(() => ExtractedFieldSchema.parse(noEvidence)).toThrow();
  });

  it("rejects evidence shorter than 3 characters", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ ...validExtracted, evidence: "AB" })
    ).toThrow();
  });

  it("rejects evidence longer than 500 characters", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ ...validExtracted, evidence: "A".repeat(501) })
    ).toThrow();
  });

  it("rejects invalid confidence value", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ ...validExtracted, confidence: "ultra" })
    ).toThrow();
  });

  it("rejects non-HTTPS sourceUrl", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ ...validExtracted, sourceUrl: "http://example.com" })
    ).toThrow();
  });

  it("accepts evidence at exactly 3 characters", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ ...validExtracted, evidence: "ABC" })
    ).not.toThrow();
  });

  it("accepts evidence at exactly 500 characters", () => {
    expect(() =>
      ExtractedFieldSchema.parse({ ...validExtracted, evidence: "A".repeat(500) })
    ).not.toThrow();
  });
});

describe("AbsentFieldSchema", () => {
  it("accepts status=absent", () => {
    expect(() =>
      AbsentFieldSchema.parse({ fieldId: "companyLegalName", status: "absent" })
    ).not.toThrow();
  });

  it("accepts status=rejected", () => {
    expect(() =>
      AbsentFieldSchema.parse({ fieldId: "companyLegalName", status: "rejected" })
    ).not.toThrow();
  });

  it("rejects unknown status", () => {
    expect(() =>
      AbsentFieldSchema.parse({ fieldId: "companyLegalName", status: "unknown" })
    ).toThrow();
  });
});

describe("ExtractionResultSchema", () => {
  it("accepts a valid result with mixed fields", () => {
    const result = {
      fields: {
        companyLegalName: validExtracted,
        contactEmail: { fieldId: "contactEmail", status: "absent" },
      },
      pagesAnalyzed: ["https://www.example.com"],
      analysisMode: "extraction",
    };
    expect(() => ExtractionResultSchema.parse(result)).not.toThrow();
  });

  it("accepts manual-fallback mode with failureReason", () => {
    const result = {
      fields: {},
      pagesAnalyzed: ["https://www.example.com"],
      analysisMode: "manual-fallback",
      failureReason: { errorClass: "ai_rate_limit", message: "Rate limited" },
    };
    expect(() => ExtractionResultSchema.parse(result)).not.toThrow();
  });
});
