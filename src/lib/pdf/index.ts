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
 * Normalize a string to WinAnsi-safe characters for pdf-lib standard fonts.
 * NFD decomposition strips most combining diacritics; remaining edge cases
 * (ı, ł, ð, ø, etc.) are mapped explicitly.
 */
function toWinAnsi(text: string): string {
  const REPLACEMENTS: Record<string, string> = {
    ı: "i", İ: "I", // Turkish dotless i / dotted I
    ğ: "g", Ğ: "G", // Turkish g-breve
    ş: "s", Ş: "S", // Turkish s-cedilla
    ł: "l", Ł: "L", // Polish l-stroke
    ð: "d", Ð: "D", // Eth
    þ: "th", Þ: "Th", // Thorn
    ø: "o", Ø: "O", // O-stroke
    æ: "ae", Æ: "AE",
    œ: "oe", Œ: "OE",
    ß: "ss",
  };
  // First pass: explicit replacements
  let s = text.replace(/[ıİğĞşŞłŁðÐþÞøØæÆœŒß]/g, (ch) => REPLACEMENTS[ch] ?? ch);
  // Second pass: NFD decomposition strips combining diacritical marks (é → e, ü → u, etc.)
  // ü, ö, ç, etc. ARE in WinAnsi, but decompose safely as a fallback
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Third pass: drop anything still outside printable ASCII + Latin-1 Supplement (0x20–0xFF)
  s = s.replace(/[^\x20-\xFF]/g, "?");
  return s;
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
    signingDate: formatDateForForm(intakeState.signingDate),
    contactEmail: intakeState.contactEmail ?? "",
    contactPhone: intakeState.contactPhone ?? "",
    contactPerson: intakeState.signerName,

    // LLC-specific
    certificationAffirmed: intakeState.certificationAffirmed,

    // Corp-directors specific
    dateOfIncorporation: intakeState.dateOfIncorporation
      ? formatDateForForm(intakeState.dateOfIncorporation)
      : "",
    noSharesIssued:           intakeState.sharesIssuedOption === "no-shares-issued",
    businessNotCommenced:     intakeState.sharesIssuedOption === "not-commenced",
    incorporatorsAuthorized:  intakeState.authorizationOption === "incorporators",
    initialDirectorsAuthorized: intakeState.authorizationOption === "initial-directors",

    // Corp-shareholders specific
    dateAuthorizationGranted: intakeState.dateAuthorizationGranted
      ? formatDateForForm(intakeState.dateAuthorizationGranted)
      : "",
    approvedByShareholders: true, // always checked — this is the shareholders form

    // Pre-submission informational checkboxes — always checked
    checklistFee: true,
    checklistGoodStanding: true,
    checklistProcessingTime: true,
    checklistMailAndReview: true,
    checklistMail: true,
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
          textField.setText(toWinAnsi(value));
        }
      } catch {
        // AcroForm field not found — fall through to coordinate mode if defined
      }
    } else if (entry.type === "coordinates" && typeof value === "string" && value !== "") {
      const pages = pdfDoc.getPages();
      const page = pages[entry.page];
      if (!page) continue;
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(toWinAnsi(value), {
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
