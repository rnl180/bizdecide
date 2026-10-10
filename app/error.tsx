"use client";

import { useEffect } from "react";
import { StatePage } from "@/components/StatePage";

/** App-level error page: anything that throws while rendering lands here, inside the normal header and footer. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <StatePage kind="error" onRetry={reset} reference={error.digest} />;
}
