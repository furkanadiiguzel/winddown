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
    }
  });

export type IntakeState = z.infer<typeof IntakeStateSchema>;
