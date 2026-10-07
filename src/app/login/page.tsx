"use client";

import { useActionState } from "react";

import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";
import { loginAction } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="grid min-h-screen bg-paper text-ink lg:grid-cols-2">
      <div className="flex flex-col justify-between gap-10 border-b-2 border-rule px-6 py-6 lg:border-r-2 lg:border-b-0 lg:p-12">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid size-8 place-items-center bg-ink text-base font-extrabold text-paper">
            P
          </span>
          <span className="text-[17px] font-extrabold">Piko</span>
        </div>
        <div className="hidden lg:block">
          <p className="text-[76px] leading-[0.95] font-extrabold tracking-[-0.035em]">Piko</p>
          <p className="mt-5 max-w-[26ch] border-t-2 border-ink pt-4 text-xl leading-snug text-n-800">Plan together, grow together.</p>
        </div>
      </div>

      <div className="flex items-start px-6 py-10 lg:items-center lg:p-12">
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
        </form>
      </div>
    </div>
  );
}
