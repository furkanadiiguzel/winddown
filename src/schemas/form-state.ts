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

  // Corp-directors specific
  dateOfIncorporation: z.string(),
  sharesIssuedOption: z.enum(["no-shares-issued", "not-commenced", ""]),
  authorizationOption: z.enum(["incorporators", "initial-directors", ""]),

  // Corp-shareholders specific
  dateAuthorizationGranted: z.string(),

  // Drawn signature (PNG data URL)
  signatureDataUrl: z.string().nullable(),

  // Authorization
  authorizationAffirmed: z.boolean(),

  // Snapshot-bound confirmation flags — both reset to false on any field mutation
  certificationAffirmed: z.boolean(),
  userConfirmedReview: z.boolean(),

  manualEntryMode: z.boolean(),

  // Populated after a successful /api/analyze call
  pagesAnalyzed: z.array(z.string()),
  failureReason: z.object({ errorClass: z.string(), message: z.string() }).nullable(),
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
  dateOfIncorporation: "",
  sharesIssuedOption: "" as const,
  authorizationOption: "" as const,
  dateAuthorizationGranted: "",
  signatureDataUrl: null,
  authorizationAffirmed: false,
  certificationAffirmed: false,
  userConfirmedReview: false,
  manualEntryMode: false,
  pagesAnalyzed: [],
  failureReason: null,
};
