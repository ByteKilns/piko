"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { startDemoAction } from "../api/demo.actions";

export function DemoStart({ signedInAsSelf }: { signedInAsSelf: boolean }) {
  const [state, formAction, pending] = useActionState(startDemoAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {signedInAsSelf && <p className="text-sm text-n-700">Starting the demo signs you out of your own household.</p>}
      {state?.busy && (
        <p className="text-sm text-signal-ink" role="alert">
          The demo is busy, try again later.
        </p>
      )}
      <Button className="h-10 w-full" disabled={pending} type="submit">
        {pending ? "Setting up your demo…" : "Start the demo"}
      </Button>
    </form>
  );
}
