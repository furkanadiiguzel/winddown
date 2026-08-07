import type { FormTemplate } from "./types";
import path from "path";

// AcroForm field names discovered from wyoming-llc-dissolution.pdf:
//   "Name of LLC", "Certification check box", "Date signed",
//   "Printed Name", "Title", "Contact Person",
//   "Daytime Phone Number", "Email",
//   "Check Box1.0", "Check Box1.1", "Check Box1.2", "Check Box1.3"
//
// "Certification check box" is structurally absent from fieldMap — it must
// be signed by the human in ink; no code path may write to it.
// The four "Check Box" fields are the entity-type checkboxes (LLC dissolution
// reason codes); we default to the first one (voluntary dissolution).

export const wyomingLlcTemplate: FormTemplate = {
  id: "wyoming-llc-dissolution",
  entityType: "wyoming-llc",
  pdfAssetPath: path.join(process.cwd(), "src/assets/forms/wyoming-llc-dissolution.pdf"),
  supportedByProduct: true,
  fieldMap: {
    companyLegalName: { type: "acroform", pdfFieldName: "Name of LLC" },
    signingDate: { type: "acroform", pdfFieldName: "Date signed" },
    signerName: { type: "acroform", pdfFieldName: "Printed Name" },
    signerTitle: { type: "acroform", pdfFieldName: "Title" },
    contactPerson: { type: "acroform", pdfFieldName: "Contact Person" },
    contactPhone: { type: "acroform", pdfFieldName: "Daytime Phone Number" },
    contactEmail: { type: "acroform", pdfFieldName: "Email" },
    // Dissolution reason: voluntary (Check Box1.0 = voluntary dissolution)
    dissolutionReason: { type: "acroform", pdfFieldName: "Check Box1.0" },
    // "Certification check box" is intentionally absent — signature is ink-only
  },
};
