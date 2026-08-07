import React from "react";

/**
 * LegalDisclaimer — renders on every screen that displays form data.
 * Document preparation only, not legal advice.
 */
export function LegalDisclaimer() {
  return (
    <p className="mt-6 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
      Winddown is document preparation software, not legal advice. This tool does not advise
      on, interpret, or guarantee legal outcomes. Consult a licensed attorney for legal advice.
    </p>
  );
}
