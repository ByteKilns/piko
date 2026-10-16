"use client";

import { useEffect, useState } from "react";

import { Mic, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { VOICE_PHRASES, type VoicePhrase } from "../../lib/voice-phrases";

// Each phrase "arrives" a letter at a time, as speech recognition shows it.
const LETTER_MS = 40;
const UNDERSTANDING_MS = 900;
const RINGS = 3;

type Props = { onCancel: () => void; onHeard: (phrase: VoicePhrase) => void; onTypeInstead: () => void };

// The mobile app's voice screen, without a microphone: the visitor taps what
// to "say" and the words appear as if heard.
export function PhoneVoice({ onCancel, onHeard, onTypeInstead }: Props) {
  const [phrase, setPhrase] = useState<null | VoicePhrase>(null);
  const [letters, setLetters] = useState(0);
  const heard = phrase ? phrase.text.slice(0, letters) : "";
  const understanding = phrase !== null && letters >= phrase.text.length;

  useEffect(() => {
    if (!phrase) return;
    const timer = understanding
      ? setTimeout(() => onHeard(phrase), UNDERSTANDING_MS)
      : setTimeout(() => setLetters((n) => n + 1), LETTER_MS);
    return () => clearTimeout(timer);
  }, [letters, onHeard, phrase, understanding]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex justify-end px-3 pt-2">
        <Button aria-label="Close" onClick={onCancel} size="icon-sm" type="button" variant="ghost">
          <X />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 pb-6 text-center">
        {understanding ? (
          <>
            <span className="micro-label text-n-600">Understanding</span>
            <span aria-hidden className="h-1 w-40 animate-pulse bg-ink motion-reduce:animate-none" />
            <p className="text-base text-n-700">&ldquo;{phrase.text}&rdquo;</p>
          </>
        ) : (
          <>
            <div aria-hidden className="relative grid size-50 place-items-center">
              {Array.from({ length: RINGS }, (_, i) => (
                <span
                  className="absolute inset-0 animate-[phone-ring_1.8s_ease-out_infinite] border-[1.5px] border-signal opacity-0 motion-reduce:animate-none"
                  key={i}
                  style={{ animationDelay: `${(i * 1.8) / RINGS}s` }}
                />
              ))}
              <span className="absolute size-30 bg-signal/16" />
              <span className="relative grid size-22 place-items-center bg-signal-fill text-white">
                <Mic className="size-10" />
              </span>
            </div>
            <span className="micro-label flex items-center gap-1.5 text-n-600">
              Listening
              <span aria-hidden className="flex gap-0.75">
                {[0, 1, 2].map((i) => (
                  <span
                    className="size-1 animate-[phone-dot_1s_ease-in-out_infinite] bg-n-600 motion-reduce:animate-none"
                    key={i}
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </span>
            <p className={heard ? "text-2xl leading-tight font-extrabold tracking-[-0.01em]" : "text-base text-n-600"}>
              {heard || "Tap a phrase to say it."}
            </p>
            {!phrase && (
              <div className="flex flex-wrap justify-center gap-2">
                {VOICE_PHRASES.map((option) => (
                  <button
                    className="border border-n-300 px-3 py-1.5 text-[13px] text-n-800 hover:border-ink"
                    key={option.text}
                    onClick={() => setPhrase(option)}
                    type="button"
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            )}
            <Button onClick={onTypeInstead} type="button" variant="ghost">
              Type it instead
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
