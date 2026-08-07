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
 * Fills a dissolution form PDF with confirmed IntakeState values.
 * Attempts AcroForm fill first; falls back to coordinate drawText.
 * Signature line ("Certification check box") is structurally absent from
 * the fieldMap and is never written.
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
    signingDate: intakeState.signingDate,
    contactEmail: intakeState.contactEmail ?? "",
    contactPhone: intakeState.contactPhone ?? "",
    contactPerson: intakeState.signerName, // contact person defaults to signer
    dissolutionReason: true, // voluntary dissolution checkbox
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
