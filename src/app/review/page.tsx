"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "@/lib/form-state";
import { STUB_EXTRACTION_RESULT } from "@/lib/stubs/extraction-result";
import { FieldCard } from "@/components/FieldCard";
import { CertificationStep } from "@/components/CertificationStep";
import { PdfPreview } from "@/components/PdfPreview";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExtractionResult, ExtractedField, AbsentField } from "@/schemas/extraction";
import type { IntakeState } from "@/schemas/intake";
import { isAbsent, isLowConfidenceLocked } from "@/lib/confidence-gate";

// Section IDs for scroll/step tracking
type Section = "review" | "gaps" | "certification" | "preview";

const REQUIRED_FIELDS: Array<keyof Pick<IntakeState, "companyLegalName" | "entityType" | "signerName" | "signerTitle" | "signingDate">> = [
  "companyLegalName",
  "entityType",
  "signerName",
  "signerTitle",
  "signingDate",
];

function getExtractedValue(
  fields: ExtractionResult["fields"],
  fieldId: string
): string {
  const f = fields[fieldId];
  if (!f || isAbsent(f)) return "";
  return f.value;
}

export default function ReviewPage() {
  const router = useRouter();
  const store = useFormState();

  // Load stub data if in stub mode
  const extractionResult: ExtractionResult =
    process.env.NEXT_PUBLIC_STUB === "true" ? STUB_EXTRACTION_RESULT : { fields: {}, pagesAnalyzed: [], analysisMode: "extraction" };

  // Current section
  const [currentSection, setCurrentSection] = useState<Section>("review");

  // Validation errors for completeness gate
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Derived values from extraction + store overrides
  const companyLegalNameField = extractionResult.fields["companyLegalName"];
  const companyLegalName =
    store.extractedFields["companyLegalName"] !== undefined
      ? (store.extractedFields["companyLegalName"] as ExtractedField).value ?? ""
      : getExtractedValue(extractionResult.fields, "companyLegalName");

  // Check low-confidence gate for companyLegalName (T027 / FR-009a)
  const lowConfidenceLocked = isLowConfidenceLocked(
    companyLegalNameField,
    store.extractedFields["companyLegalName"] as ExtractedField | undefined
  );

  // Build current intake state from store + extraction
  const buildIntakeState = useCallback(
    (mode: "preview" | "final"): IntakeState => ({
      mode,
      certificationAffirmed: store.certificationAffirmed,
      userConfirmedReview: store.userConfirmedReview,
      companyLegalName: companyLegalName || getExtractedValue(extractionResult.fields, "companyLegalName"),
      entityType: store.entityType || "wyoming-llc",
      stateOfFormation: "Wyoming",
      contactEmail: getExtractedValue(extractionResult.fields, "contactEmail") || undefined,
      contactPhone: getExtractedValue(extractionResult.fields, "contactPhone") || undefined,
      physicalAddress: getExtractedValue(extractionResult.fields, "physicalAddress") || undefined,
      signerName: store.signerName,
      signerTitle: store.signerTitle,
      signingDate: store.signingDate,
    }),
    [store, extractionResult.fields, companyLegalName]
  );

  // Preview intake state (for PdfPreview)
  const previewIntakeState = useMemo(
    () => buildIntakeState("preview"),
    [buildIntakeState]
  );

  // --- Completeness gate (T028) ---
  const checkCompleteness = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    // Derive current values
    const values: Record<string, string> = {
      companyLegalName,
      entityType: store.entityType || "wyoming-llc",
      signerName: store.signerName,
      signerTitle: store.signerTitle,
      signingDate: store.signingDate,
    };

    for (const field of REQUIRED_FIELDS) {
      if (!values[field] || values[field].trim() === "") {
        errors[field] = `${fieldLabel(field)} is required`;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [companyLegalName, store.entityType, store.signerName, store.signerTitle, store.signingDate]);

  function fieldLabel(field: string): string {
    const labels: Record<string, string> = {
      companyLegalName: "Company legal name",
      entityType: "Entity type",
      signerName: "Signer name",
      signerTitle: "Signer title",
      signingDate: "Signing date",
    };
    return labels[field] ?? field;
  }

  const handleContinueToGaps = () => {
    if (lowConfidenceLocked) return;
    if (!checkCompleteness()) return;
    setCurrentSection("gaps");
  };

  const handleContinueToCertification = () => {
    if (!checkCompleteness()) return;
    setCurrentSection("certification");
  };

  const handleCertificationContinue = () => {
    setCurrentSection("preview");
  };

  // --- Final download (T031) ---
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!store.userConfirmedReview) return;
    setDownloading(true);
    setDownloadError(null);

    try {
      const intakeState = buildIntakeState("final");
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeState }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "PDF generation failed." }));
        setDownloadError((err as { message?: string }).message ?? "PDF generation failed.");
        setDownloading(false);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const companySlug = (companyLegalName || "dissolution")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "-")
        .replace(/ /g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      a.href = url;
      a.download = `${companySlug}-articles-of-dissolution.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      router.push("/done");
    } catch {
      setDownloadError("Download failed. Please try again.");
      setDownloading(false);
    }
  };

  // Field card helpers
  const renderExtractedField = (
    fieldId: string,
    label: string,
    fallbackField?: ExtractedField | AbsentField
  ) => {
    const storeField = store.extractedFields[fieldId];
    const resultField = extractionResult.fields[fieldId] ?? fallbackField;
    const field: ExtractedField | AbsentField = storeField ?? resultField ?? {
      fieldId,
      status: "absent" as const,
    };

    const isCompanyName = fieldId === "companyLegalName";

    return (
      <div key={fieldId}>
        <FieldCard
          field={field}
          label={label}
          onEdit={(value) => {
            store.setFieldValue(fieldId, value);
            // Also update store's extractedFields
            const updatedField: ExtractedField = {
              fieldId,
              value,
              confidence: "manual" in field ? (field as ExtractedField).confidence ?? "high" : "high",
              evidence: "evidence" in field ? (field as ExtractedField).evidence : value,
              sourceUrl: "sourceUrl" in field ? (field as ExtractedField).sourceUrl : "https://winddown.app",
              provenance: "manual",
              userOverridden: true,
            };
            useFormState.setState((s) => ({
              extractedFields: { ...s.extractedFields, [fieldId]: updatedField },
              certificationAffirmed: false,
              userConfirmedReview: false,
            }));
          }}
          showConfirmAffordance={isCompanyName && lowConfidenceLocked}
          onConfirm={
            isCompanyName
              ? () => {
                  if (companyLegalNameField && !isAbsent(companyLegalNameField)) {
                    const confirmed: ExtractedField = {
                      ...(companyLegalNameField as ExtractedField),
                      userOverridden: true,
                    };
                    useFormState.setState((s) => ({
                      extractedFields: { ...s.extractedFields, companyLegalName: confirmed },
                    }));
                  }
                }
              : undefined
          }
        />
        {validationErrors[fieldId] && (
          <p className="mt-1 text-xs text-red-600">{validationErrors[fieldId]}</p>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Review your dissolution form</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Check that all information is correct before certifying and downloading.
          </p>
        </div>

        {/* ── Section 1: Extraction Review Board ── */}
        <section aria-labelledby="review-heading">
          <Card>
            <CardHeader>
              <CardTitle id="review-heading">Step 1 — Extracted information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderExtractedField("companyLegalName", "Company legal name")}
              {renderExtractedField("contactEmail", "Contact email")}
              <LegalDisclaimer />
            </CardContent>
          </Card>

          {currentSection === "review" && (
            <div className="mt-4 space-y-2">
              {lowConfidenceLocked && (
                <p className="text-sm text-amber-700">
                  The company name has low confidence. Please confirm it is correct before continuing.
                </p>
              )}
              {Object.keys(validationErrors).length > 0 && (
                <p className="text-sm text-red-600">
                  Please fill in all required fields before continuing.
                </p>
              )}
              <Button
                onClick={handleContinueToGaps}
                disabled={lowConfidenceLocked}
                className="w-full"
              >
                Continue to Gap Completion
              </Button>
            </div>
          )}
        </section>

        {/* ── Section 2: Gap Completion ── */}
        {(currentSection === "gaps" ||
          currentSection === "certification" ||
          currentSection === "preview") && (
          <section aria-labelledby="gaps-heading">
            <Card>
              <CardHeader>
                <CardTitle id="gaps-heading">Step 2 — Complete missing information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signerName">Signer name *</Label>
                  <Input
                    id="signerName"
                    value={store.signerName}
                    onChange={(e) => store.setFieldValue("signerName", e.target.value)}
                    placeholder="Full legal name of authorized signer"
                  />
                  {validationErrors.signerName && (
                    <p className="text-xs text-red-600">{validationErrors.signerName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signerTitle">Signer title *</Label>
                  <Input
                    id="signerTitle"
                    value={store.signerTitle}
                    onChange={(e) => store.setFieldValue("signerTitle", e.target.value)}
                    placeholder="e.g. Member, Manager, President"
                  />
                  {validationErrors.signerTitle && (
                    <p className="text-xs text-red-600">{validationErrors.signerTitle}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signingDate">Signing date *</Label>
                  <Input
                    id="signingDate"
                    type="date"
                    value={store.signingDate}
                    onChange={(e) => store.setFieldValue("signingDate", e.target.value)}
                  />
                  {validationErrors.signingDate && (
                    <p className="text-xs text-red-600">{validationErrors.signingDate}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entityType">Entity type</Label>
                  <Input
                    id="entityType"
                    value={store.entityType || "wyoming-llc"}
                    onChange={(e) => store.setFieldValue("entityType", e.target.value)}
                    placeholder="wyoming-llc"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="stateConfirmed"
                    checked={store.stateConfirmedWyoming}
                    onCheckedChange={(checked) =>
                      useFormState.setState({ stateConfirmedWyoming: checked === true })
                    }
                  />
                  <Label htmlFor="stateConfirmed" className="text-sm">
                    I confirm this is a Wyoming-formed entity
                  </Label>
                </div>
              </CardContent>
            </Card>

            {currentSection === "gaps" && (
              <div className="mt-4">
                <Button
                  onClick={handleContinueToCertification}
                  className="w-full"
                >
                  Continue to Certification
                </Button>
              </div>
            )}
          </section>
        )}

        {/* ── Section 3: Certification ── */}
        {(currentSection === "certification" || currentSection === "preview") && (
          <section aria-labelledby="certification-heading">
            <CertificationStep
              affirmed={store.certificationAffirmed}
              onAffirm={(v) => useFormState.setState({ certificationAffirmed: v })}
              onContinue={handleCertificationContinue}
            />
          </section>
        )}

        {/* ── Section 4: PDF Preview + Final Confirmation + Download ── */}
        {currentSection === "preview" && (
          <section aria-labelledby="preview-heading">
            <Card>
              <CardHeader>
                <CardTitle id="preview-heading">Step 4 — Preview &amp; Download</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <PdfPreview intakeState={previewIntakeState} />

                <div className="rounded-md border border-zinc-200 p-4 space-y-3">
                  <p className="text-sm font-medium text-zinc-700">Final confirmation</p>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="userConfirmedReview"
                      checked={store.userConfirmedReview}
                      onCheckedChange={(checked) =>
                        useFormState.setState({
                          userConfirmedReview: checked === true,
                        })
                      }
                      aria-label="I have reviewed all information and it is accurate"
                    />
                    <Label htmlFor="userConfirmedReview" className="text-sm text-zinc-700 cursor-pointer">
                      I have reviewed all information in this form and confirm it is accurate.
                      I understand this document will be submitted to the Wyoming Secretary of State.
                    </Label>
                  </div>

                  {downloadError && (
                    <p className="text-sm text-red-600">{downloadError}</p>
                  )}

                  <Button
                    onClick={handleDownload}
                    disabled={!store.userConfirmedReview || downloading}
                    className="w-full"
                  >
                    {downloading ? "Generating…" : "Download Articles of Dissolution"}
                  </Button>
                </div>

                <LegalDisclaimer />
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
