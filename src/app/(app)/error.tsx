"use client";

import { ErrorState } from "@/components/ErrorState";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pt-6">
      <ErrorState error={error} reset={reset} />
    </div>
  );
}
