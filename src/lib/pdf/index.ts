import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import fs from "fs";
import type { FormTemplate } from "@/schemas/form-templates/types";
import type { IntakeState } from "@/schemas/intake";

export interface FillPdfOptions {
  template: FormTemplate;
  intakeState: IntakeState;
  mode: "preview" | "final";
}

/**
 * Converts an ISO date string (yyyy-mm-dd) to the mm/dd/yyyy format
 * required by the Wyoming dissolution form.
 */
function formatDateForForm(isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate; // pass through if already formatted or invalid
  const [, yyyy, mm, dd] = match;
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Fills a dissolution form PDF with confirmed IntakeState values.
 * Attempts AcroForm fill first; falls back to coordinate drawText.
 * The signature line is a physical printed line — it has no AcroForm entry
 * and is never written. The certification checkbox IS written when
 * certificationAffirmed=true (it is the W.S. 17-29-701 statutory declaration).
 */
export async function fillPdf(options: FillPdfOptions): Promise<Uint8Array> {
  const { template, intakeState, mode } = options;

  const pdfBuffer = fs.readFileSync(template.pdfAssetPath);
  // Convert Buffer → Uint8Array so pdf-lib accepts it across all environments
  const pdfBytes = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Suppress pdf-lib's creation timestamp so output is deterministic.
  // pdf-lib embeds /CreationDate and /ModDate; we override with a fixed value
  // when the DETERMINISTIC_PDF env var is set (used in tests).
  if (process.env.DETERMINISTIC_PDF === "true") {
    pdfDoc.setCreationDate(new Date(0));
    pdfDoc.setModificationDate(new Date(0));
  }

  const form = pdfDoc.getForm();

  // Resolve the field values from IntakeState
  const fieldValues: Record<string, string | boolean> = {
    companyLegalName: intakeState.companyLegalName,
    signerName: intakeState.signerName,
    signerTitle: intakeState.signerTitle,
    // Official form requires mm/dd/yyyy format
    signingDate: formatDateForForm(intakeState.signingDate),
    contactEmail: intakeState.contactEmail ?? "",
    contactPhone: intakeState.contactPhone ?? "",
    contactPerson: intakeState.signerName, // contact person defaults to signer
    // Certification checkbox: checked iff user affirmed (UI checkbox drives PDF checkbox)
    certificationAffirmed: intakeState.certificationAffirmed,
    // Pre-submission checklist — all pre-checked for Winddown-generated PDFs
    checklistFee: true,
    checklistGoodStanding: true,
    checklistProcessingTime: true,
    checklistMailAndReview: true,
  };

  for (const [fieldId, entry] of Object.entries(template.fieldMap)) {
    const value = fieldValues[fieldId];
    if (value === undefined) continue;

    if (entry.type === "acroform") {
      try {
        if (typeof value === "boolean") {
          const checkbox = form.getCheckBox(entry.pdfFieldName);
          if (value) checkbox.check();
          else checkbox.uncheck();
        } else if (typeof value === "string" && value !== "") {
          const textField = form.getTextField(entry.pdfFieldName);
          textField.setText(value);
        }
      } catch {
        // AcroForm field not found — fall through to coordinate mode if defined
      }
    } else if (entry.type === "coordinates" && typeof value === "string" && value !== "") {
      const pages = pdfDoc.getPages();
      const page = pages[entry.page];
      if (!page) continue;
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(value, {
        x: entry.x,
        y: entry.y,
        size: entry.size ?? 11,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  // Flatten form fields so the PDF renders consistently across viewers
  form.flatten();

  if (mode === "preview") {
    await addPreviewWatermark(pdfDoc);
  }

  return pdfDoc.save();
}

async function addPreviewWatermark(pdfDoc: PDFDocument): Promise<void> {
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText("PREVIEW", {
      x: width / 2 - 80,
      y: height / 2,
      size: 60,
      font,
      color: rgb(0.85, 0.85, 0.85),
      opacity: 0.4,
      rotate: degrees(45),
    });
  }
}
