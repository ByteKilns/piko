# Voice Entry (Phase 1 — Expenses) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user speak an expense out loud and have it open the existing Add Expense modal pre-filled, ready to review and save.

**Architecture:** Browser `SpeechRecognition` transcribes speech to text client-side (no audio leaves the browser). The transcript is sent to a new Server Action, which calls Google's Gemini API (free tier, server-side only — the API key never reaches the client) with a JSON schema matching the expense fields, gets back structured data, validates every ID against the real household data, and returns a safe draft. The client opens the existing `AddExpenseModal` pre-filled with that draft — no changes to `ExpenseForm`, `createExpenseAction`, or any validation already in place.

**Tech Stack:** Next.js Server Actions, `@google/genai` (Gemini SDK), browser Web Speech API, Zod (existing), Vitest (existing), React/Radix (existing).

**Reference spec:** `docs/superpowers/specs/2026-08-30-voice-entry-design.md`

---

## File Structure

New files:
- `src/lib/gemini.ts` — Gemini client wrapper; the only file that talks to the Gemini API.
- `src/lib/useSpeechRecognition.ts` — browser Web Speech API hook + support-detection helper.
- `src/modules/voice-entry/lib/sanitize-voice-expense.ts` — pure function: raw Gemini JSON + household data → safe draft or a typed failure reason. Fully unit-tested.
- `src/modules/voice-entry/lib/sanitize-voice-expense.test.ts`
- `src/modules/voice-entry/api/voice-entry.actions.ts` — the Server Action (`"use server"`) that ties the above two together: loads household data, calls Gemini, sanitizes the result.
- `src/modules/voice-entry/components/VoiceEntryModal.tsx` — Listening → Parsing → Error state machine UI.
- `src/modules/voice-entry/components/VoiceEntryButton.tsx` — the mic trigger; owns `VoiceEntryModal` + a second `AddExpenseModal` instance for the pre-filled result.

Modified files:
- `src/modules/expenses/components/AddExpenseModal.tsx` — add an optional `initial` prop, threaded through to `ExpenseForm` (which already supports it).
- `src/components/nav/SidebarNav.tsx` — render `VoiceEntryButton` next to the existing Add Expense button.
- `src/components/nav/BottomNav.tsx` — render `VoiceEntryButton` next to the existing Add Expense FAB.
- `.env.example` — document `GEMINI_API_KEY`.
- `package.json` — add `@google/genai` (runtime) and `@types/dom-speech-recognition` (dev, gives `window.SpeechRecognition` real types instead of `any`).

---

### Task 1: Install dependencies and set up the API key

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install the Gemini SDK and Web Speech API types**

Run:
```bash
npm install @google/genai
npm install --save-dev @types/dom-speech-recognition
```

Expected: both added to `package.json` (`dependencies` and `devDependencies` respectively), `package-lock.json` updated.

- [ ] **Step 2: Document the new env var**

Add to `.env.example` (after the existing `AUTH_SECRET` line):

```
GEMINI_API_KEY="your-gemini-api-key"
```

- [ ] **Step 3: Add your real key to `.env.local`**

