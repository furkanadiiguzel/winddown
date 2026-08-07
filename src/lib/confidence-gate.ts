import type { ExtractedField, AbsentField } from "@/schemas/extraction";

export function isAbsent(field: ExtractedField | AbsentField): field is AbsentField {
  return "status" in field;
}

/**
 * Returns true when the companyLegalName confidence gate is locked — i.e.,
 * the field is present, confidence is low, and the user has not yet
 * acknowledged it (via edit or explicit "This is correct" tap).
 *
 * FR-009a: this gate applies ONLY to companyLegalName. Absent fields are
 * handled by the separate completeness gate (FR-009b) and must not reach here.
 */
export function isLowConfidenceLocked(
  field: ExtractedField | AbsentField | undefined,
  storeOverride: ExtractedField | undefined
): boolean {
  if (!field || isAbsent(field)) return false;
  if (field.confidence !== "low") return false;
  return !field.userOverridden && !storeOverride?.userOverridden;
}
