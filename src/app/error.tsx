"use client";

import { ErrorState } from "@/components/ErrorState";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center bg-paper px-6 md:px-12">
      <ErrorState error={error} reset={reset} />
    </div>
  );
}
