import { z } from "zod";

export const ExtractedFieldSchema = z.object({
  fieldId: z.string(),
  value: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  evidence: z
    .string()
    .min(3, "Evidence must be at least 3 characters")
    .max(500, "Evidence must be at most 500 characters"),
  sourceUrl: z.string().url().startsWith("https://", {
    message: "sourceUrl must be an HTTPS URL",
  }),
  provenance: z.enum(["extracted", "manual"]),
  userOverridden: z.boolean(),
});

export const AbsentFieldSchema = z.object({
  fieldId: z.string(),
  status: z.enum(["absent", "rejected"]),
});

export const ExtractionResultFieldSchema = z.union([
  ExtractedFieldSchema,
  AbsentFieldSchema,
]);

export const ExtractionResultSchema = z.object({
  fields: z.record(z.string(), ExtractionResultFieldSchema),
  pagesAnalyzed: z.array(z.string().url()),
  analysisMode: z.enum(["extraction", "manual-fallback"]),
  failureReason: z
    .object({
      errorClass: z.string(),
      message: z.string(),
    })
    .optional(),
});

export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;
export type AbsentField = z.infer<typeof AbsentFieldSchema>;
export type ExtractionResultField = z.infer<typeof ExtractionResultFieldSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
