import type { FormTemplate } from "./types";
import path from "path";

// AcroForm field names discovered from wyoming-llc-dissolution.pdf:
//   "Name of LLC", "Certification check box", "Date signed",
//   "Printed Name", "Title", "Contact Person",
//   "Daytime Phone Number", "Email",
//   "Check Box1.0", "Check Box1.1", "Check Box1.2", "Check Box1.3"
//
// "Certification check box" = the W.S. 17-29-701 statutory declaration checkbox.
// The system checks it when certificationAffirmed=true (user ticked the UI checkbox).
// This is NOT the signature line — the signature line is a physical printed line on the
// form where the human signs in ink. The signature line has no AcroForm field entry.
// The four "Check Box1.x" fields are dissolution-reason checkboxes; Check Box1.0 = voluntary.

export const wyomingLlcTemplate: FormTemplate = {
  id: "wyoming-llc-dissolution",
  entityType: "wyoming-llc",
  pdfAssetPath: path.join(process.cwd(), "src/assets/forms/wyoming-llc-dissolution.pdf"),
  supportedByProduct: true,
  fieldMap: {
    companyLegalName: { type: "acroform", pdfFieldName: "Name of LLC" },
    // signingDate value is pre-formatted to mm/dd/yyyy by the fill service
    signingDate: { type: "acroform", pdfFieldName: "Date signed" },
    signerName: { type: "acroform", pdfFieldName: "Printed Name" },
    signerTitle: { type: "acroform", pdfFieldName: "Title" },
    contactPerson: { type: "acroform", pdfFieldName: "Contact Person" },
    contactPhone: { type: "acroform", pdfFieldName: "Daytime Phone Number" },
    contactEmail: { type: "acroform", pdfFieldName: "Email" },
    // Statutory certification declaration — checked iff certificationAffirmed=true
    certificationAffirmed: { type: "acroform", pdfFieldName: "Certification check box" },
    // Dissolution reason: voluntary dissolution
    dissolutionReason: { type: "acroform", pdfFieldName: "Check Box1.0" },
  },
};
