"use client";

import { useEffect } from "react";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = { error: Error & { digest?: string }; reset: () => void };

export function ErrorState({ error, reset }: Props) {
  useEffect(() => {
    // Server errors are serialised across the boundary, so `cause` (e.g. the
    // underlying Postgres error) is already stripped by the time we see it —
    // check the server terminal for the full chain.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-base font-medium">Something went wrong</p>
        <p className="text-sm text-muted-foreground">
          {error.digest ? `Reference: ${error.digest}` : "Please try again."}
        </p>
      </div>
      <Button onClick={reset} type="button">
        Try again
      </Button>
    </div>
  );
}
