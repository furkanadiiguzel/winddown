import { z } from "zod";

export const FieldMapEntryAcroFormSchema = z.object({
  type: z.literal("acroform"),
  pdfFieldName: z.string(),
});

export const FieldMapEntryCoordinatesSchema = z.object({
  type: z.literal("coordinates"),
  page: z.number().int().min(0),
  x: z.number(),
  y: z.number(),
  size: z.number().optional(),
  font: z.string().optional(),
});

export const FieldMapEntrySchema = z.union([
  FieldMapEntryAcroFormSchema,
  FieldMapEntryCoordinatesSchema,
]);

export const FormTemplateSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  pdfAssetPath: z.string(),
  /** Maps IntakeState field name → PDF field location. Signature line is absent by design. */
  fieldMap: z.record(z.string(), FieldMapEntrySchema),
  supportedByProduct: z.boolean(),
});

export type FieldMapEntryAcroForm = z.infer<typeof FieldMapEntryAcroFormSchema>;
export type FieldMapEntryCoordinates = z.infer<typeof FieldMapEntryCoordinatesSchema>;
export type FieldMapEntry = z.infer<typeof FieldMapEntrySchema>;
export type FormTemplate = z.infer<typeof FormTemplateSchema>;
