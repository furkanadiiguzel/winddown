"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * T053 — Client-side interactive portion of the landing page.
 * URL input, authorization checkbox, submit → /analyze?url=…
 * "Skip" link → /review?manual=true (T054 user-initiated manual entry).
 */
export function LandingClient() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    // Client-side URL validation
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="company-url">Company website URL</Label>
        <Input
          id="company-url"
          type="url"
          placeholder="https://your-company.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="url"
          required
        />
        {urlError && <p className="text-xs text-red-600" role="alert">{urlError}</p>}
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id="authorization"
          checked={authorized}
          onCheckedChange={(v) => setAuthorized(v === true)}
          aria-required="true"
        />
        <Label htmlFor="authorization" className="text-sm text-zinc-700 cursor-pointer leading-snug">
          I am authorized to dissolve this entity and I understand this tool prepares
          documents for submission — it does not file them or provide legal advice.
        </Label>
      </div>

      <Button type="submit" disabled={!authorized} className="w-full">
        Analyse my company site
      </Button>

      <p className="text-center text-sm text-zinc-500">
        <button
          type="button"
          onClick={() => router.push("/review?manual=true")}
          className="underline hover:text-zinc-700"
        >
          Skip — I&apos;ll enter details manually
        </button>
      </p>
    </form>
  );
}
