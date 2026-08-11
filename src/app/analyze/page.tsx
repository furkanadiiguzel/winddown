import { Suspense } from "react";
import AnalyzeClient from "./AnalyzeClient";

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzeClient />
    </Suspense>
  );
}
