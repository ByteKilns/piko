"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { SectionHeading } from "@/components/SectionHeading";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { listReleaseRunsAction, runReleaseWorkflowAction } from "@/modules/app-releases/api/app-releases.actions";
import type { ReleaseRun } from "@/modules/app-releases/api/release-workflow";
import { isRunActive, runLabel } from "@/modules/app-releases/lib/release-runs";

type Props = {
  configured: boolean;
  initialError: null | string;
  initialRuns: ReleaseRun[];
};

// While a run is waiting or going, and for a little after starting one (GitHub
// takes a few seconds to list it), the list refreshes itself.
const POLL_MS = 10_000;
const AFTER_START_MS = 30_000;

export function ReleaseWorkflowSection({ configured, initialError, initialRuns }: Props) {
  const [notes, setNotes] = useState("");
  const [runs, setRuns] = useState(initialRuns);
  const [error, setError] = useState(initialError);
  const [startedAt, setStartedAt] = useState<null | number>(null);
  const [starting, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const result = await listReleaseRunsAction();
    setRefreshing(false);
    if (result.ok) {
      setRuns(result.value);
      setError(null);
    } else {
      setError(result.error);
    }
  }, []);

  const polling = runs.some(isRunActive) || startedAt !== null;
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => {
      if (startedAt !== null && Date.now() - startedAt > AFTER_START_MS) setStartedAt(null);
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, refresh, startedAt]);

  function release() {
    startTransition(async () => {
      const result = await runReleaseWorkflowAction({ notes });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Release started. It takes about 10 minutes; installed apps then offer the update.");
      setNotes("");
      setStartedAt(Date.now());
      void refresh();
    });
  }

  const active = runs.some(isRunActive);

  return (
    <section>
      <SectionHeading sub="Builds the latest main on GitHub, checks the website is ready for it, then publishes it.">
        Release the mobile app
      </SectionHeading>

      {!configured ? (
        <p className="border-b border-n-300 py-4 text-[13px] text-n-700">
          Add <code>GITHUB_RELEASE_TOKEN</code> to the website&apos;s environment to release from here. Until then, use Actions → Release
          mobile app on GitHub.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 border-b border-n-300 py-4">
            <Label htmlFor="release-run-notes">What&apos;s new</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              disabled={starting}
              id="release-run-notes"
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Shown to everyone in the app's update sheet"
              value={notes}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={starting || notes.trim() === ""} onClick={release} type="button">
                {starting ? "Starting…" : "Release"}
              </Button>
              {active && <span className="text-[13px] text-n-600">A release is already going; this one would wait for it.</span>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-4 pb-1">
            <span className="text-[13px] font-semibold">Recent releases</span>
            <Button disabled={refreshing} onClick={() => void refresh()} size="sm" type="button" variant="ghost">
              <RefreshCw className={cn(refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
          {error && <p className="py-2 text-[13px] text-signal-ink">{error}</p>}
          {!error && runs.length === 0 && <p className="py-2 text-[13px] text-n-600">No releases run yet.</p>}
          {runs.map((run) => {
            const { label, tone } = runLabel(run);
            return (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-n-300 py-3" key={run.id}>
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="text-[15px] tabular-nums">#{run.number}</span>
                  <span
                    className={cn(
                      "text-[13px] font-semibold",
                      tone === "good" && "text-ink",
                      tone === "bad" && "text-signal-ink",
                      tone === "muted" && "text-n-700",
                    )}
                  >
                    {label}
                  </span>
                  <span className="text-[13px] text-n-600" suppressHydrationWarning>
                    {new Date(run.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <a className="inline-flex items-center gap-1 text-[13px] text-n-700 hover:text-ink" href={run.url} rel="noreferrer" target="_blank">
                  On GitHub
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
