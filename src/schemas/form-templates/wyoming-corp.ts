import type { FormTemplate } from "./types";
import path from "path";

// Directors & Incorporators variant (wyoming-corp-dissolution-directors.pdf)
export const wyomingCorpDirectorsTemplate: FormTemplate = {
  id: "wyoming-corp-directors-dissolution",
  entityType: "wyoming-corp-directors",
  pdfAssetPath: path.join(process.cwd(), "src/assets/forms/wyoming-corp-dissolution-directors.pdf"),
  supportedByProduct: true,
  fieldMap: {
    companyLegalName:       { type: "acroform", pdfFieldName: "Corporation name" },
    dateOfIncorporation:    { type: "acroform", pdfFieldName: "Date of incorporation" },
    signingDate:            { type: "acroform", pdfFieldName: "Date signed" },
    signerName:             { type: "acroform", pdfFieldName: "Printed Name" },
    contactPerson:          { type: "acroform", pdfFieldName: "Contact Person" },
    signerTitle:            { type: "acroform", pdfFieldName: "Title" },
    contactPhone:           { type: "acroform", pdfFieldName: "Daytime Phone Number" },
    contactEmail:           { type: "acroform", pdfFieldName: "Email" },
    // Shares / commencement: exactly one is checked based on sharesIssuedOption
    noSharesIssued:         { type: "acroform", pdfFieldName: "No shares have been issued" },
    businessNotCommenced:   { type: "acroform", pdfFieldName: "Business has not commenced" },
    // Authorization: exactly one is checked based on authorizationOption
    incorporatorsAuthorized:   { type: "acroform", pdfFieldName: "A majority of the incorporators authorized" },
    initialDirectorsAuthorized: { type: "acroform", pdfFieldName: "A majority of the initial directors authorized" },
    // Pre-submission informational checkboxes — always checked
    checklistGoodStanding:    { type: "acroform", pdfFieldName: "good standing" },
    checklistProcessingTime:  { type: "acroform", pdfFieldName: "Processing" },
    checklistFee:             { type: "acroform", pdfFieldName: "Fee" },
    checklistMailAndReview:   { type: "acroform", pdfFieldName: "Review before submitting" },
    checklistMail:            { type: "acroform", pdfFieldName: "Mail" },
  },
};

// Shareholders variant (wyoming-corp-dissolution-shareholders.pdf)
export const wyomingCorpShareholdersTemplate: FormTemplate = {
  id: "wyoming-corp-shareholders-dissolution",
  entityType: "wyoming-corp-shareholders",
  pdfAssetPath: path.join(process.cwd(), "src/assets/forms/wyoming-corp-dissolution-shareholders.pdf"),
  supportedByProduct: true,
  fieldMap: {
    companyLegalName:          { type: "acroform", pdfFieldName: "Corporation Name" },
    dateAuthorizationGranted:  { type: "acroform", pdfFieldName: "Date dissolution was authorized" },
    signingDate:               { type: "acroform", pdfFieldName: "Date signed" },
    signerName:                { type: "acroform", pdfFieldName: "Printed Name" },
    contactPerson:             { type: "acroform", pdfFieldName: "Contact Person" },
    signerTitle:               { type: "acroform", pdfFieldName: "Title" },
    contactPhone:              { type: "acroform", pdfFieldName: "Daytime Phone Number" },
    contactEmail:              { type: "acroform", pdfFieldName: "Email" },
    // Always checked — this form type is the shareholders authorization form
    approvedByShareholders:    { type: "acroform", pdfFieldName: "approved by shareholders" },
    // Pre-submission informational checkboxes — always checked
    checklistGoodStanding:     { type: "acroform", pdfFieldName: "good standing" },
    checklistFee:              { type: "acroform", pdfFieldName: "Filing fee" },
    checklistProcessingTime:   { type: "acroform", pdfFieldName: "Processing" },
    checklistMailAndReview:    { type: "acroform", pdfFieldName: "Review before submitting" },
    checklistMail:             { type: "acroform", pdfFieldName: "Mail" },
  },
};
