"use client";

import React, { useState, useRef } from "react";
import { AlertTriangle, Pencil, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EvidencePopover } from "@/components/EvidencePopover";
import type { ExtractedField, AbsentField } from "@/schemas/extraction";

interface FieldCardProps {
  field: ExtractedField | AbsentField;
  label: string;
  onEdit: (value: string) => void;
  /** Optional per-field validator. Return error string or null. */
  validate?: (value: string) => string | null;
  showConfirmAffordance?: boolean;
  onConfirm?: () => void;
}

function isExtractedField(field: ExtractedField | AbsentField): field is ExtractedField {
  return "value" in field;
}

export function FieldCard({
  field,
  label,
  onEdit,
  validate,
  showConfirmAffordance,
  onConfirm,
}: FieldCardProps) {
  const extracted = isExtractedField(field);
  const isLowConfidence = extracted && field.confidence === "low" && !field.userOverridden;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(extracted ? field.value : "");
  const [editError, setEditError] = useState<string | null>(null);
  const [savedError, setSavedError] = useState<string | null>(() =>
    validate && extracted && field.value ? validate(field.value) : null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditValue(extracted ? field.value : "");
    setEditError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleChange = (v: string) => {
    setEditValue(v);
    setEditError(null); // clear error while typing; validate only on save
  };

  const saveEdit = () => {
    const trimmed = editValue.trim();
    if (validate && trimmed) {
      const err = validate(trimmed);
      if (err) { setEditError(err); return; } // keep editing, don't save invalid value
    }
    if (trimmed !== (extracted ? field.value : "")) {
      onEdit(trimmed);
    }
    setSavedError(validate && trimmed ? validate(trimmed) : null);
    setEditError(null);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") { setEditing(false); setEditError(null); }
  };

  const sourceLabel =
    extracted && field.sourceUrl
      ? `from ${new URL(field.sourceUrl).hostname}`
      : null;

  const cardBorder = isLowConfidence
    ? "border-amber-400 ring-1 ring-amber-300"
    : savedError
    ? "border-brand-red shadow-[2px_2px_0px_0px_#DC2626]"
    : undefined;

  return (
    <Card className={cardBorder}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-navy/70">{label}</span>
          <div className="flex items-center gap-1.5">
            {isLowConfidence && (
              <span className="flex items-center gap-1 text-xs font-bold text-amber-700 uppercase tracking-wide">
                <AlertTriangle className="h-3.5 w-3.5" />
                Low confidence
              </span>
            )}
            {extracted && sourceLabel && (
              <EvidencePopover field={field}>
                <button
                  type="button"
                  className="cursor-pointer focus:outline-none"
                  aria-label={`View evidence for ${label}`}
                >
                  <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-zinc-200">
                    {sourceLabel}
                  </Badge>
                </button>
              </EvidencePopover>
            )}
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startEdit}
                className="h-7 px-2 text-xs"
                aria-label={`Edit ${label}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={editValue}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`h-9 text-sm ${editError ? "border-brand-red focus-visible:ring-brand-red" : ""}`}
                aria-label={`Edit value for ${label}`}
                aria-invalid={!!editError}
                aria-describedby={editError ? `${label}-error` : undefined}
              />
              <Button
                size="sm"
                onClick={saveEdit}
                className="h-9 px-3 shrink-0"
                aria-label="Save"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            </div>
            {editError && (
              <p id={`${label}-error`} className="text-xs font-bold text-brand-red uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {editError}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <p className={extracted && field.value ? "text-sm text-navy" : "text-sm italic text-navy/30"}>
              {extracted && field.value ? field.value : "Needs your input"}
            </p>
            {savedError && (
              <p className="text-xs font-bold text-brand-red uppercase tracking-wide flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {savedError}
              </p>
            )}
          </div>
        )}

        {isLowConfidence && showConfirmAffordance && onConfirm && (
          <Button
            variant="outline"
            size="sm"
            onClick={onConfirm}
            className="mt-1 h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-50"
          >
            This is correct ✓
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
