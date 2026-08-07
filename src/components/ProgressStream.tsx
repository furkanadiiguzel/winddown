import React from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export interface ProgressEvent {
  type: string;
  message?: string;
  url?: string;
}

interface ProgressStreamProps {
  events: ProgressEvent[];
}

function labelForEventType(type: string): string {
  switch (type) {
    case "fetching_home":
      return "Fetching home page…";
    case "found_pages":
      return "Discovered candidate pages";
    case "fetching_page":
      return "Fetching additional page…";
    case "tier2_fallback":
      return "Switching to headless browser render…";
    case "extracting":
      return "Extracting business information with AI…";
    case "retrying_ai":
      return "Retrying AI extraction…";
    case "done":
      return "Extraction complete";
    case "error":
      return "An error occurred";
    default:
      return type;
  }
}

function EventIcon({ type }: { type: string }) {
  if (type === "done") {
    return <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />;
  }
  if (type === "error") {
    return <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  }
  return <Loader2 className="h-4 w-4 text-zinc-400 shrink-0 mt-0.5 animate-spin" />;
}

/**
 * ProgressStream — renders ordered list of SSE progress events with human-readable labels.
 */
export function ProgressStream({ events }: ProgressStreamProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-zinc-500 animate-pulse">Starting analysis…</p>
    );
  }

  return (
    <ol className="space-y-2">
      {events.map((event, index) => (
        <li key={index} className="flex items-start gap-2 text-sm text-zinc-700">
          <EventIcon type={event.type} />
          <span>
            {event.message ?? labelForEventType(event.type)}
            {event.url && (
              <span className="ml-1 text-xs text-zinc-400 truncate">({event.url})</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
