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
  /** Optional: show "This is correct" affordance for low-confidence gate */
  showConfirmAffordance?: boolean;
  onConfirm?: () => void;
}

function isExtractedField(field: ExtractedField | AbsentField): field is ExtractedField {
  return "value" in field;
}

/**
 * FieldCard — displays a form field with its extracted value, source badge,
 * confidence indicator, and inline edit capability.
 */
export function FieldCard({
  field,
  label,
  onEdit,
  showConfirmAffordance,
  onConfirm,
}: FieldCardProps) {
  const extracted = isExtractedField(field);
  const isLowConfidence = extracted && field.confidence === "low" && !field.userOverridden;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(extracted ? field.value : "");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditValue(extracted ? field.value : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveEdit = () => {
    if (editValue.trim() !== (extracted ? field.value : "")) {
      onEdit(editValue.trim());
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") setEditing(false);
  };

  const sourceLabel =
    extracted && field.sourceUrl
      ? `from ${new URL(field.sourceUrl).hostname}`
      : null;

  return (
    <Card
      className={
        isLowConfidence
          ? "border-amber-400 ring-1 ring-amber-300"
          : "border-zinc-200"
      }
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-zinc-700">{label}</span>
          <div className="flex items-center gap-1.5">
            {isLowConfidence && (
              <span className="flex items-center gap-1 text-xs text-amber-700">
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
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm"
              aria-label={`Edit value for ${label}`}
            />
            <Button
              size="sm"
              onClick={saveEdit}
              className="h-8 px-2"
              aria-label="Save"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p
            className={
              extracted && field.value
                ? "text-sm text-zinc-900"
                : "text-sm italic text-zinc-400"
            }
          >
            {extracted && field.value ? field.value : "Needs your input"}
          </p>
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
