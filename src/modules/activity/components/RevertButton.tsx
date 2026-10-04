"use client";

import { useRef, useState, useTransition } from "react";

import { TriangleAlert, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { previewRevertAction, revertActivityAction, type RevertPreview } from "../api/revert.actions";
import type { RevertMode } from "../lib/revert/plan";
import { ChangeList } from "./ChangeList";

const MODES: Record<RevertMode, { description: string; label: string }> = {
  restore: {
    description: "Put every field back to how it was before this change — later edits are undone too.",
    label: "Restore to before this change",
  },
  undo: { description: "Put back only what this change altered; later edits stay.", label: "Undo only this change" },
};

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

type Props = { description: string; entryId: string; modes: RevertMode[] };

export function RevertButton({ description, entryId, modes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<RevertMode>(modes[0]);
  const [preview, setPreview] = useState<null | RevertPreview>(null);
  const [error, setError] = useState<null | string>(null);
  const [isReverting, startReverting] = useTransition();
  // Ignores a slow preview that arrives after the user switched modes.
  const latestRequest = useRef(0);

  function loadPreview(nextMode: RevertMode) {
    const request = ++latestRequest.current;
    setMode(nextMode);
    setPreview(null);
    setError(null);
    previewRevertAction(entryId, nextMode)
      .then((result) => request === latestRequest.current && setPreview(result))
      .catch((e: unknown) => request === latestRequest.current && setError(message(e)));
  }

  function openDialog() {
    setOpen(true);
    loadPreview(modes[0]);
  }

  function revert() {
    startReverting(async () => {
      try {
        const result = await revertActivityAction(entryId, mode);
        if (!result.ok) {
          toast.error(result.reason);
          loadPreview(mode);
          return;
        }
        toast.success("Reverted");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(message(e));
        loadPreview(mode);
      }
    });
  }

  return (
    <>
      <Button className="h-7 gap-1 px-2 text-xs" onClick={openDialog} size="sm" type="button" variant="ghost">
        <Undo2 className="h-3.5 w-3.5" />
        Revert
      </Button>
      <Modal
        footer={
          <>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={preview?.kind !== "apply" || isReverting} onClick={revert} type="button">
              {isReverting ? "Reverting..." : "Revert"}
            </Button>
          </>
        }
        icon={Undo2}
        onOpenChange={setOpen}
        open={open}
        title="Revert this change?"
        tone="amber"
      >
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">{description}</p>

          {modes.length > 1 && (
            <div aria-label="How to revert" className="grid gap-2" role="radiogroup">
              {modes.map((m) => (
                <label
                  className={cn("flex cursor-pointer gap-3 rounded-lg border p-3", mode === m && "border-primary bg-primary/5")}
                  key={m}
                >
                  <input checked={mode === m} className="mt-1" name="revert-mode" onChange={() => loadPreview(m)} type="radio" />
                  <span>
                    <span className="font-medium">{MODES[m].label}</span>
                    <span className="block text-xs text-muted-foreground">{MODES[m].description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {error && <p className="text-destructive">{error}</p>}
          {!preview && !error && <p className="text-muted-foreground">Checking what will change…</p>}
          {preview && preview.kind !== "apply" && <p className="rounded-lg bg-muted px-3 py-2">{preview.reason}</p>}
          {preview?.kind === "apply" && (
            <>
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">This will change</p>
                <ChangeList changes={preview.changes} />
              </div>
              {preview.warnings.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  {preview.warnings.map((warning) => (
                    <li className="flex gap-2" key={warning}>
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
