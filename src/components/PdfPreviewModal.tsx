"use client";

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import type { IntakeState } from "@/schemas/intake";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface PdfPreviewModalProps {
  intakeState: IntakeState;
  companyName: string;
  userConfirmedReview: boolean;
  onConfirmChange: (v: boolean) => void;
  onDownload: () => void;
  downloading: boolean;
  downloadError: string | null;
  onClose: () => void;
}

type LoadStatus = "loading" | "ready" | "error";

export function PdfPreviewModal({
  intakeState,
  companyName,
  userConfirmedReview,
  onConfirmChange,
  onDownload,
  downloading,
  downloadError,
  onClose,
}: PdfPreviewModalProps) {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function fetchPreview() {
      setStatus("loading");
      setBlobUrl(null);
      try {
        const res = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intakeState: { ...intakeState, mode: "preview" } }),
        });
        if (!res.ok) { if (!cancelled) setStatus("error"); return; }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    void fetchPreview();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [intakeState]);

  // Escape key closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="PDF Preview"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-md shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-zinc-900 truncate">
            {companyName || "Articles of Dissolution"} — PDF Preview
          </span>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 ml-4 p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
          aria-label="Close preview"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* PDF area */}
      <div className="flex-1 overflow-hidden bg-zinc-200">
        {status === "loading" && (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white rounded-lg px-6 py-4 shadow text-sm text-zinc-500 animate-pulse">
              Generating preview…
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white rounded-lg px-6 py-4 shadow text-sm text-amber-700">
              Preview unavailable — you can still confirm and download below.
            </div>
          </div>
        )}
        {status === "ready" && blobUrl && (
          <iframe
            src={blobUrl}
            className="w-full h-full border-0"
            title="PDF Preview"
          />
        )}
      </div>

      {/* Bottom action bar */}
      <div className="bg-white border-t border-zinc-200 px-4 py-4 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="modalConfirm"
              checked={userConfirmedReview}
              onCheckedChange={(v) => onConfirmChange(v === true)}
            />
            <Label htmlFor="modalConfirm" className="text-sm text-zinc-700 cursor-pointer leading-snug">
              I have reviewed this document and confirm all information is accurate.
            </Label>
          </div>

          {downloadError && (
            <p className="text-sm text-red-600">{downloadError}</p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close Preview
            </Button>
            <Button
              onClick={onDownload}
              disabled={!userConfirmedReview || downloading}
              className="flex-1"
            >
              {downloading ? "Generating…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(modal, document.body);
}
