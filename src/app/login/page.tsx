"use client";

import { useActionState } from "react";

import Link from "next/link";

import { BrandSplit } from "@/components/BrandSplit";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { loginAction } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <BrandSplit>
      <form action={formAction} className="flex w-full max-w-sm flex-col gap-5.5">
        <h1 className="text-[42px] leading-none font-extrabold tracking-[-0.02em]">Sign in</h1>
        <TextField autoComplete="email" id="email" label="Email" name="email" required type="email" />
        <TextField autoComplete="current-password" id="password" label="Password" name="password" required type="password" />
        {state?.error && (
          <p className="text-sm text-signal-ink" role="alert">
            {state.error}
          </p>
        )}
        <Button className="h-10 w-full" disabled={pending} type="submit">
          {pending ? "Signing in..." : "Sign in"}
        </Button>

        <div className="flex items-center gap-3 text-[13px] text-n-600">
          <span aria-hidden className="h-px flex-1 bg-n-300" />
          or
          <span aria-hidden className="h-px flex-1 bg-n-300" />
        </div>
        <Button asChild className="h-10 w-full" variant="outline">
          <Link href="/demo">Try the demo</Link>
        </Button>
        <p className="text-center text-[13px] text-n-600">No account needed — you get a private copy, deleted after 24 hours.</p>
      </form>
    </BrandSplit>
  );
}