Get a free key from Google AI Studio (https://aistudio.google.com/apikey) and add it to `.env.local` (not committed — same file as `DATABASE_URL`/`AUTH_SECRET`):

```
GEMINI_API_KEY="<your real key>"
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add @google/genai and Web Speech API types for voice entry"
```

---

### Task 2: Pure sanitization logic (TDD)

This is the only part of the feature that's meaningfully unit-testable — it takes whatever
Gemini returns plus the household's real category/member lists and produces either a safe,
fully-populated expense draft or a typed failure reason. No network calls, no mocking.

**Files:**
- Create: `src/modules/voice-entry/lib/sanitize-voice-expense.ts`
- Test: `src/modules/voice-entry/lib/sanitize-voice-expense.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/voice-entry/lib/sanitize-voice-expense.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { sanitizeVoiceExpense } from "./sanitize-voice-expense";

const CATEGORY_ID = "cat-groceries";
const OTHER_CATEGORY_ID = "cat-transport";
const ME = "member-me";
const PARTNER = "member-partner";

const CONTEXT = {
  categories: [{ id: CATEGORY_ID }, { id: OTHER_CATEGORY_ID }],
  currentMemberId: ME,
  members: [{ id: ME }, { id: PARTNER }],
};

function raw(overrides: Partial<Parameters<typeof sanitizeVoiceExpense>[0]> = {}) {
  return {
    amount: 500,
    categoryId: CATEGORY_ID,
    date: "2026-08-15",
    note: "milk and eggs",
    ownerMemberId: ME,
    paidByMemberId: ME,
    understood: true,
    ...overrides,
  };
}

describe("sanitizeVoiceExpense", () => {
  it("passes through a fully valid draft unchanged", () => {
    const result = sanitizeVoiceExpense(raw(), CONTEXT);
    expect(result).toEqual({
      draft: {
        amount: 500,
        categoryId: CATEGORY_ID,
        date: "2026-08-15",
        note: "milk and eggs",
        ownerMemberId: ME,
        paidByMemberId: ME,
      },
      ok: true,
    });
  });

  it("fails with not_understood when Gemini set understood: false", () => {
    const result = sanitizeVoiceExpense(raw({ understood: false }), CONTEXT);
    expect(result).toEqual({ ok: false, reason: "not_understood" });
  });

  it("fails with not_understood when amount is missing or non-positive", () => {
    expect(sanitizeVoiceExpense(raw({ amount: 0 }), CONTEXT)).toEqual({
      ok: false,
      reason: "not_understood",
    });
    expect(sanitizeVoiceExpense(raw({ amount: -5 }), CONTEXT)).toEqual({
      ok: false,
      reason: "not_understood",
    });
  });

  it("falls back to the first category when categoryId isn't a real household category", () => {
    const result = sanitizeVoiceExpense(raw({ categoryId: "not-a-real-id" }), CONTEXT);
    expect(result).toEqual({
      draft: expect.objectContaining({ categoryId: CATEGORY_ID }),
      ok: true,
    });
  });

  it("treats the literal string 'shared' as a shared expense (null owner)", () => {
    const result = sanitizeVoiceExpense(raw({ ownerMemberId: "shared" }), CONTEXT);
    expect(result).toEqual({
      draft: expect.objectContaining({ ownerMemberId: null }),
      ok: true,
    });
  });

  it("falls back to the current member when ownerMemberId isn't a real household member", () => {
    const result = sanitizeVoiceExpense(raw({ ownerMemberId: "not-a-real-id" }), CONTEXT);
    expect(result).toEqual({
      draft: expect.objectContaining({ ownerMemberId: ME }),
      ok: true,
    });
  });

  it("falls back to the current member when paidByMemberId isn't a real household member", () => {
    const result = sanitizeVoiceExpense(raw({ paidByMemberId: "not-a-real-id" }), CONTEXT);
    expect(result).toEqual({
      draft: expect.objectContaining({ paidByMemberId: ME }),
      ok: true,
    });
  });

  it("keeps a valid non-current paidByMemberId (e.g. the partner paid)", () => {
    const result = sanitizeVoiceExpense(raw({ paidByMemberId: PARTNER }), CONTEXT);
    expect(result).toEqual({
      draft: expect.objectContaining({ paidByMemberId: PARTNER }),
      ok: true,
    });
  });

  it("falls back to today's date when date isn't in YYYY-MM-DD shape", () => {
    const result = sanitizeVoiceExpense(raw({ date: "not a date" }), CONTEXT);
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toEqual({
      draft: expect.objectContaining({ date: today }),
      ok: true,
    });
  });

  it("trims whitespace-only notes down to null", () => {
    const result = sanitizeVoiceExpense(raw({ note: "   " }), CONTEXT);
    expect(result).toEqual({
      draft: expect.objectContaining({ note: null }),
      ok: true,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/modules/voice-entry/lib/sanitize-voice-expense.test.ts`

Expected: FAIL — `Cannot find module './sanitize-voice-expense'`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/voice-entry/lib/sanitize-voice-expense.ts`:

```ts
export type RawVoiceExpense = {
  amount: number;
  categoryId: string;
  date: string;
  note: string;
  ownerMemberId: string;
  paidByMemberId: string;
  understood: boolean;
};

export type ExpenseDraft = {
  amount: number;
  categoryId: string;
  date: string;
  note: string | null;
  ownerMemberId: string | null;
  paidByMemberId: string;
};

export type VoiceParseResult = { draft: ExpenseDraft; ok: true } | { ok: false; reason: "not_understood" };

export type VoiceExpenseHouseholdContext = {
  categories: { id: string }[];
  currentMemberId: string;
  members: { id: string }[];
};

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeVoiceExpense(raw: RawVoiceExpense, context: VoiceExpenseHouseholdContext): VoiceParseResult {
  if (!raw.understood || !raw.amount || raw.amount <= 0) {
    return { ok: false, reason: "not_understood" };
  }

  const categoryId = context.categories.some((c) => c.id === raw.categoryId)
    ? raw.categoryId
    : (context.categories[0]?.id ?? "");

  const ownerMemberId =
    raw.ownerMemberId === "shared"
      ? null
      : context.members.some((m) => m.id === raw.ownerMemberId)
        ? raw.ownerMemberId
        : context.currentMemberId;

  const paidByMemberId = context.members.some((m) => m.id === raw.paidByMemberId)
    ? raw.paidByMemberId
    : context.currentMemberId;

  const date = DATE_SHAPE.test(raw.date) ? raw.date : new Date().toISOString().slice(0, 10);

  return {
    draft: {
      amount: raw.amount,
      categoryId,
      date,
      note: raw.note.trim() || null,
      ownerMemberId,
      paidByMemberId,
    },
    ok: true,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/modules/voice-entry/lib/sanitize-voice-expense.test.ts`

Expected: PASS — 10 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/modules/voice-entry/lib/sanitize-voice-expense.ts src/modules/voice-entry/lib/sanitize-voice-expense.test.ts
git commit -m "feat: add pure sanitization for voice-parsed expense drafts"
```

---

### Task 3: Gemini client wrapper

**Files:**
- Create: `src/lib/gemini.ts`

- [ ] **Step 1: Write the implementation**

Create `src/lib/gemini.ts`:

```ts
import { GoogleGenAI, Type } from "@google/genai";

import type { RawVoiceExpense } from "@/modules/voice-entry/lib/sanitize-voice-expense";

// Free-tier Flash-Lite model — generous free quota (30 requests/min, 1500/day at
// time of writing) for a task this small (classify + extract from one sentence).
// Google's Gemini model lineup moves fast; if this ID is ever retired, swap it for
// the current Flash-Lite-tier model at https://ai.google.dev/gemini-api/docs/models.
const MODEL_ID = "gemini-2.5-flash-lite";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type VoiceExpenseContext = {
  categories: { id: string; name: string }[];
  members: { id: string; name: string }[];
  today: string;
};

export async function parseExpenseTranscript(
  transcript: string,
  context: VoiceExpenseContext,
): Promise<RawVoiceExpense> {
  const categoryIds = context.categories.map((c) => c.id);
  const memberIds = context.members.map((m) => m.id);

  const prompt = `You turn a spoken sentence into a structured expense record for a household budget app.

Today's date is ${context.today}.

Categories (id: name):
${context.categories.map((c) => `${c.id}: ${c.name}`).join("\n")}

Household members (id: name):
${context.members.map((m) => `${m.id}: ${m.name}`).join("\n")}

The spoken sentence is:
"${transcript}"

Extract an expense from it. "ownerMemberId" is who the expense is for - use a
member id if a specific person is named or implied (e.g. "I spent" implies the
speaker; assume the first listed member if unclear who is speaking), or the
literal string "shared" if it's a household/shared expense. "paidByMemberId"
is who actually paid - default to the same person as ownerMemberId, or the
first listed member if ownerMemberId is "shared" and no payer is named.
"date" must be YYYY-MM-DD, resolved relative to today's date if the sentence
says "yesterday"/"last Monday"/etc; default to today's date if no date is
mentioned. Set "understood" to false if the sentence doesn't describe a
plausible expense at all (e.g. it's unrelated small talk).`;

  const response = await client.models.generateContent({
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        properties: {
          amount: { type: Type.NUMBER },
          categoryId: { enum: categoryIds, type: Type.STRING },
          date: { type: Type.STRING },
          note: { type: Type.STRING },
          ownerMemberId: { enum: [...memberIds, "shared"], type: Type.STRING },
          paidByMemberId: { enum: memberIds, type: Type.STRING },
          understood: { type: Type.BOOLEAN },
        },
        required: ["understood", "amount", "categoryId", "date", "note", "ownerMemberId", "paidByMemberId"],
        type: Type.OBJECT,
      },
    },
    contents: prompt,
    model: MODEL_ID,
  });

  return JSON.parse(response.text ?? "{}") as RawVoiceExpense;
}
```

- [ ] **Step 2: Verify it against the real API with a scratch script**

This file makes a real network call, so it isn't unit-tested — instead, verify it
actually works against the live Gemini API before building anything on top of it.

Create a throwaway script **inside the project root** (not `/tmp` — its relative import
of `src/lib/gemini.ts` needs to resolve against the project, and Node ESM resolves
relative imports against the importing file's own location, not the process's working
directory) to sanity-check the call shape. This mirrors the `*.tmp.js` scratch-script
pattern already used elsewhere in this project — create it, run it, delete it, never
commit it:

```bash
cat > gemini-smoke-test.tmp.mjs << 'EOF'
import { config } from "dotenv";
config({ path: ".env.local" });
const { parseExpenseTranscript } = await import("./src/lib/gemini.ts");

const result = await parseExpenseTranscript("I spent 500 rupees on groceries yesterday", {
  categories: [{ id: "cat-1", name: "Groceries" }, { id: "cat-2", name: "Transport" }],
  members: [{ id: "mem-1", name: "Nirjal" }, { id: "mem-2", name: "Karuna" }],
  today: "2026-08-30",
});
console.log(JSON.stringify(result, null, 2));
EOF
npx tsx gemini-smoke-test.tmp.mjs
```

Expected: prints a JSON object with `understood: true`, `amount: 500`, `categoryId: "cat-1"`,
`date` resolved to the day before 2026-08-30 (i.e. `"2026-08-29"`), and both member/owner
fields set to valid values from the given lists.

If this fails, check: is `GEMINI_API_KEY` actually set in `.env.local`? Does the error
message indicate a different method/parameter shape than what's used above (the Gemini
SDK does change occasionally — fix `src/lib/gemini.ts` to match whatever the actual error
says, not this plan, since the plan was last verified before this task ran)?

Delete the scratch script once it passes: `rm gemini-smoke-test.tmp.mjs`

- [ ] **Step 3: Commit**

```bash
git add src/lib/gemini.ts
git commit -m "feat: add Gemini client wrapper for parsing expense transcripts"
```

---

### Task 4: Server Action tying it together

**Files:**
- Create: `src/modules/voice-entry/api/voice-entry.actions.ts`

- [ ] **Step 1: Write the implementation**

Create `src/modules/voice-entry/api/voice-entry.actions.ts`:

```ts
"use server";

import { parseExpenseTranscript } from "@/lib/gemini";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { listCategories } from "@/modules/categories/api/categories";
import { sanitizeVoiceExpense, type VoiceParseResult } from "@/modules/voice-entry/lib/sanitize-voice-expense";

export async function parseVoiceEntryAction(transcript: string): Promise<VoiceParseResult> {
  const { householdId, memberId } = await getCurrentMember();
  const [categories, members] = await Promise.all([listCategories(householdId), getHouseholdMembers(householdId)]);

  if (categories.length === 0 || members.length === 0) {
    return { ok: false, reason: "not_understood" };
  }

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  const memberOptions = members.map((m) => ({ id: m.id, name: m.user.name }));

  try {
    const raw = await parseExpenseTranscript(transcript, {
      categories: categoryOptions,
      members: memberOptions,
      today: new Date().toISOString().slice(0, 10),
    });
    return sanitizeVoiceExpense(raw, {
      categories: categoryOptions,
      currentMemberId: memberId,
      members: memberOptions,
    });
  } catch {
    return { ok: false, reason: "not_understood" };
  }
}
```

> Note: both the empty-household guard and a thrown Gemini error return `reason:
> "not_understood"` here, collapsing what the spec calls `"parse_error"` into the same
> reason — **this is intentionally simplified from the spec.** The UI in Task 6 treats
> both reasons identically anyway (transcript shown, retry + manual-add), so a single
> reason is simpler with no behavior difference. If a future need arises to show a
> different message for network failures specifically, split this back into two reasons.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/voice-entry/api/voice-entry.actions.ts
git commit -m "feat: add parseVoiceEntryAction server action"
```

---

### Task 5: Let `AddExpenseModal` accept pre-filled initial values

**Files:**
- Modify: `src/modules/expenses/components/AddExpenseModal.tsx`

- [ ] **Step 1: Add the optional `initial` prop**

Replace the full contents of `src/modules/expenses/components/AddExpenseModal.tsx` with:

```tsx
"use client";

import { Receipt } from "lucide-react";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/Modal";
import { ExpenseForm } from "@/modules/expenses/components/ExpenseForm";

type Props = {
  categories: { groupName: string; id: string; name: string }[];
  currentMemberId: string;
  initial?: {
    amount: number;
    categoryId: string;
    date: string;
    note: string | null;
    ownerMemberId: string | null;
    paidByMemberId: string;
  };
  members: { id: string; name: string }[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AddExpenseModal({ categories, currentMemberId, initial, members, onOpenChange, open }: Props) {
  const router = useRouter();

  return (
    <Modal icon={Receipt} onOpenChange={onOpenChange} open={open} title="Add Expense" tone="pink">
      <ExpenseForm
        categories={categories}
        currentMemberId={currentMemberId}
        initial={initial}
        members={members}
        onSuccess={() => {
          onOpenChange(false);
          router.refresh();
        }}
      />
    </Modal>
  );
}
```

This is the only change — `initial` is optional and threaded straight through to
`ExpenseForm`, which already has full support for it (used today by `EditExpenseModal`).
Every existing caller of `AddExpenseModal` (which doesn't pass `initial`) is unaffected.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/expenses/components/AddExpenseModal.tsx
git commit -m "feat: let AddExpenseModal accept pre-filled initial values"
```

---

### Task 6: Speech recognition hook

**Files:**
- Create: `src/lib/useSpeechRecognition.ts`

- [ ] **Step 1: Write the implementation**

Create `src/lib/useSpeechRecognition.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionErrorReason = "no-speech" | "not-allowed" | "other";

type State = {
  error: SpeechRecognitionErrorReason | null;
  interimTranscript: string;
  isListening: boolean;
  transcript: string;
};

const INITIAL_STATE: State = {
  error: null,
  interimTranscript: "",
  isListening: false,
  transcript: "",
};

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | undefined {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [state, setState] = useState<State>(INITIAL_STATE);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setState({ ...INITIAL_STATE, error: "other" });
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setState((s) => ({ ...s, interimTranscript: interim, transcript: finalTranscript }));
    };

    recognition.onerror = (event) => {
      const reason: SpeechRecognitionErrorReason =
        event.error === "no-speech" ? "no-speech" : event.error === "not-allowed" ? "not-allowed" : "other";
      setState((s) => ({ ...s, error: reason, isListening: false }));
    };

    recognition.onend = () => {
      setState((s) => ({ ...s, isListening: false }));
    };

    recognitionRef.current = recognition;
    setState({ ...INITIAL_STATE, isListening: true });
    recognition.start();
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { ...state, start, stop };
}
```

`@types/dom-speech-recognition` (installed in Task 1) provides the `SpeechRecognition`
type and the `window.SpeechRecognition`/`window.webkitSpeechRecognition` globals used
above — no `any` needed.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors. If `SpeechRecognition` is reported as an unknown type, confirm
`@types/dom-speech-recognition` installed correctly in Task 1 and that TypeScript is
picking it up (it augments global types automatically once installed — no `tsconfig`
change needed).

- [ ] **Step 3: Commit**

```bash
git add src/lib/useSpeechRecognition.ts
git commit -m "feat: add useSpeechRecognition hook wrapping the browser Web Speech API"
```

---

### Task 7: VoiceEntryModal (Listening → Parsing → Error state machine)

**Files:**
- Create: `src/modules/voice-entry/components/VoiceEntryModal.tsx`

- [ ] **Step 1: Write the implementation**

Create `src/modules/voice-entry/components/VoiceEntryModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { Mic, Square } from "lucide-react";

import { Modal } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { isSpeechRecognitionSupported, useSpeechRecognition } from "@/lib/useSpeechRecognition";
import { parseVoiceEntryAction } from "@/modules/voice-entry/api/voice-entry.actions";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

type Stage =
  | { type: "error"; message: string; transcript: string }
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
    if (!open) return;

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
      setStage({ message: PERMISSION_DENIED_MESSAGE, transcript: "", type: "error" });
    }
  }, [speech.error]);

  async function handleStop() {
    speech.stop();
    const transcript = speech.transcript.trim();
    if (!transcript) {
      setStage({ message: "Didn't catch anything — try again.", transcript: "", type: "error" });
      return;
    }

    setStage({ type: "parsing" });
    const result = await parseVoiceEntryAction(transcript);
    if (result.ok) {
      onParsed(result.draft);
    } else {
      setStage({ message: NOT_UNDERSTOOD_MESSAGE, transcript, type: "error" });
    }
  }

  async function handleRetryParse(transcript: string) {
    setStage({ type: "parsing" });
    const result = await parseVoiceEntryAction(transcript);
    if (result.ok) {
      onParsed(result.draft);
    } else {
      setStage({ message: NOT_UNDERSTOOD_MESSAGE, transcript, type: "error" });
    }
  }

  function handleRestart() {
    setStage({ type: "listening" });
    speech.start();
  }

  return (
    <Modal icon={Mic} onOpenChange={(next) => !next && onClose()} open={open} title="Add by Voice" tone="pink">
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
          {stage.transcript && <p className="rounded-lg bg-muted p-3 text-sm italic">"{stage.transcript}"</p>}
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/voice-entry/components/VoiceEntryModal.tsx
git commit -m "feat: add VoiceEntryModal listening/parsing/error state machine"
```

---

### Task 8: VoiceEntryButton (the trigger + result modal)

**Files:**
- Create: `src/modules/voice-entry/components/VoiceEntryButton.tsx`

- [ ] **Step 1: Write the implementation**

Create `src/modules/voice-entry/components/VoiceEntryButton.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { Mic } from "lucide-react";

import { isSpeechRecognitionSupported } from "@/lib/useSpeechRecognition";
import { cn } from "@/lib/utils";
import { AddExpenseModal } from "@/modules/expenses/components/AddExpenseModal";
import { VoiceEntryModal } from "@/modules/voice-entry/components/VoiceEntryModal";
import type { ExpenseDraft } from "@/modules/voice-entry/lib/sanitize-voice-expense";

type Category = { groupName: string; id: string; name: string };
type Member = { id: string; name: string };

type Props = {
  categories: Category[];
  className?: string;
  currentMemberId: string;
  members: Member[];
};

export function VoiceEntryButton({ categories, className, currentMemberId, members }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [manualAddOpen, setManualAddOpen] = useState(false);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const resultModalOpen = draft !== null || manualAddOpen;

  function closeResultModal() {
    setDraft(null);
    setManualAddOpen(false);
  }

  return (
    <>
      <button
        aria-label="Add expense by voice"
        className={cn(className, !supported && "cursor-not-allowed opacity-50")}
        disabled={!supported}
        onClick={() => setListening(true)}
        title={supported ? undefined : "Voice input isn't supported in this browser"}
        type="button"
      >
        <Mic className="h-5 w-5" />
      </button>

      <VoiceEntryModal
        onClose={() => setListening(false)}
        onManualAdd={() => {
          setListening(false);
          setManualAddOpen(true);
        }}
        onParsed={(parsed) => {
          setListening(false);
          setDraft(parsed);
        }}
        open={listening}
      />

      {resultModalOpen && (
        <AddExpenseModal
          categories={categories}
          currentMemberId={currentMemberId}
          initial={draft ?? undefined}
          members={members}
          onOpenChange={(open) => {
            if (!open) closeResultModal();
          }}
          open
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/voice-entry/components/VoiceEntryButton.tsx
git commit -m "feat: add VoiceEntryButton trigger component"
```

---

### Task 9: Wire the button into both nav bars

**Files:**
- Modify: `src/components/nav/SidebarNav.tsx`
- Modify: `src/components/nav/BottomNav.tsx`

- [ ] **Step 1: Add to `SidebarNav.tsx`**

In `src/components/nav/SidebarNav.tsx`, add the import (alongside the other `@/modules/...` import):

```tsx
import { VoiceEntryButton } from "@/modules/voice-entry/components/VoiceEntryButton";
```

Then find the existing Add Expense `<Button>` block:

```tsx
      <Button
        className="mb-4"
        onClick={() => setAddExpenseOpen(true)}
        size={collapsed ? "icon" : "lg"}
        title={collapsed ? "Add Expense" : undefined}
      >
        {collapsed ? <Plus className="h-4 w-4" /> : "+ Add Expense"}
      </Button>
```

Replace it with the same button plus the voice trigger right after it:

```tsx
      <Button
        className="mb-2"
        onClick={() => setAddExpenseOpen(true)}
        size={collapsed ? "icon" : "lg"}
        title={collapsed ? "Add Expense" : undefined}
      >
        {collapsed ? <Plus className="h-4 w-4" /> : "+ Add Expense"}
      </Button>
      <VoiceEntryButton
        categories={categories}
        className={cn(
          "mb-4 flex h-9 items-center justify-center gap-2 rounded-lg border border-input text-sm text-muted-foreground hover:bg-accent",
          collapsed ? "w-9" : "w-full",
        )}
        currentMemberId={currentMemberId}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
      />
```

This uses the `categories`/`currentMemberId`/`members` props `SidebarNav` already
receives — no new data fetching needed. `cn` is already imported in this file.

- [ ] **Step 2: Add to `BottomNav.tsx`**

In `src/components/nav/BottomNav.tsx`, add the import:

```tsx
import { VoiceEntryButton } from "@/modules/voice-entry/components/VoiceEntryButton";
```

Find the existing floating Add Expense button:

```tsx
      <button
        aria-label="Add Expense"
        className="fixed right-4 bottom-20 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        onClick={() => setAddExpenseOpen(true)}
        type="button"
      >
        <Plus className="h-6 w-6" />
      </button>
```

Add the voice button stacked above it:

```tsx
      <button
        aria-label="Add Expense"
        className="fixed right-4 bottom-20 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
        onClick={() => setAddExpenseOpen(true)}
        type="button"
      >
        <Plus className="h-6 w-6" />
      </button>
      <VoiceEntryButton
        categories={categories}
        className="fixed right-4 bottom-36 z-10 flex h-11 w-11 items-center justify-center rounded-full border bg-background text-foreground shadow-lg md:hidden"
        currentMemberId={currentMemberId}
        members={members}
      />
```

`BottomNav` already receives `categories`/`currentMemberId`/`members` as props — no
new data fetching needed here either.

- [ ] **Step 3: Typecheck and build**

Run:
```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`

Expected: all tests pass (the 10 new sanitize-voice-expense tests plus every existing test).

- [ ] **Step 5: Commit**

```bash
git add src/components/nav/SidebarNav.tsx src/components/nav/BottomNav.tsx
git commit -m "feat: wire VoiceEntryButton into sidebar and mobile nav"
```

---

### Task 10: Manual end-to-end verification

This can't be automated — Playwright cannot simulate real speech into the browser's
`SpeechRecognition` API (fake/virtual microphone devices produce silence, not speech).
Verify by hand, following the pattern already used elsewhere in this project: a
disposable local Postgres via Docker, never the real database.

- [ ] **Step 1: Spin up a disposable test database**

```bash
docker run -d --name piko-voice-test-pg -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=postgres -p 55433:5432 postgres:16-alpine
```

- [ ] **Step 2: Point `.env.local` at it temporarily (back up the real one first)**

```bash
cp .env.local .env.local.real-backup
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://postgres:testpass@localhost:55433/postgres"
AUTH_SECRET="k7kC6GuUyw9oEV7vq5gSn+T3k1zegXQOJn56sFwOj0k="
GEMINI_API_KEY="<your real Gemini key>"

SEED_HOUSEHOLD_NAME="Nirjal & Karuna"
SEED_USER1_EMAIL="n@nirjal.com"
SEED_USER1_PASSWORD="1234"
SEED_USER1_NAME="Nirjal"
SEED_USER2_EMAIL="k@karuna.com"
SEED_USER2_PASSWORD="1234"
SEED_USER2_NAME="Karuna"
EOF
npx drizzle-kit push --force
npm run db:seed
```

- [ ] **Step 3: Start the dev server and test in a real browser**

```bash
npm run dev
```

Open `http://localhost:3000/login` in **Chrome or Edge** (Firefox doesn't support
`SpeechRecognition`), log in as `n@nirjal.com` / `1234`, then:

1. Click the mic button (in the sidebar on desktop, or the floating mic button on a
   narrow/mobile viewport). Grant microphone permission when prompted.
2. Say something like "I spent five hundred rupees on groceries yesterday."
3. Click Stop.
4. Expected: after a brief "Understanding..." pause, the Add Expense modal opens with
   amount, category, date, and owner/paid-by pre-filled matching what you said.
5. Adjust anything that's wrong (this is exactly what the confirm-before-save step is
   for) and click Save — expected: the expense appears in the table.
6. Try an unrelated sentence (e.g. "what's the weather like") — expected: an error
   state appears with the transcript shown and a "couldn't catch that as an expense"
   message, with "Try again", "Retry parsing", and "Add manually instead" options.
7. Click "Add manually instead" — expected: the Add Expense modal opens empty (no
   pre-filled values), same as clicking the regular Add Expense button.
8. Try denying microphone permission (browser site settings) and clicking the mic
   button again — expected: the permission-denied message appears.

- [ ] **Step 4: Tear down and restore your real environment**

```bash
docker rm -f piko-voice-test-pg
cp .env.local.real-backup .env.local
rm .env.local.real-backup
```

- [ ] **Step 5: Note any issues found**

If anything in Step 3 didn't match expectations, fix the relevant file from Tasks 2-9,
re-verify, and commit the fix separately — don't silently patch without a commit,
since this is the step that catches real integration bugs the earlier unit tests and
typechecks can't.
