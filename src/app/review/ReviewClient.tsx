"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormState } from "@/lib/form-state";
import { STUB_EXTRACTION_RESULT } from "@/lib/stubs/extraction-result";
import { FieldCard } from "@/components/FieldCard";
import { CertificationStep } from "@/components/CertificationStep";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import { SignaturePadModal } from "@/components/SignaturePadModal";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExtractionResult, ExtractedField, AbsentField } from "@/schemas/extraction";
import type { IntakeState } from "@/schemas/intake";
import { isAbsent, isLowConfidenceLocked } from "@/lib/confidence-gate";
import { StartOverLink } from "@/components/StartOverLink";
import { getSupportedTemplate } from "@/lib/pdf/form-template-registry";
import wyomingConfig from "@/config/wyoming";

// Section IDs for scroll/step tracking
type Section = "review" | "gaps" | "certification" | "preview";


function getExtractedValue(
  fields: ExtractionResult["fields"],
  fieldId: string
): string {
  const f = fields[fieldId];
  if (!f || isAbsent(f)) return "";
  return f.value;
}

export default function ReviewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useFormState();

  // manual=true → user-initiated manual entry from the landing page "Skip" link
  // distinct from analysisMode==='manual-fallback' (AI/scrape failure from /analyze)
  const isManualEntry = searchParams.get("manual") === "true";

  // Build ExtractionResult from store (populated by /analyze SSE), or stub in dev.
  // In manual-entry mode the fields object is empty by design.
  const extractionResult: ExtractionResult = isManualEntry
    ? { fields: {}, pagesAnalyzed: [], analysisMode: "extraction" }
    : process.env.NEXT_PUBLIC_STUB === "true"
    ? STUB_EXTRACTION_RESULT
    : {
        fields: store.extractedFields,
        pagesAnalyzed: store.pagesAnalyzed,
        // FormState.analysisMode includes "manual-entry" but ExtractionResult doesn't
        analysisMode: (store.analysisMode === "manual-fallback" ? "manual-fallback" : "extraction") as "extraction" | "manual-fallback",
        failureReason: store.failureReason ?? undefined,
      };

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
      // Corp-directors
      dateOfIncorporation: store.dateOfIncorporation || undefined,
      sharesIssuedOption: (store.sharesIssuedOption || undefined) as IntakeState["sharesIssuedOption"],
      authorizationOption: (store.authorizationOption || undefined) as IntakeState["authorizationOption"],
      // Corp-shareholders
      dateAuthorizationGranted: store.dateAuthorizationGranted || undefined,
      // Signature
      signatureDataUrl: store.signatureDataUrl ?? undefined,
    }),
    [store, extractionResult.fields, companyLegalName]
  );

  // T055 — unsupported entity type check
  const currentEntityType = store.entityType || "wyoming-llc";
  const isUnsupportedEntityType = !getSupportedTemplate(currentEntityType);

  // Preview intake state (for PdfPreview)
  const previewIntakeState = useMemo(
    () => buildIntakeState("preview"),
    [buildIntakeState]
  );

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

  // Step 1 gate: only company name must be present before going to gap completion
  const checkStep1 = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!companyLegalName || companyLegalName.trim() === "") {
      errors.companyLegalName = "Company legal name is required";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [companyLegalName]);

  // Step 2 gate: signer details + entity-specific fields
  const checkStep2 = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    const values: Record<string, string> = {
      signerName: store.signerName,
      signerTitle: store.signerTitle,
      signingDate: store.signingDate,
    };
    for (const [field, val] of Object.entries(values)) {
      if (!val || val.trim() === "") errors[field] = `${fieldLabel(field)} is required`;
    }
    if (currentEntityType === "wyoming-corp-directors") {
      if (!store.sharesIssuedOption) errors.sharesIssuedOption = "Select one option about shares / commencement";
      if (!store.authorizationOption) errors.authorizationOption = "Select who authorized the dissolution";
    }
    if (currentEntityType === "wyoming-corp-shareholders") {
      if (!store.dateAuthorizationGranted) errors.dateAuthorizationGranted = "Date dissolution was authorized is required";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [store.signerName, store.signerTitle, store.signingDate, store.sharesIssuedOption, store.authorizationOption, store.dateAuthorizationGranted, currentEntityType]);

  const handleContinueToGaps = () => {
    if (lowConfidenceLocked) return;
    if (!checkStep1()) return;
    setValidationErrors({});
    setCurrentSection("gaps");
  };

  const handleContinueToCertification = () => {
    if (!checkStep2()) return;
    setCurrentSection("certification");
  };

  const handleCertificationContinue = () => {
    setCurrentSection("preview");
  };

  // --- Signature pad modal ---
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // --- PDF preview modal ---
  const [showPdfModal, setShowPdfModal] = useState(false);

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
        const err = await response.json().catch(() => ({}));
        const detail = (err as { message?: string; details?: { field: string; message: string }[] });
        const msg = detail.message
          ?? detail.details?.map((d) => `${d.field || "root"}: ${d.message}`).join("; ")
          ?? `HTTP ${response.status}`;
        setDownloadError(`PDF generation failed: ${msg}`);
        console.error("[download] API error", response.status, err);
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

  // Per-field validators
  const fieldValidators: Record<string, (v: string) => string | null> = {
    contactEmail: (v) => {
      if (!v) return null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        ? null
        : "Enter a valid email — e.g. info@company.com";
    },
    contactPhone: (v) => {
      if (!v) return null;
      // US format: accepts (307) 555-1234 / 307-555-1234 / 3075551234 / +1 307 555 1234
      return /^\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}$/.test(v.trim())
        ? null
        : "Enter a US phone number — e.g. (307) 555-1234";
    },
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
          validate={fieldValidators[fieldId]}
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
    <main className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="border-b-2 border-navy bg-cream px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-navy flex items-center justify-center">
            <span className="font-display text-white text-lg leading-none">W</span>
          </div>
          <span className="font-display text-xl tracking-wide text-navy">WINDDOWN</span>
        </div>
        <StartOverLink />
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <div>
          <span className="inline-block bg-brand-yellow border-2 border-navy px-3 py-1 text-xs font-bold uppercase tracking-widest text-navy shadow-brutal-sm mb-4">
            Review Form
          </span>
          <h1 className="font-display text-4xl sm:text-5xl uppercase text-navy leading-none">
            Review Your<br />Dissolution Form
          </h1>
          <p className="mt-3 text-sm text-navy/60 font-medium">
            Check that all information is correct before certifying and downloading.
          </p>
        </div>

        {extractionResult.analysisMode === "manual-fallback" && (
          <div className="border-2 border-navy bg-brand-yellow shadow-brutal p-4 space-y-1" role="alert">
            <p className="font-bold uppercase tracking-wide text-sm text-navy">Couldn&apos;t read your site automatically.</p>
            <p className="text-sm text-navy/70">
              {extractionResult.failureReason?.errorClass === "robots_blocked"
                ? "The site's robots.txt disallows automated access."
                : "The automated analysis did not complete. Please fill in your company details below."}
            </p>
          </div>
        )}

        {/* ── Section 1: Extraction Review Board ── */}
        <section aria-labelledby="review-heading">
          <Card>
            <CardHeader>
              <CardTitle id="review-heading">
                {isManualEntry || extractionResult.analysisMode === "manual-fallback"
                  ? "Step 1 — Company information"
                  : "Step 1 — Extracted information"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderExtractedField("companyLegalName", "Company legal name")}
              {renderExtractedField("contactEmail", "Contact email")}
              {renderExtractedField("contactPhone", "Contact phone")}
              {renderExtractedField("physicalAddress", "Physical address")}
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

                {/* ── Signature ── */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest">Signature *</Label>
                  {store.signatureDataUrl ? (
                    <div className="border-2 border-navy bg-white p-3 space-y-2">
                      <img
                        src={store.signatureDataUrl}
                        alt="Your signature"
                        className="max-h-16 w-auto"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignatureModal(true)}
                        className="text-xs font-bold uppercase tracking-widest text-navy/60 hover:text-navy underline"
                      >
                        Re-sign
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowSignatureModal(true)}
                      className="w-full flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Draw Your Signature →
                    </Button>
                  )}
                </div>

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
                    type="text"
                    placeholder="MM/DD/YYYY"
                    value={store.signingDate}
                    onChange={(e) => store.setFieldValue("signingDate", e.target.value)}
                  />
                  {validationErrors.signingDate && (
                    <p className="text-xs text-red-600">{validationErrors.signingDate}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entityType">Entity type &amp; dissolution form *</Label>
                  <select
                    id="entityType"
                    value={store.entityType || "wyoming-llc"}
                    onChange={(e) => store.setFieldValue("entityType", e.target.value)}
                    className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    <option value="wyoming-llc">Wyoming LLC — Articles of Dissolution (W.S. 17-29-701)</option>
                    <option value="wyoming-corp-directors">Wyoming Corporation — Dissolution by Directors &amp; Shareholders</option>
                    <option value="wyoming-corp-shareholders">Wyoming Corporation — Dissolution by Incorporators or Initial Directors</option>
                  </select>
                  <p className="text-xs text-zinc-500">Select the form that matches your entity. If unsure, check your original filing documents.</p>
                </div>

                {/* ── Corp Directors: additional required fields ── */}
                {currentEntityType === "wyoming-corp-directors" && (
                  <div className="space-y-5 border-t-2 border-navy/10 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="dateOfIncorporation" className="text-xs font-bold uppercase tracking-widest">Date of Incorporation</Label>
                      <Input
                        id="dateOfIncorporation"
                        type="text"
                        placeholder="MM/DD/YYYY"
                        value={store.dateOfIncorporation}
                        onChange={(e) => useFormState.setState({ dateOfIncorporation: e.target.value, certificationAffirmed: false, userConfirmedReview: false })}
                      />
                    </div>

                    <fieldset className="space-y-2">
                      <legend className="text-xs font-bold uppercase tracking-widest text-navy">
                        Check one box only *
                      </legend>
                      <p className="text-xs text-navy/60">Status at time of dissolution:</p>
                      {[
                        { value: "no-shares-issued", label: "None of the shares have been issued." },
                        { value: "not-commenced", label: "The corporation has not commenced business." },
                      ].map((opt) => (
                        <label key={opt.value} className={`flex items-start gap-3 p-3 border-2 cursor-pointer transition-colors ${store.sharesIssuedOption === opt.value ? "border-navy bg-brand-yellow/20" : "border-navy/30 bg-white hover:border-navy"}`}>
                          <input
                            type="radio"
                            name="sharesIssuedOption"
                            value={opt.value}
                            checked={store.sharesIssuedOption === opt.value}
                            onChange={() => useFormState.setState({ sharesIssuedOption: opt.value as "no-shares-issued" | "not-commenced", certificationAffirmed: false, userConfirmedReview: false })}
                            className="mt-0.5 accent-navy"
                          />
                          <span className="text-sm text-navy">{opt.label}</span>
                        </label>
                      ))}
                      {validationErrors.sharesIssuedOption && (
                        <p className="text-xs font-bold text-brand-red uppercase tracking-wide">{validationErrors.sharesIssuedOption}</p>
                      )}
                    </fieldset>

                    <fieldset className="space-y-2">
                      <legend className="text-xs font-bold uppercase tracking-widest text-navy">
                        Check one box only *
                      </legend>
                      <p className="text-xs text-navy/60">Who authorized the dissolution:</p>
                      {[
                        { value: "incorporators", label: "A majority of the incorporators authorized the dissolution." },
                        { value: "initial-directors", label: "A majority of the initial directors authorize the dissolution." },
                      ].map((opt) => (
                        <label key={opt.value} className={`flex items-start gap-3 p-3 border-2 cursor-pointer transition-colors ${store.authorizationOption === opt.value ? "border-navy bg-brand-yellow/20" : "border-navy/30 bg-white hover:border-navy"}`}>
                          <input
                            type="radio"
                            name="authorizationOption"
                            value={opt.value}
                            checked={store.authorizationOption === opt.value}
                            onChange={() => useFormState.setState({ authorizationOption: opt.value as "incorporators" | "initial-directors", certificationAffirmed: false, userConfirmedReview: false })}
                            className="mt-0.5 accent-navy"
                          />
                          <span className="text-sm text-navy">{opt.label}</span>
                        </label>
                      ))}
                      {validationErrors.authorizationOption && (
                        <p className="text-xs font-bold text-brand-red uppercase tracking-wide">{validationErrors.authorizationOption}</p>
                      )}
                    </fieldset>

                    <div className="border-2 border-navy/20 bg-white p-3 text-xs text-navy/60 space-y-1">
                      <p>✓ The net assets of the corporation remaining after winding up have been distributed to the shareholders, if shares were issued.</p>
                    </div>
                  </div>
                )}

                {/* ── Corp Shareholders: date authorization granted ── */}
                {currentEntityType === "wyoming-corp-shareholders" && (
                  <div className="space-y-2 border-t-2 border-navy/10 pt-4">
                    <Label htmlFor="dateAuthorizationGranted" className="text-xs font-bold uppercase tracking-widest">
                      Date Dissolution was Authorized *
                    </Label>
                    <Input
                      id="dateAuthorizationGranted"
                      type="text"
                      placeholder="MM/DD/YYYY"
                      value={store.dateAuthorizationGranted}
                      onChange={(e) => useFormState.setState({ dateAuthorizationGranted: e.target.value, certificationAffirmed: false, userConfirmedReview: false })}
                    />
                    {validationErrors.dateAuthorizationGranted && (
                      <p className="text-xs font-bold text-brand-red uppercase tracking-wide">{validationErrors.dateAuthorizationGranted}</p>
                    )}
                    <div className="border-2 border-navy/20 bg-white p-3 text-xs text-navy/60">
                      <p>✓ Approved by shareholders — this form certifies shareholder authorization of the dissolution.</p>
                    </div>
                  </div>
                )}

                {/* T055 — unsupported entity type notice */}
                {isUnsupportedEntityType && (
                  <div className="border-2 border-navy bg-brand-yellow shadow-brutal p-4 text-sm" role="alert">
                    <p className="font-bold uppercase tracking-wide text-navy">Entity type not yet supported</p>
                    <p className="mt-1">
                      Winddown currently supports Wyoming LLCs only. For{" "}
                      <strong>{currentEntityType}</strong> dissolution forms, please visit the{" "}
                      <a
                        href={wyomingConfig.sosFormsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Wyoming Secretary of State forms page
                      </a>
                      .
                    </p>
                    <LegalDisclaimer />
                  </div>
                )}

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
                  disabled={isUnsupportedEntityType}
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

        {/* ── Section 4: Preview & Download ── */}
        {currentSection === "preview" && (
          <section aria-labelledby="preview-heading">
            <Card>
              <CardHeader>
                <CardTitle id="preview-heading">Step 4 — Preview &amp; Download</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-zinc-600">
                  Open the PDF preview to review the filled form before downloading.
                </p>

                <Button
                  variant="outline"
                  onClick={() => setShowPdfModal(true)}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Open PDF Preview
                </Button>

                <div className="rounded-md border border-zinc-200 p-4 space-y-3">
                  <p className="text-sm font-medium text-zinc-700">Final confirmation</p>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="userConfirmedReview"
                      checked={store.userConfirmedReview}
                      onCheckedChange={(checked) =>
                        useFormState.setState({ userConfirmedReview: checked === true })
                      }
                      aria-label="I have reviewed all information and it is accurate"
                    />
                    <Label htmlFor="userConfirmedReview" className="text-sm text-zinc-700 cursor-pointer leading-snug">
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

            {showPdfModal && (
              <PdfPreviewModal
                intakeState={previewIntakeState}
                companyName={companyLegalName}
                userConfirmedReview={store.userConfirmedReview}
                onConfirmChange={(v) => useFormState.setState({ userConfirmedReview: v })}
                onDownload={handleDownload}
                downloading={downloading}
                downloadError={downloadError}
                onClose={() => setShowPdfModal(false)}
              />
            )}
          </section>
        )}
      </div>

      {showSignatureModal && (
        <SignaturePadModal
          onSave={(dataUrl) => {
            useFormState.setState({ signatureDataUrl: dataUrl, certificationAffirmed: false, userConfirmedReview: false });
            setShowSignatureModal(false);
          }}
          onClose={() => setShowSignatureModal(false)}
        />
      )}
    </main>
  );
}
