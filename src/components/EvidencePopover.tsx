"use client";

import React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { ExtractedField, AbsentField } from "@/schemas/extraction";

interface EvidencePopoverProps {
  field: ExtractedField | AbsentField;
  children: React.ReactNode;
}

/**
 * EvidencePopover — wraps shadcn/ui Popover to show verbatim evidence and sourceUrl.
 * Renders nothing (passes children through unwrapped) for AbsentField or missing evidence.
 */
export function EvidencePopover({ field, children }: EvidencePopoverProps) {
  // AbsentField has no evidence
  if (!("evidence" in field) || !field.evidence) {
    return <>{children}</>;
  }

  const extractedField = field as ExtractedField;

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="max-w-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-zinc-700">Evidence snippet</p>
          <blockquote className="border-l-2 border-zinc-300 pl-3 text-xs italic text-zinc-600">
            {extractedField.evidence}
          </blockquote>
          <p className="text-xs font-semibold text-zinc-700">Source</p>
          <a
            href={extractedField.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-blue-600 underline"
          >
            {extractedField.sourceUrl}
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
