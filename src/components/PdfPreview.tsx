"use client";

import React, { useEffect, useState } from "react";
import type { IntakeState } from "@/schemas/intake";

interface PdfPreviewProps {
  intakeState: IntakeState;
}

type PreviewStatus = "loading" | "ready" | "error";

/**
 * PdfPreview — fetches a PREVIEW watermarked PDF from /api/generate-pdf
 * and embeds it in an iframe using a blob URL.
 */
export function PdfPreview({ intakeState }: PdfPreviewProps) {
  const [status, setStatus] = useState<PreviewStatus>("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function fetchPreview() {
      setStatus("loading");
      setBlobUrl(null);

      try {
        const response = await fetch("/api/generate-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intakeState: { ...intakeState, mode: "preview" } }),
        });

        if (!response.ok) {
          if (!cancelled) setStatus("error");
          return;
        }

        const blob = await response.blob();
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void fetchPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [intakeState]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-48 rounded-md border border-zinc-200 bg-zinc-50">
        <p className="text-sm text-zinc-500 animate-pulse">Generating preview…</p>
      </div>
    );
  }

  if (status === "error" || !blobUrl) {
    return (
      <div className="flex items-center justify-center h-48 rounded-md border border-amber-200 bg-amber-50">
        <p className="text-sm text-amber-700">
          Preview unavailable — you can still download.
        </p>
      </div>
    );
  }

  return (
    <iframe
      src={blobUrl}
      className="w-full h-[600px] rounded-md border border-zinc-200"
      title="PDF Preview"
    />
  );
}
