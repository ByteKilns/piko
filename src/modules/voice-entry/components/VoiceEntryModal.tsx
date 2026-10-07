"use client";

import { useEffect, useState } from "react";

import { Square } from "lucide-react";

import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { isSpeechRecognitionSupported, useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { parseVoiceEntryAction } from "@/modules/voice-entry/api/voice-entry.actions";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

type Stage =
  | { message: string; transcript: string; type: "error" }
  | { type: "listening" }
  | { type: "parsing" };

type Props = {
  onClose: () => void;
  onManualAdd: () => void;
  onParsed: (draft: ExpenseDraft) => void;
  open: boolean;
};

const NOT_SUPPORTED_MESSAGE = "Voice input isn't supported in this browser.";
const PERMISSION_DENIED_MESSAGE = "Microphone access is blocked — check your browser's site settings.";
const NOT_UNDERSTOOD_MESSAGE = "Couldn't quite catch that as an expense — try rephrasing, or add it manually.";

export function VoiceEntryModal({ onClose, onManualAdd, onParsed, open }: Props) {
  const speech = useSpeechRecognition();
  const [stage, setStage] = useState<Stage>({ type: "listening" });

  useEffect(() => {
    if (!open) {
      speech.stop();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets stale error/parsing stage so reopening doesn't flash last session's leftover UI before this effect re-runs
      setStage({ type: "listening" });
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setStage({ message: NOT_SUPPORTED_MESSAGE, transcript: "", type: "error" });
      return;
    }

    setStage({ type: "listening" });
    speech.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the modal opens, not on every speech-state change
  }, [open]);

  useEffect(() => {
    if (speech.error === "not-allowed") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- surfaces a mic-permission error reported asynchronously by the browser's speech API, not derivable inline from a single event handler
      setStage({ message: PERMISSION_DENIED_MESSAGE, transcript: "", type: "error" });
    }
  }, [speech.error]);

  async function parseAndAdvance(transcript: string) {
    setStage({ type: "parsing" });
    try {
      const result = await parseVoiceEntryAction(transcript);
      if (result.ok) {
        onParsed(result.draft);
      } else {
        setStage({ message: NOT_UNDERSTOOD_MESSAGE, transcript, type: "error" });
      }
    } catch {
      setStage({ message: NOT_UNDERSTOOD_MESSAGE, transcript, type: "error" });
    }
  }

  async function handleStop() {
    speech.stop();
    // speech.transcript only holds finalized text; fall back to / append the still-interim
    // text so whatever was mid-utterance when Stop was pressed isn't silently dropped.
    const transcript = [speech.transcript, speech.interimTranscript].filter(Boolean).join(" ").trim();
    if (!transcript) {
      setStage({ message: "Didn't catch anything — try again.", transcript: "", type: "error" });
      return;
    }

    await parseAndAdvance(transcript);
  }

  async function handleRetryParse(transcript: string) {
    await parseAndAdvance(transcript);
  }

  function handleRestart() {
    setStage({ type: "listening" });
    speech.start();
  }

  return (
    <Modal onOpenChange={(next) => !next && onClose()} open={open} title="Add by Voice">
      {stage.type === "listening" && (
        <div className="space-y-4 text-center">
          <p className="min-h-12 text-sm text-muted-foreground">
            {speech.interimTranscript || speech.transcript || "Listening... say what you spent."}
          </p>
          <Button onClick={handleStop} type="button">
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      )}

      {stage.type === "parsing" && <p className="text-center text-sm text-muted-foreground">Understanding...</p>}

      {stage.type === "error" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{stage.message}</p>
          {stage.transcript && (
            <p className="rounded-lg bg-muted p-3 text-sm italic">&quot;{stage.transcript}&quot;</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRestart} type="button" variant="outline">
              Try again
            </Button>
            {stage.transcript && (
              <Button onClick={() => handleRetryParse(stage.transcript)} type="button" variant="outline">
                Retry parsing
              </Button>
            )}
            <Button onClick={onManualAdd} type="button" variant="ghost">
              Add manually instead
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
