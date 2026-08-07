/**
 * T070 — prepare_dissolution MCP tool.
 *
 * Accepts an IntakeState and generates a preview PDF (mode=preview hardcoded).
 * Final mode (mode=final) is NOT exposed via MCP — certification must be human-only.
 * certificationAffirmed is structurally absent from the input schema.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fillPdf } from "@/lib/pdf/index.js";
import { getTemplate } from "@/lib/pdf/form-template-registry.js";

// Preview-only intake schema: mode/certificationAffirmed/userConfirmedReview excluded
// (structurally absent — cannot be passed by the MCP caller)
const PreviewIntakeSchema = z.object({
  companyLegalName: z.string().min(1, "Company legal name is required"),
  entityType: z.string().min(1, "Entity type is required").default("wyoming-llc"),
  stateOfFormation: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  physicalAddress: z.string().optional(),
  signerName: z.string().min(1, "Signer name is required"),
  signerTitle: z.string().min(1, "Signer title is required"),
  signingDate: z.string().min(1, "Signing date is required"),
  fieldProvenances: z.record(z.string(), z.enum(["extracted", "manual"])).optional(),
});

export function registerPrepareDissoluation(server: McpServer) {
  server.registerTool(
    "prepare_dissolution",
    {
      title: "Prepare Dissolution PDF (Preview)",
      description:
        "Generates a preview-mode Wyoming Articles of Dissolution PDF from the provided intake state. " +
        "Returns base64-encoded PDF bytes for human review. " +
        "NOTE: This tool generates a PREVIEW only (watermarked 'PREVIEW'). " +
        "Final filing requires the authorised signatory to: " +
        "(1) review the document carefully, (2) sign in ink, and (3) mail to the Wyoming Secretary of State. " +
        "certificationAffirmed is NOT a tool parameter — certification must be completed by a human. " +
        "This tool cannot file or certify on behalf of the user.",
      inputSchema: {
        intakeState: PreviewIntakeSchema.describe(
          "Company and signer details for the dissolution form. mode and certificationAffirmed are excluded — this tool always generates a preview."
        ),
      },
    },
    async ({ intakeState }) => {
      const fullIntake = {
        ...intakeState,
        mode: "preview" as const,
        certificationAffirmed: false, // structurally excluded from input; hardcoded safe value
        userConfirmedReview: false,
      };

      const template = getTemplate(intakeState.entityType ?? "wyoming-llc");
      if (!template) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "unsupported_entity_type",
                message: `Entity type '${intakeState.entityType}' is not yet supported.`,
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const pdfBytes = await fillPdf({ template, intakeState: fullIntake, mode: "preview" });
        const base64 = Buffer.from(pdfBytes).toString("base64");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                pdfBase64: base64,
                mimeType: "application/pdf",
                fields: Object.keys(intakeState).filter(
                  (k) => !!(intakeState as Record<string, unknown>)[k]
                ),
                note:
                  "This is a PREVIEW only. To file: print, sign in ink, and mail to the Wyoming Secretary of State. Do not skip the certification step — it must be completed by an authorised signatory.",
              }),
            },
          ],
        };
      } catch (err: unknown) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "pdf_generation_failed",
                message: err instanceof Error ? err.message : "Unknown error",
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
