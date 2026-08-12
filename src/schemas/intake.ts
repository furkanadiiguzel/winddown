import { z } from "zod";

export const IntakeStateSchema = z
  .object({
    mode: z.enum(["preview", "final"]),
    certificationAffirmed: z.boolean(),
    userConfirmedReview: z.boolean(),

    // Form fields
    companyLegalName: z.string().min(1, "Company legal name is required"),
    entityType: z.string().min(1, "Entity type is required"),
    stateOfFormation: z.string().optional(),
    contactEmail: z.string().email().optional().or(z.literal("")),
    contactPhone: z.string().optional(),
    physicalAddress: z.string().optional(),
    signerName: z.string().min(1, "Signer name is required"),
    signerTitle: z.string().min(1, "Signer title is required"),
    signingDate: z.string().min(1, "Signing date is required"),

    // Corp-directors specific
    dateOfIncorporation: z.string().optional(),
    sharesIssuedOption: z.enum(["no-shares-issued", "not-commenced", ""]).optional(),
    authorizationOption: z.enum(["incorporators", "initial-directors", ""]).optional(),

    // Corp-shareholders specific
    dateAuthorizationGranted: z.string().optional(),

    // Drawn signature PNG data URL
    signatureDataUrl: z.string().nullable().optional(),

    fieldProvenances: z.record(z.string(), z.enum(["extracted", "manual"])).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "final") {
      if (!data.certificationAffirmed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["certificationAffirmed"],
          message: "Certification must be affirmed before generating the final document.",
        });
      }
      if (!data.userConfirmedReview) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["userConfirmedReview"],
          message: "Review confirmation must be affirmed before generating the final document.",
        });
      }
      if (data.entityType === "wyoming-corp-directors") {
        if (!data.sharesIssuedOption) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sharesIssuedOption"], message: "Select one: no shares issued or business not commenced." });
        }
        if (!data.authorizationOption) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["authorizationOption"], message: "Select one: incorporators or initial directors authorized." });
        }
      }
    }
  });

export type IntakeState = z.infer<typeof IntakeStateSchema>;
