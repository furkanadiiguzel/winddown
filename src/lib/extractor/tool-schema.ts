/**
 * T044 — report_extracted_fields tool schema.
 *
 * Structural guarantee: `certificationAffirmed` is absent from this schema
 * by design. The AI must never set the certification state — that is a
 * human-only action enforced by the UI and IntakeStateSchema.superRefine().
 */

export const REPORT_EXTRACTED_FIELDS_TOOL = {
  name: "report_extracted_fields",
  description:
    "Report the structured fields extracted from the company's website. " +
    "Only report fields for which you found direct evidence in the provided page text. " +
    "Do not infer, fabricate, or combine information. " +
    "For each field, include the exact verbatim snippet from the page as evidence.",
  input_schema: {
    type: "object" as const,
    properties: {
      fields: {
        type: "object",
        description: "Map of field ID to extracted field data.",
        properties: {
          companyLegalName: fieldSchema(
            "The company's full legal name exactly as it appears in a legal or footer context " +
            "(e.g. © line, terms of service, formation documents). " +
            "Do not use a trade name or abbreviation unless the full legal name is unavailable."
          ),
          contactEmail: fieldSchema("Contact email address for the company."),
          contactPhone: fieldSchema("Contact phone number for the company."),
          physicalAddress: fieldSchema(
            "The company's physical mailing or registered address."
          ),
        },
        additionalProperties: false,
      },
    },
    required: ["fields"],
    additionalProperties: false,
  },
} as const;

function fieldSchema(description: string) {
  return {
    type: "object",
    description,
    properties: {
      value: {
        type: "string",
        description: "The extracted value, exactly as found on the page.",
      },
      confidence: {
        type: "string",
        enum: ["high", "medium", "low"],
        description:
          "high: unambiguous legal context (footer ©, terms, formation doc); " +
          "medium: plausible but indirect; " +
          "low: inferred or context-uncertain.",
      },
      evidence: {
        type: "string",
        description:
          "A verbatim snippet (3–500 chars) from the page text that contains or directly supports the extracted value.",
      },
      sourceUrl: {
        type: "string",
        description: "The URL of the page where the evidence was found.",
      },
    },
    required: ["value", "confidence", "evidence", "sourceUrl"],
    additionalProperties: false,
  };
}

/** The extractable field IDs — kept in sync with the tool schema properties. */
export const EXTRACTABLE_FIELD_IDS = [
  "companyLegalName",
  "contactEmail",
  "contactPhone",
  "physicalAddress",
] as const;

export type ExtractableFieldId = (typeof EXTRACTABLE_FIELD_IDS)[number];
