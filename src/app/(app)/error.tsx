"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Error state: explains what failed and offers a retry. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[kairos] page error", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <div>
        <h1 className="text-sm font-semibold">Something went wrong</h1>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          This view could not be loaded. Your data is safe in the database — try again, and check the
          server logs if it keeps happening.
        </p>
      </div>
      <p className="max-w-lg truncate text-xs text-muted-foreground" title={error.message}>
        {error.message}
      </p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
