"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CertificationStepProps {
  onContinue: () => void;
  affirmed: boolean;
  onAffirm: (v: boolean) => void;
}

const WINDING_UP_DUTIES = [
  "All known creditors have been notified of the dissolution",
  "Outstanding debts and liabilities have been settled or adequately provided for",
  "A final tax return has been or will be filed with federal and state tax authorities",
  "All business bank accounts have been or will be closed",
  "Where applicable, a unanimous member vote authorizing dissolution has been obtained",
] as const;

/**
 * CertificationStep — renders the W.S. 17-29-701 certification explanation,
 * an informational winding-up checklist, and a certification checkbox.
 * The checkbox MUST default to unchecked with no external pre-check.
 */
export function CertificationStep({
  onContinue,
  affirmed,
  onAffirm,
}: CertificationStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Certification (W.S. 17-29-701)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md bg-zinc-50 border border-zinc-200 p-4 text-sm text-zinc-700 space-y-2">
          <p className="font-medium">What you are certifying</p>
          <p>
            By checking the box below, you certify under Wyoming Statute 17-29-701 that:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The company has met all requirements for dissolution and winding up under Wyoming law.</li>
            <li>You are an authorized representative with legal authority to sign this filing.</li>
            <li>All information provided in this document is accurate and complete to the best of your knowledge.</li>
          </ul>
          <p className="text-xs text-zinc-500 mt-2">
            This certification has legal effect. If you are uncertain about any winding-up
            requirements, consult a licensed attorney before proceeding.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-zinc-700 mb-3">
            Winding-up duties (for your reference — not a filing checklist)
          </p>
          <ul className="space-y-2">
            {WINDING_UP_DUTIES.map((duty) => (
              <li key={duty} className="flex items-start gap-2 text-sm text-zinc-600">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-500 text-xs">
                  •
                </span>
                {duty}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-zinc-200 p-4">
          <Checkbox
            id="certification-checkbox"
            // MUST default to false — no external pre-check allowed
            checked={affirmed}
            onCheckedChange={(checked) => onAffirm(checked === true)}
            aria-label="I certify compliance with W.S. 17-29-701"
          />
          <Label
            htmlFor="certification-checkbox"
            className="text-sm text-zinc-700 cursor-pointer leading-relaxed"
          >
            I hereby certify that I am in compliance with W.S. 17-29-701 and I have met all
            requirements for dissolution and winding up of this company.
          </Label>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={onContinue}
          disabled={!affirmed}
          className="w-full"
        >
          Continue to Preview
        </Button>
      </CardFooter>
    </Card>
  );
}
