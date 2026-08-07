import type { ExtractionResult } from "@/schemas/extraction";

/**
 * STUB_EXTRACTION_RESULT — hardcoded fixture for walking-skeleton development.
 * Loaded when NEXT_PUBLIC_STUB === 'true'.
 *
 * Contains:
 *  - companyLegalName: high confidence, extracted from footer
 *  - contactEmail: absent (needs user input)
 *  - signerName: absent (needs user input)
 */
export const STUB_EXTRACTION_RESULT: ExtractionResult = {
  fields: {
    companyLegalName: {
      fieldId: "companyLegalName",
      value: "Acme Solutions LLC",
      confidence: "high",
      evidence: "© 2024 Acme Solutions LLC. All rights reserved.",
      sourceUrl: "https://acmesolutions.example.com",
      provenance: "extracted",
      userOverridden: false,
    },
    contactEmail: {
      fieldId: "contactEmail",
      status: "absent",
    },
    signerName: {
      fieldId: "signerName",
      status: "absent",
    },
  },
  pagesAnalyzed: ["https://acmesolutions.example.com"],
  analysisMode: "extraction",
};
