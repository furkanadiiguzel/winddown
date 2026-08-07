import { z } from "zod";
import { ExtractedFieldSchema, AbsentFieldSchema } from "./extraction";

export const FlowStepSchema = z.enum([
  "landing",
  "analyzing",
  "review",
  "certification",
  "preview",
  "done",
]);

export const FormStateSchema = z.object({
  flowStep: FlowStepSchema,
  analysisMode: z.enum(["extraction", "manual-fallback", "manual-entry"]).nullable(),

  // Extracted fields keyed by fieldId
  extractedFields: z.record(
    z.string(),
    z.union([ExtractedFieldSchema, AbsentFieldSchema])
  ),

  // Gap-completion fields
  signerName: z.string(),
  signerTitle: z.string(),
  signingDate: z.string(),
  stateConfirmedWyoming: z.boolean(),
  entityType: z.string(),

  // Authorization
  authorizationAffirmed: z.boolean(),

  // Snapshot-bound confirmation flags — both reset to false on any field mutation
  certificationAffirmed: z.boolean(),
  userConfirmedReview: z.boolean(),

  manualEntryMode: z.boolean(),
});

export type FlowStep = z.infer<typeof FlowStepSchema>;
export type FormState = z.infer<typeof FormStateSchema>;

export const initialFormState: FormState = {
  flowStep: "landing",
  analysisMode: null,
  extractedFields: {},
  signerName: "",
  signerTitle: "",
  signingDate: "",
  stateConfirmedWyoming: false,
  entityType: "",
  authorizationAffirmed: false,
  certificationAffirmed: false,
  userConfirmedReview: false,
  manualEntryMode: false,
};
