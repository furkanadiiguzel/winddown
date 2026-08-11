import type { FormTemplate } from "./types";
import path from "path";

// Directors & Shareholders variant (wyoming-corp-dissolution-directors.pdf)
export const wyomingCorpDirectorsTemplate: FormTemplate = {
  id: "wyoming-corp-directors-dissolution",
  entityType: "wyoming-corp-directors",
  pdfAssetPath: path.join(process.cwd(), "src/assets/forms/wyoming-corp-dissolution-directors.pdf"),
  supportedByProduct: true,
  fieldMap: {
    companyLegalName: { type: "acroform", pdfFieldName: "Corporation name" },
    signingDate: { type: "acroform", pdfFieldName: "Date signed" },
    signerName: { type: "acroform", pdfFieldName: "Printed Name" },
    contactPerson: { type: "acroform", pdfFieldName: "Contact Person" },
    signerTitle: { type: "acroform", pdfFieldName: "Title" },
    contactPhone: { type: "acroform", pdfFieldName: "Daytime Phone Number" },
    contactEmail: { type: "acroform", pdfFieldName: "Email" },
  },
};

// Incorporators / Initial Directors variant (wyoming-corp-dissolution-shareholders.pdf)
export const wyomingCorpShareholdersTemplate: FormTemplate = {
  id: "wyoming-corp-shareholders-dissolution",
  entityType: "wyoming-corp-shareholders",
  pdfAssetPath: path.join(process.cwd(), "src/assets/forms/wyoming-corp-dissolution-shareholders.pdf"),
  supportedByProduct: true,
  fieldMap: {
    companyLegalName: { type: "acroform", pdfFieldName: "Corporation name" },
    signingDate: { type: "acroform", pdfFieldName: "Date signed" },
    signerName: { type: "acroform", pdfFieldName: "Printed Name" },
    contactPerson: { type: "acroform", pdfFieldName: "Contact Person" },
    signerTitle: { type: "acroform", pdfFieldName: "Title" },
    contactPhone: { type: "acroform", pdfFieldName: "Daytime Phone Number" },
    contactEmail: { type: "acroform", pdfFieldName: "Email" },
  },
};
