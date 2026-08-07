import type { FormTemplate } from "./types";
import path from "path";

// AcroForm field inventory for wyoming-llc-dissolution.pdf (LLC-ArticlesDissolution, revised June 2021).
// Field names are the exact strings returned by pdf-lib; verified visually against the printed form.
//
// Text fields:
//   "Name of LLC"          — item 1: company name, must match SOS records exactly
//   "Date signed"          — below signature line; form label reads "(mm/dd/yyyy)"
//   "Printed Name"         — signer's printed name below signature line
//   "Title"                — signer's title (Member / Manager / etc.)
//   "Contact Person"       — contact person name (right of Printed Name)
//   "Daytime Phone Number" — contact phone
//   "Email"                — contact email; form notes "An email address is required"
//
// Checkboxes:
//   "Certification check box" — item 2: W.S. 17-29-701 statutory declaration.
//                               On-form label: "I hereby certify that I am in compliance
//                               with W.S. 17-29-701 and I have met all requirements for
//                               dissolution and winding up…". Checked by the system when
//                               certificationAffirmed=true. NOT the signature line — the
//                               signature line is a physical printed blank ("Signature: ___")
//                               where the human signs in ink; it has no AcroForm entry.
//
//   "Check Box1.0" — Checklist row 1: "Filing Fee: $60.00 — make check or money order
//                    payable to Wyoming Secretary of State."
//   "Check Box1.1" — Checklist row 2: "The business entity is active and in good standing
//                    with this office."
//   "Check Box1.2" — Checklist row 3: "Processing time is up to 15 business days following
//                    the date of receipt in our office."
//   "Check Box1.3" — Checklist rows 4–5 (two widget appearances, one field):
//                    "Please mail with payment to the address at the top of this form.
//                     This form cannot be accepted via email." /
//                    "Please review the form prior to submission. The Secretary of State's
//                     Office is unable to process incomplete forms."
//
// The four Check Box1.x fields form a pre-submission checklist. The fill service pre-checks
// all four because a Winddown-generated PDF is by definition reviewed and prepared for mailing.

export const wyomingLlcTemplate: FormTemplate = {
  id: "wyoming-llc-dissolution",
  entityType: "wyoming-llc",
  pdfAssetPath: path.join(process.cwd(), "src/assets/forms/wyoming-llc-dissolution.pdf"),
  supportedByProduct: true,
  fieldMap: {
    companyLegalName: { type: "acroform", pdfFieldName: "Name of LLC" },
    // Pre-formatted to mm/dd/yyyy by the fill service (form label specifies this format)
    signingDate: { type: "acroform", pdfFieldName: "Date signed" },
    signerName: { type: "acroform", pdfFieldName: "Printed Name" },
    signerTitle: { type: "acroform", pdfFieldName: "Title" },
    contactPerson: { type: "acroform", pdfFieldName: "Contact Person" },
    contactPhone: { type: "acroform", pdfFieldName: "Daytime Phone Number" },
    contactEmail: { type: "acroform", pdfFieldName: "Email" },
    // W.S. 17-29-701 statutory declaration — checked iff certificationAffirmed=true
    certificationAffirmed: { type: "acroform", pdfFieldName: "Certification check box" },
    // Pre-submission checklist — all pre-checked for Winddown-generated PDFs
    checklistFee: { type: "acroform", pdfFieldName: "Check Box1.0" },
    checklistGoodStanding: { type: "acroform", pdfFieldName: "Check Box1.1" },
    checklistProcessingTime: { type: "acroform", pdfFieldName: "Check Box1.2" },
    checklistMailAndReview: { type: "acroform", pdfFieldName: "Check Box1.3" },
  },
};
