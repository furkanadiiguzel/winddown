import React from "react";
import wyomingConfig from "@/config/wyoming";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

/**
 * /done — server component.
 * All procedural facts come exclusively from src/config/wyoming.ts.
 */
export default function DonePage() {
  const {
    mailingAddress,
    feeNote,
    processingTimeNote,
  } = wyomingConfig;

  return (
    <main className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Your dissolution form is ready
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Print, sign in ink, and mail the completed form to the Wyoming Secretary of State.
          </p>
        </div>

        {/* Mailing address block */}
        <Card>
          <CardHeader>
            <CardTitle>Where to mail your form</CardTitle>
          </CardHeader>
          <CardContent>
            <address className="not-italic text-sm text-zinc-700 space-y-0.5">
              <p className="font-medium">{mailingAddress.recipient}</p>
              <p>{mailingAddress.street}</p>
              <p>
                {mailingAddress.city}, {mailingAddress.state} {mailingAddress.zip}
              </p>
            </address>
          </CardContent>
        </Card>

        {/* Fee verification note */}
        <Card>
          <CardHeader>
            <CardTitle>Filing fee</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-700">{feeNote}</p>
          </CardContent>
        </Card>

        {/* Copy count guidance */}
        <Card>
          <CardHeader>
            <CardTitle>Copies to keep</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-700">
              Keep at least one copy of the completed, signed form for your records before
              mailing. The Secretary of State will return a stamped confirmation copy by mail
              to the registered agent or the address listed on the form — retain this as
              proof of dissolution.
            </p>
          </CardContent>
        </Card>

        {/* Processing time note */}
        <Card>
          <CardHeader>
            <CardTitle>Processing time</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-700">{processingTimeNote}</p>
          </CardContent>
        </Card>

        <LegalDisclaimer />
      </div>
    </main>
  );
}
