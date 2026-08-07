import React from "react";
import { LandingClient } from "@/components/LandingClient";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

// T053 — Static landing page (force-static so Vercel pre-renders it)
export const dynamic = "force-static";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900">Winddown</h1>
          <p className="mt-2 text-zinc-600">
            Prepare your Wyoming LLC Articles of Dissolution — in minutes, not hours.
          </p>
        </div>

        {/* URL input + authorization — client component because of interactivity */}
        <LandingClient />

        {/* Three-step explanation */}
        <section aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-lg font-semibold text-zinc-900 mb-4">How it works</h2>
          <ol className="space-y-4">
            <li className="flex gap-4">
              <span className="flex-none w-7 h-7 rounded-full bg-zinc-900 text-white text-sm flex items-center justify-center font-bold">1</span>
              <div>
                <p className="font-medium text-zinc-800">Enter your company website URL</p>
                <p className="text-sm text-zinc-500">We read your public website to pre-fill the form. No login required.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-none w-7 h-7 rounded-full bg-zinc-900 text-white text-sm flex items-center justify-center font-bold">2</span>
              <div>
                <p className="font-medium text-zinc-800">Review and complete the form</p>
                <p className="text-sm text-zinc-500">Verify every pre-filled field, add missing details (signer name, date), and certify.</p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex-none w-7 h-7 rounded-full bg-zinc-900 text-white text-sm flex items-center justify-center font-bold">3</span>
              <div>
                <p className="font-medium text-zinc-800">Download and mail</p>
                <p className="text-sm text-zinc-500">Download your completed Articles of Dissolution PDF and mail it to the Wyoming Secretary of State with the filing fee.</p>
              </div>
            </li>
          </ol>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-lg font-semibold text-zinc-900 mb-4">Frequently asked questions</h2>
          <dl className="space-y-4">
            <div>
              <dt className="font-medium text-zinc-800">Is this legal advice?</dt>
              <dd className="mt-1 text-sm text-zinc-600">No. Winddown is document preparation software only. Consult a licensed Wyoming attorney if you have legal questions about dissolving your LLC.</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-800">What if my site can&apos;t be read automatically?</dt>
              <dd className="mt-1 text-sm text-zinc-600">You can skip the URL step and enter your company details manually — the form works exactly the same either way.</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-800">Is my information stored?</dt>
              <dd className="mt-1 text-sm text-zinc-600">No. Your company data lives only in your browser session and is cleared when you close the tab. We do not store scraped content, extracted values, or generated PDFs.</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-800">How many analyses can I run?</dt>
              <dd className="mt-1 text-sm text-zinc-600">Up to 5 website analyses per hour per IP address. If you hit the limit, you can still enter details manually without waiting.</dd>
            </div>
          </dl>
        </section>

        <LegalDisclaimer />
      </div>
    </main>
  );
}
