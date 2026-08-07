"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "@/lib/form-state";

/**
 * T056 — "Start over" link used in /analyze, /review, /done layouts.
 * Clears all Zustand state (including sessionStorage) and returns to /.
 */
export function StartOverLink() {
  const router = useRouter();
  const store = useFormState();

  const handleStartOver = () => {
    store.reset();
    router.push("/");
  };

  return (
    <button
      onClick={handleStartOver}
      className="text-sm text-zinc-500 underline hover:text-zinc-700"
      type="button"
    >
      Start over
    </button>
  );
}
