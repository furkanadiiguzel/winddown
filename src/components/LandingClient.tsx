"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LandingClient() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      setUrlError("Please enter a valid URL (e.g. https://your-company.com).");
      return;
    }
    if (parsed.protocol !== "https:") {
      setUrlError("Please enter an HTTPS URL.");
      return;
    }

    router.push(`/analyze?url=${encodeURIComponent(parsed.href)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="border-2 border-navy bg-white shadow-brutal p-6 space-y-5">
      <div className="space-y-2">
        <Label htmlFor="company-url" className="text-xs font-bold uppercase tracking-widest text-navy">
          Company Website URL
        </Label>
        <Input
          id="company-url"
          type="url"
          placeholder="https://your-company.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="url"
          required
        />
        {urlError && (
          <p className="text-xs font-bold text-brand-red uppercase tracking-wide" role="alert">
            {urlError}
          </p>
        )}
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="authorization"
          checked={authorized}
          onCheckedChange={(v) => setAuthorized(v === true)}
          aria-required="true"
          className="mt-0.5"
        />
        <Label htmlFor="authorization" className="text-sm text-navy/70 cursor-pointer leading-snug">
          I am authorized to dissolve this entity and understand this tool prepares
          documents for submission — it does not file them or provide legal advice.
        </Label>
      </div>

      <Button type="submit" disabled={!authorized} className="w-full">
        Analyse My Company Site →
      </Button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-navy/20" />
        <span className="text-xs font-bold uppercase tracking-widest text-navy/40">or</span>
        <div className="flex-1 h-px bg-navy/20" />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => router.push("/review?manual=true")}
        className="w-full"
      >
        Enter Details Manually →
      </Button>
    </form>
  );
}
