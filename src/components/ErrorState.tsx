"use client";

import { useEffect } from "react";

import { EmptyState } from "@/components/EmptyState";
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
    <EmptyState
      action={
        <Button onClick={reset} type="button" variant="outline">
          Try again
        </Button>
      }
      body={error.digest ? `Reference: ${error.digest}` : "Please try again."}
      size="lg"
      title="Something went wrong"
    />
  );
}
