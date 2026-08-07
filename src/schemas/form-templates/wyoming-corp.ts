import type { FormTemplate } from "./types";
import path from "path";

// AcroForm fields from wyoming-corp-dissolution-directors.pdf (incorporators/directors variant):
//   "Corporation name", "Date of incorporation", "Date signed", "Printed Name",
//   "Contact Person", "Title", "Daytime Phone Number", "Email"
//   Plus checkbox fields for authorization method and status items.
//
// This template is defined so the registry can route to it without a code change,
// but supportedByProduct=false — the unsupported-entity exit will fire for wyoming-corp
// until corporation support is explicitly enabled.
//
// "Certification check box" equivalent is intentionally absent from fieldMap.

export const wyomingCorpTemplate: FormTemplate = {
  id: "wyoming-corp-dissolution",
  entityType: "wyoming-corp",
  pdfAssetPath: path.join(process.cwd(), "src/assets/forms/wyoming-corp-dissolution-directors.pdf"),
  supportedByProduct: false,
  fieldMap: {
    companyLegalName: { type: "acroform", pdfFieldName: "Corporation name" },
    incorporationDate: { type: "acroform", pdfFieldName: "Date of incorporation" },
    signingDate: { type: "acroform", pdfFieldName: "Date signed" },
    signerName: { type: "acroform", pdfFieldName: "Printed Name" },
    contactPerson: { type: "acroform", pdfFieldName: "Contact Person" },
    signerTitle: { type: "acroform", pdfFieldName: "Title" },
    contactPhone: { type: "acroform", pdfFieldName: "Daytime Phone Number" },
    contactEmail: { type: "acroform", pdfFieldName: "Email" },
  },
};
