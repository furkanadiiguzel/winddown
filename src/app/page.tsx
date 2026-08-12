import React from "react";
import { LandingClient } from "@/components/LandingClient";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

export const dynamic = "force-static";

export default function HomePage() {
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
        <span className="hidden sm:block text-xs font-bold uppercase tracking-widest text-navy/50 border border-navy/30 px-3 py-1">
          Wyoming Dissolution
        </span>
      </nav>

      {/* Hero */}
      <section className="px-6 py-16 sm:py-24 max-w-5xl mx-auto">
        <div className="mb-4">
          <span className="inline-block bg-brand-yellow border-2 border-navy px-3 py-1 text-xs font-bold uppercase tracking-widest text-navy shadow-brutal-sm">
            Document Preparation
          </span>
        </div>

        <h1 className="font-display text-6xl sm:text-8xl lg:text-[9rem] uppercase leading-none tracking-tight text-navy mb-6">
          WIND<br />DOWN<br />
          <span className="text-brand-blue">YOUR LLC</span>
        </h1>

        <p className="text-lg sm:text-xl text-navy/70 max-w-xl mb-10 leading-relaxed">
          Prepare your Wyoming Articles of Dissolution in minutes — not hours.
          We read your company website, fill the form, you review and download.
        </p>

        {/* Form */}
        <div className="max-w-xl">
          <LandingClient />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t-2 border-navy bg-cream px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-2">
            <span className="inline-block bg-brand-blue border-2 border-navy px-3 py-1 text-xs font-bold uppercase tracking-widest text-white shadow-brutal-sm">
              How It Works
            </span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl uppercase text-navy mb-12">
            Three Steps.<br />Done.
          </h2>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                num: "01",
                title: "Enter Your URL",
                body: "We fetch your public website and extract company details automatically. No login required.",
                color: "bg-brand-blue",
              },
              {
                num: "02",
                title: "Review the Form",
                body: "Verify every pre-filled field, add signer details, and certify under W.S. 17-29-701.",
                color: "bg-brand-yellow",
              },
              {
                num: "03",
                title: "Download & Mail",
                body: "Download your completed PDF. Print, sign in ink, and mail to the Wyoming Secretary of State.",
                color: "bg-brand-red",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="border-2 border-navy bg-white shadow-brutal p-6 space-y-4"
              >
                <div className={`w-12 h-12 ${step.color} border-2 border-navy flex items-center justify-center`}>
                  <span className="font-display text-white text-lg">{step.num}</span>
                </div>
                <p className="font-display text-xl uppercase text-navy leading-tight">{step.title}</p>
                <p className="text-sm text-navy/70 leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t-2 border-navy bg-navy px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <div className="mb-2">
            <span className="inline-block bg-brand-yellow border-2 border-navy px-3 py-1 text-xs font-bold uppercase tracking-widest text-navy shadow-brutal-sm">
              FAQ
            </span>
          </div>
          <h2 className="font-display text-4xl sm:text-5xl uppercase text-cream mb-12">
            Questions?
          </h2>

          <dl className="grid sm:grid-cols-2 gap-6">
            {[
              {
                q: "Is this legal advice?",
                a: "No. Winddown is document preparation software only. Consult a licensed Wyoming attorney for legal questions.",
              },
              {
                q: "What if my site can't be read?",
                a: "You can skip the URL step and enter your company details manually — the form works the same either way.",
              },
              {
                q: "Is my information stored?",
                a: "No. Your data lives only in your browser session and is cleared when you close the tab. Nothing is persisted server-side.",
              },
              {
                q: "How many analyses can I run?",
                a: "Up to 5 per hour per IP. If you hit the limit, you can still enter details manually without waiting.",
              },
            ].map((item) => (
              <div key={item.q} className="border-2 border-cream/20 bg-white/5 p-5 space-y-2">
                <dt className="font-bold uppercase tracking-wide text-cream text-sm">{item.q}</dt>
                <dd className="text-sm text-cream/60 leading-relaxed">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-navy bg-cream px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <LegalDisclaimer />
        </div>
      </footer>
    </main>
  );
}
