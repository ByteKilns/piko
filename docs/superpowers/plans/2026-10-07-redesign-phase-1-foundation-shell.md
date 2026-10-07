# Modernist Redesign — Phase 1: Foundation & Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the modernist visual system in place: palette, restyled primitives, shared composites, sidebar, bottom nav, page frame, loading/error, Login. Remove the accent picker. Existing pages keep working on the new palette until later phases rebuild them.

**Architecture:** Re-theme the shadcn primitives in place through CSS tokens (`--radius: 0`, new palette mapped onto the shadcn variables) and targeted class edits. Then add a small set of shared composites in `src/components/` that phases 3–5 build pages from. Pure logic (money splitting, meter widths, month navigation, the N shortcut) lives in `src/lib/` with Vitest tests. Components are verified with Playwright and a temporary `/design-kit` preview page.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (CSS-first `@theme`, container queries), shadcn/radix, lucide-react, Vitest (node env), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-modernist-redesign-design.md` (sections 1, 2, 4.6 and 6, phase 1)

## Global Constraints

- Branch `redesign/modernist`. **No commits until Task 12.** The user agreed to one commit per phase. Every other task ends with verification, not a commit.
- The pre-commit hook runs `npx tsc --noEmit` then `npm run build`. Never use `--no-verify`.
- `AGENTS.md`: this is Next.js 16. Before using any Next API you haven't used in this repo, read the matching guide in `node_modules/next/dist/docs/`.
- Ordering is enforced by ESLint (perfectionist). Imports go react → third-party → `@/…` with a blank line between groups, alphabetical within each group. Named specifiers, object-type properties and JSX props are alphabetical. Run `npm run lint -- --fix` after each task.
- File naming: component files PascalCase, lib files kebab-case, hooks `useX.ts`.
- Palette values (light): paper `#faf8f4`, surface `#f0ede7`, ink `#201e1d`, rule `#3d3936`, n-200 `#e6e2db`, n-300 `#d8d3cb`, n-400 `#b5afa6`, n-500 `#8f8981`, n-600 `#6e6862`, n-700 `#56514c`, n-800 `#3d3936`, signal `#d23a24`, signal-ink `#a82a18`.
- Palette values (dark): paper `#161413`, surface `#22201e`, ink `#f3efe8`, rule `#d3cec6`, n-200 `#2a2725`, n-300 `#3a3633`, n-400 `#57524d`, n-500 `#7a746d`, n-600 `#9a948c`, n-700 `#b7b1a9`, n-800 `#d3cec6`, signal `#ef5a42`, signal-ink `#ff8a73`.
- Radius 0 everywhere. Shadows only on menus (`shadow-menu`) and dialogs (`shadow-dialog`).
- Amounts: `en-US` grouping, minus sign `−` (U+2212), always two decimals.
- Container breakpoints (against the page's `@container`): **560px** and **780px**.
- Font stays Host Grotesk. Weights used: 400 / 600 / 800.
- Class names in this plan use pixel values from the mockups (e.g. `h-[38px]`). Where Tailwind has an exact equivalent on its 4px scale, write that instead (`h-9.5`, `py-4.5`, `space-y-5.5`, `sm:max-w-120`, `min-w-45`); the editor's Tailwind IntelliSense flags each one. Values that aren't on the scale (`text-[15px]`, `tracking-[-0.02em]`) stay arbitrary.
- After code changes, run `graphify update .` (done once in Task 12).

## Review Focus

1. **Chrome autofill fires `keydown` with no `key`.** The N shortcut must ignore it rather than throw. Test in Task 7.
2. **A budget of 0 with spending gives `ratio = Infinity`.** The meter must show a full red bar, not an empty one. `NaN` (0/0) shows empty. Test in Task 4.
3. **Pasted or odd amount text** (`"Rs 1,500.50"`, `"1.2.3"`, `"12.345"`) must sanitise to a valid two-place number string. Test in Task 4.
4. **Rounding at the edges:** `−0.004` must display `0.00`, not `−0.00`, and a `NaN` amount must display `0.00` instead of "NaN". Test in Task 4.
5. **Month navigation across a year boundary** (month 1 ↔ 12), and a selected month older than the 12-month menu. Prev/next must link to the right year, and the menu must not mark a wrong month as selected. Test in Task 5.

---

### Task 1: Palette tokens and accent-picker removal

**Files:**
- Modify: `src/app/globals.css` (full rewrite)
- Modify: `src/app/layout.tsx`
- Modify: `src/modules/settings/api/settings.actions.ts`
- Modify: `src/modules/settings/components/ThemeSection.tsx` (full rewrite)
- Modify: `src/modules/settings/pages/SettingsPage.tsx`
- Delete: `src/lib/accent-color-cookie.ts`
- Modify: `docs/architecture.md:147`

**Interfaces:**
- Produces Tailwind colours `paper, surface, ink, rule, n-200 … n-800, signal, signal-ink`, shadows `shadow-menu`, `shadow-dialog`, and the utility `micro-label` (size, weight, tracking and case only; **no colour**, so callers add `text-n-600` or `text-ink`).
- shadcn variables keep their names (`--background`, `--primary`, …) and now point at the palette, so not-yet-migrated pages pick it up.

- [ ] **Step 1: Replace `src/app/globals.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: var(--font-host-grotesk), sans-serif;
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);

  /* Modernist palette — spec §1.1 (docs/superpowers/specs/2026-10-07-modernist-redesign-design.md) */
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-ink: var(--ink);
  --color-rule: var(--rule);
  --color-n-200: var(--n-200);
  --color-n-300: var(--n-300);
  --color-n-400: var(--n-400);
  --color-n-500: var(--n-500);
  --color-n-600: var(--n-600);
  --color-n-700: var(--n-700);
  --color-n-800: var(--n-800);
  --color-signal: var(--signal);
  --color-signal-ink: var(--signal-ink);
  --shadow-menu: var(--elevation-menu);
  --shadow-dialog: var(--elevation-dialog);

  /* shadcn tokens, pointed at the palette in :root below */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --color-surface-secondary: var(--surface-secondary);
  --color-surface-featured: var(--surface-featured);
  --color-surface-positive: var(--surface-positive);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
  --paper: #faf8f4;
  --surface: #f0ede7;
  --ink: #201e1d;
  --rule: #3d3936;
  --n-200: #e6e2db;
  --n-300: #d8d3cb;
  --n-400: #b5afa6;
  --n-500: #8f8981;
  --n-600: #6e6862;
  --n-700: #56514c;
  --n-800: #3d3936;
  --signal: #d23a24;
  --signal-ink: #a82a18;
  --elevation-menu: 0 4px 16px rgb(32 30 29 / 0.12);
  --elevation-dialog: 0 16px 48px rgb(32 30 29 / 0.22);

  --background: var(--paper);
  --foreground: var(--ink);
  --card: var(--paper);
  --card-foreground: var(--ink);
  --popover: var(--paper);
  --popover-foreground: var(--ink);
  --primary: var(--ink);
  --primary-foreground: var(--paper);
  --secondary: var(--surface);
  --secondary-foreground: var(--ink);
  --muted: var(--surface);
  --muted-foreground: var(--n-600);
  --accent: color-mix(in srgb, var(--ink) 6%, transparent);
  --accent-foreground: var(--ink);
  --destructive: var(--signal-ink);
  --border: var(--n-300);
  --input: var(--n-400);
  --ring: var(--signal);
  --radius: 0rem;
  --sidebar: var(--paper);
  --sidebar-foreground: var(--ink);
  --sidebar-primary: var(--ink);
  --sidebar-primary-foreground: var(--paper);
  --sidebar-accent: var(--surface);
  --sidebar-accent-foreground: var(--ink);
  --sidebar-border: var(--rule);
  --sidebar-ring: var(--signal);
  /* Retired in phase 6. Remapped so pages not yet redesigned sit on the new palette. */
  --surface-secondary: var(--surface);
  --surface-featured: var(--surface);
  --surface-positive: var(--surface);
  --chart-1: var(--n-300);
  --chart-2: var(--n-500);
  --chart-3: var(--n-600);
  --chart-4: var(--n-700);
  --chart-5: var(--ink);
}

/* next-themes puts .dark on <html> (the :root element), so every variable
   derived above resolves against these values in dark mode. */
.dark {
  --paper: #161413;
  --surface: #22201e;
  --ink: #f3efe8;
  --rule: #d3cec6;
  --n-200: #2a2725;
  --n-300: #3a3633;
  --n-400: #57524d;
  --n-500: #7a746d;
  --n-600: #9a948c;
  --n-700: #b7b1a9;
  --n-800: #d3cec6;
  --signal: #ef5a42;
  --signal-ink: #ff8a73;
  --elevation-menu: 0 4px 16px rgb(0 0 0 / 0.45);
  --elevation-dialog: 0 16px 48px rgb(0 0 0 / 0.6);
}

/* The small uppercase label above every figure and column. Colour is left
   to the caller (usually text-n-600) so it can switch to ink when selected. */
@utility micro-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1.3;
  text-transform: uppercase;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
  /* Tailwind's Preflight resets button cursor to the browser default
     (arrow) rather than pointer — every Button and TabsTrigger in the app
     renders as a native <button>, so this one rule covers both. */
  button:not(:disabled) {
    cursor: pointer;
  }
}
```

- [ ] **Step 2: Remove the accent from `src/app/layout.tsx`**

Delete these lines:
- `import { cookies } from "next/headers";`
- `import { ACCENT_COLOR_COOKIE_NAME, isAccentColor } from "@/lib/accent-color-cookie";`
- the three lines that read the cookie (`const cookieStore = …`, `const accentCookie = …`, `const accent = …`)
- the `data-accent={accent}` attribute on `<html>`

Change `export default async function RootLayout` to `export default function RootLayout`. The body is otherwise unchanged.

- [ ] **Step 3: Remove `setAccentColorAction`**

In `src/modules/settings/api/settings.actions.ts`, delete:
- the whole `export async function setAccentColorAction(color: string) { … }` block
- the import line `import { ACCENT_COLOR_COOKIE_NAME, isAccentColor } from "@/lib/accent-color-cookie";`

Then run `grep -n "cookies" src/modules/settings/api/settings.actions.ts`. If the only hit is the `import { cookies } from "next/headers";` line, delete that line too.

- [ ] **Step 4: Replace `src/modules/settings/components/ThemeSection.tsx`**

```tsx
"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MODES = [
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
  { icon: Monitor, label: "System", value: "system" },
] as const;

export function ThemeSection() {
  const { setTheme, theme } = useTheme();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Theme</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-sm font-medium text-foreground">Appearance</p>
        <div className="flex gap-2">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const active = (theme ?? "system") === mode.value;
            return (
              <button
                className={`flex flex-1 items-center justify-center gap-2 border px-3 py-2 text-sm ${
                  active ? "border-ink bg-ink font-semibold text-paper" : "border-n-400 text-n-700"
                }`}
                key={mode.value}
                onClick={() => setTheme(mode.value)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {mode.label}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Update `src/modules/settings/pages/SettingsPage.tsx`**

Remove the imports `import { cookies } from "next/headers";` and `import { ACCENT_COLOR_COOKIE_NAME, isAccentColor } from "@/lib/accent-color-cookie";`. Replace the data loading and accent lines with:

```tsx
  const [[user], dateFormat, canPublishReleases] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    getDateFormatPref(householdId),
    isReleaseAdmin(),
  ]);
  const releases = canPublishReleases ? await listReleases() : [];
```

Delete the `accentCookie` and `accent` constants, and render `<ThemeSection />` with no props.

- [ ] **Step 6: Delete the cookie helper and update the docs**

Run `git rm src/lib/accent-color-cookie.ts`. In `docs/architecture.md` line 147, change ``(all in `src/lib/*-cookie.ts`): `accent-color`, `date-format`,`` to ``(all in `src/lib/*-cookie.ts`): `date-format`,``.

- [ ] **Step 7: Verify**

Run: `grep -rn "accent-color-cookie\|setAccentColorAction\|data-accent\|ACCENT_COLOR" src docs/architecture.md`
Expected: no output.

Run: `npx tsc --noEmit`
Expected: exit 0.

Run `npm run dev`, then open `http://localhost:3000/categories` and `/settings`. Pages render on a warm off-white background with square corners. Settings → Theme shows only Light/Dark/System, and Dark switches to the dark palette.

---

### Task 2: Restyle the shadcn primitives

**Files:**
- Modify: `src/components/ui/button.tsx` (full rewrite of `buttonVariants`)
- Modify: `src/components/ui/input.tsx` (full rewrite)
- Modify: `src/components/ui/label.tsx` (class string)
- Modify: `src/components/ui/select.tsx`, `dropdown-menu.tsx`, `popover.tsx`, `sheet.tsx`, `card.tsx`, `avatar.tsx`, `sonner.tsx`

**Interfaces:**
- Produces `Button` with the same variant names as today (`default` ink fill, `outline` 1px ink border, `secondary` surface fill, `ghost`, `destructive` red outline, `link`) and sizes (`default` 36px, `lg` 40px, `sm` 32px, `xs`, `icon` 36px, `icon-sm` 32px, `icon-lg` 40px, `icon-xs`). No call sites change.

- [ ] **Step 1: Replace `buttonVariants` in `src/components/ui/button.tsx`**

```tsx
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border border-transparent text-sm font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper hover:bg-ink/85",
        outline: "border-ink bg-transparent text-ink hover:bg-ink/[0.06] aria-expanded:bg-ink/[0.06]",
        secondary: "bg-surface text-ink hover:bg-n-200 aria-expanded:bg-n-200",
        ghost: "text-ink hover:bg-ink/[0.07] aria-expanded:bg-ink/[0.07]",
        destructive: "border-signal-ink bg-transparent text-signal-ink hover:bg-signal/10",
        link: "text-signal-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-2.5 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

- [ ] **Step 2: Replace `src/components/ui/input.tsx`**

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-[38px] w-full min-w-0 border border-n-400 bg-transparent px-3 text-[15px] text-ink transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-n-500 hover:border-ink focus-visible:border-ink focus-visible:shadow-[inset_0_-2px_0_var(--signal)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-signal-ink",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  )
}

export { Input }
```

- [ ] **Step 3: Restyle the label**

In `src/components/ui/label.tsx`, replace `"flex items-center gap-2 text-sm leading-none font-medium select-none` with `"flex items-center gap-2 text-xs leading-none font-normal text-n-700 select-none`. The rest of the string stays.

- [ ] **Step 4: Menus, popover, select, sheet, card, avatar, toasts**

Run these from the repo root:

```bash
sed -i -E 's/shadow-(md|lg) ring-1 ring-foreground\/10/shadow-menu ring-1 ring-rule/g' src/components/ui/dropdown-menu.tsx src/components/ui/popover.tsx src/components/ui/select.tsx
sed -i 's/ring-1 ring-foreground\/10/border-t-2 border-rule/' src/components/ui/sheet.tsx
sed -i 's/ring-1 ring-foreground\/10/ring-1 ring-n-300/' src/components/ui/card.tsx
sed -i 's/rounded-full/rounded-none/g' src/components/ui/avatar.tsx
sed -i 's/gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden/gap-2.5 px-3.5 py-2 text-sm outline-hidden/' src/components/ui/dropdown-menu.tsx
sed -i 's/data-\[size=default\]:h-8/data-[size=default]:h-[38px]/; s/focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring\/50/focus-visible:border-ink focus-visible:shadow-[inset_0_-2px_0_var(--signal)]/' src/components/ui/select.tsx
sed -i 's/"--normal-border": "var(--border)"/"--normal-border": "var(--rule)"/' src/components/ui/sonner.tsx
```

- [ ] **Step 5: Verify**

Run: `grep -rn "ring-foreground/10" src/components/ui/ | grep -v dialog.tsx`
Expected: no output. (`dialog.tsx` is rewritten in Task 3.)

Run: `grep -c "rounded-full" src/components/ui/avatar.tsx`
Expected: `0`.

Run: `npx tsc --noEmit && npm run lint`
Expected: exit 0.

With `npm run dev` running, on `/expenses` the header buttons are square, the primary button is ink, and the ⋯ row menus open as square panels with a thin dark border.

---

### Task 3: Dialog frame and `Modal`

**Files:**
- Modify: `src/components/ui/dialog.tsx` (full rewrite)
- Modify: `src/components/Modal.tsx` (full rewrite)
- Modify (remove the `icon=` and `tone=` props): `src/modules/activity/components/RevertButton.tsx`, `src/modules/budget/components/BudgetGroups.tsx`, `src/modules/categories/components/CategoryFormModal.tsx`, `src/modules/dhuku/components/DhukuEntryForm.tsx`, `src/modules/dhuku/components/DhukuForm.tsx`, `src/modules/expenses/components/AddExpenseModal.tsx`, `src/modules/expenses/components/BulkAddExpenseModal.tsx`, `src/modules/expenses/components/EditExpenseModal.tsx`, `src/modules/loans/components/LoanForm.tsx`, `src/modules/loans/components/LoanPaymentForm.tsx`, `src/modules/recurring/components/RecurringForm.tsx`, `src/modules/savings-goals/components/ContributionForm.tsx`, `src/modules/savings-goals/components/GoalForm.tsx`, `src/modules/voice-entry/components/VoiceEntryModal.tsx`

**Interfaces:**
- Produces `Modal` props `{ bodyClassName?, children, className?, footer?, onOpenChange, open, subtitle?: string, title }`.
- `icon` and `tone` are removed.
- When `footer` is given, `Modal` appends a **Cancel** button (`DialogClose`) after it, so callers must not render their own Cancel.
- Deferred: the footer hint "Enter to save · Esc to close" (spec §2.4) is added in phase 3, together with the first dialog that actually submits on Enter. It would be wrong on dialogs like Revert.

- [ ] **Step 1: Replace `src/components/ui/dialog.tsx`**

```tsx
"use client"

import * as React from "react"

import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 isolate z-50 bg-[rgb(32_30_29/0.45)] duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 dark:bg-black/60",
        className
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100%-3rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden bg-popover text-sm text-popover-foreground shadow-dialog duration-100 outline-none sm:max-w-[480px] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        data-slot="dialog-content"
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close asChild data-slot="dialog-close">
            <Button className="absolute top-3 right-3" size="icon-sm" variant="ghost">
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-between gap-3 border-b-2 border-rule bg-popover px-6 py-[18px]", className)}
      data-slot="dialog-header"
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      className={cn("flex shrink-0 flex-wrap items-center gap-2 border-t border-n-300 bg-popover px-6 py-4", className)}
      data-slot="dialog-footer"
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-xl leading-tight font-extrabold tracking-[-0.01em]", className)}
      data-slot="dialog-title"
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-[13px] text-n-600", className)}
      data-slot="dialog-description"
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
```

- [ ] **Step 2: Replace `src/components/Modal.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  bodyClassName?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  subtitle?: string;
  title: string;
};

// Every modal in the app should go through this component instead of
// reassembling Dialog/DialogContent/DialogHeader/DialogFooter by hand —
// that's where the header rule, scrollable body and footer (primary action,
// then Cancel) live, in one place.
//
// `bodyClassName` is an escape hatch for content with its own floating
// overlay (e.g. a date picker that isn't portaled) that needs to render
// past the body's default `overflow-y-auto` instead of being clipped/
// trapped inside it — pass `overflow-visible` there (and cancel
// DialogContent's own `overflow-hidden` via `className`) to let it float
// over the dialog instead.
export function Modal({ bodyClassName, children, className, footer, onOpenChange, open, subtitle, title }: Props) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className={className} showCloseButton={false}>
        <DialogHeader>
          <div className="flex min-w-0 flex-col gap-0.5">
            <DialogTitle>{title}</DialogTitle>
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </div>
          <DialogClose asChild>
            <Button aria-label="Close" size="icon-sm" type="button" variant="ghost">
              <XIcon />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className={cn("min-h-0 flex-1 space-y-[22px] overflow-y-auto p-6", bodyClassName)}>{children}</div>

        {footer && (
          <DialogFooter>
            {footer}
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Drop `icon`/`tone` from the 14 call sites**

In each file listed under **Files**, delete the `icon={…}` and `tone="…"` props from its `<Modal …>` element. In `AddExpenseModal.tsx`, `EditExpenseModal.tsx` and `VoiceEntryModal.tsx` they're inline on one line, e.g. `<Modal icon={Receipt} onOpenChange={onOpenChange} open={open} title="Add Expense" tone="pink">` becomes `<Modal onOpenChange={onOpenChange} open={open} title="Add Expense">`.

- [ ] **Step 4: Remove `RevertButton`'s own Cancel**

In `src/modules/activity/components/RevertButton.tsx`, replace the `footer={ <> … </> }` prop with:

```tsx
        footer={
          <Button disabled={preview?.kind !== "apply" || isReverting} onClick={revert} type="button">
            {isReverting ? "Reverting..." : "Revert"}
          </Button>
        }
```

- [ ] **Step 5: Remove imports that are now unused**

Run:

```bash
npx tsc --noEmit --noUnusedLocals 2>&1 | grep -E "RevertButton|BudgetGroups|CategoryFormModal|DhukuEntryForm|DhukuForm|AddExpenseModal|BulkAddExpenseModal|EditExpenseModal|LoanForm|LoanPaymentForm|RecurringForm|ContributionForm|GoalForm|VoiceEntryModal"
```

For every icon reported as "declared but never read" (e.g. `Receipt`, `ListPlus`, `Wallet`, `List`, `Users`, `HandCoins`, `Repeat`, `PiggyBank`, `Target`, `Mic`), delete it from that file's `lucide-react` import. Keep icons still used elsewhere in the file (`RevertButton` still uses `Undo2` on its trigger). Re-run until the command prints nothing. Unused locals elsewhere in the repo aren't this task's concern.

- [ ] **Step 6: Verify**

Run: `grep -rn "tone=\|icon={" src --include=*.tsx | grep "<Modal"`
Expected: no output.

Run: `npx tsc --noEmit && npm run lint`
Expected: exit 0.

On `/expenses`, open the sidebar's Add expense. The dialog has a 20px bold title, a 2px rule under the header, a ✕ on the right, and a footer showing **Add Expense** then **Cancel**. Cancel and Esc both close it.

---

### Task 4: Money and meter helpers, `Money`, `Meter`, `Monogram`

**Files:**
- Create: `src/lib/money.ts`, `src/lib/money.test.ts`
- Create: `src/lib/meter.ts`, `src/lib/meter.test.ts`
- Create: `src/components/Money.tsx`, `src/components/Meter.tsx`, `src/components/Monogram.tsx`

**Interfaces:**
- Produces:
  - `splitAmount(value: number): { decimals: string; integer: string; negative: boolean }`
  - `formatMoney(value: number, opts?: { currency?: boolean }): string`, e.g. `"Rs −23,691.88"`
  - `sanitizeAmountInput(raw: string): string`
  - `meterWidths(ratio: number): { fill: number; over: number }` (percentages)
  - `<Money value size? ("row" | "cell" | "lead" | "hero") currency? tone? ("default" | "muted" | "negative") className? />`
  - `<Meter ratio? segments? ({ tone: "ink" | "partner" | "shared"; value: number }[]) label? className? />`
  - `<Monogram people ({ name: string; role: "me" | "partner" }[]) size? ("sm" | "md" | "lg") className? />`, exporting the type `MonogramPerson`

- [ ] **Step 1: Write the failing tests**

`src/lib/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatMoney, sanitizeAmountInput, splitAmount } from "./money";

describe("splitAmount", () => {
  it("groups rupees with commas and keeps two-digit paisa", () => {
    expect(splitAmount(179291.88)).toEqual({ decimals: ".88", integer: "179,291", negative: false });
  });

  it("pads whole amounts with .00", () => {
    expect(splitAmount(512)).toEqual({ decimals: ".00", integer: "512", negative: false });
  });

  it("rounds to the nearest paisa", () => {
    expect(splitAmount(2974.199)).toEqual({ decimals: ".20", integer: "2,974", negative: false });
  });

  it("flags negatives and keeps the sign out of the digits", () => {
    expect(splitAmount(-23691.88)).toEqual({ decimals: ".88", integer: "23,691", negative: true });
  });

  it("never shows a negative zero", () => {
    expect(splitAmount(-0.004)).toEqual({ decimals: ".00", integer: "0", negative: false });
  });

  it("shows zero for non-finite input instead of NaN", () => {
    expect(splitAmount(Number.NaN)).toEqual({ decimals: ".00", integer: "0", negative: false });
    expect(splitAmount(Number.POSITIVE_INFINITY)).toEqual({ decimals: ".00", integer: "0", negative: false });
  });
});

describe("formatMoney", () => {
  it("prefixes Rs and puts the minus after it", () => {
    expect(formatMoney(-23691.88)).toBe("Rs −23,691.88");
  });

  it("can leave the currency off", () => {
    expect(formatMoney(1500, { currency: false })).toBe("1,500.00");
  });
});

describe("sanitizeAmountInput", () => {
  it("drops currency text and thousands separators from pasted amounts", () => {
    expect(sanitizeAmountInput("Rs 1,500.50")).toBe("1500.50");
  });

  it("keeps only the first decimal point", () => {
    expect(sanitizeAmountInput("1.2.3")).toBe("1.23");
  });

  it("limits paisa to two places", () => {
    expect(sanitizeAmountInput("12.345")).toBe("12.34");
  });

  it("allows an amount that starts with the point", () => {
    expect(sanitizeAmountInput(".5")).toBe(".5");
  });

  it("returns an empty string when nothing numeric is left", () => {
    expect(sanitizeAmountInput("abc")).toBe("");
  });
});
```

`src/lib/meter.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { meterWidths } from "./meter";

describe("meterWidths", () => {
  it("fills proportionally up to 100%", () => {
    expect(meterWidths(0.5)).toEqual({ fill: 50, over: 0 });
    expect(meterWidths(1)).toEqual({ fill: 100, over: 0 });
  });

  it("splits ink and red past 100% so the bar keeps its length", () => {
    expect(meterWidths(2)).toEqual({ fill: 50, over: 50 });
    const widths = meterWidths(1.48);
    expect(widths.fill).toBeCloseTo(67.57, 2);
    expect(widths.over).toBeCloseTo(32.43, 2);
  });

  it("is empty for zero, negative or NaN ratios", () => {
    expect(meterWidths(0)).toEqual({ fill: 0, over: 0 });
    expect(meterWidths(-1)).toEqual({ fill: 0, over: 0 });
    expect(meterWidths(Number.NaN)).toEqual({ fill: 0, over: 0 });
  });

  it("is all red when something was spent against a zero budget", () => {
    expect(meterWidths(Number.POSITIVE_INFINITY)).toEqual({ fill: 0, over: 100 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/money.test.ts src/lib/meter.test.ts`
Expected: FAIL. The imports can't be resolved (`./money`, `./meter` don't exist).

- [ ] **Step 3: Implement the helpers**

`src/lib/money.ts`:

```ts
// Display helpers for amounts. The modernist design sets every figure as
// "Rs" + grouped rupees + smaller, lighter paisa, so the split lives here once.

export type AmountParts = { decimals: string; integer: string; negative: boolean };

const MINUS = "−";

export function splitAmount(value: number): AmountParts {
  // Work in whole paisa so -0.004 rounds to 0 (not "-0.00") and NaN/Infinity
  // from bad data render as 0.00 instead of leaking into the UI.
  const paisa = Number.isFinite(value) ? Math.round(value * 100) : 0;
  const [integer, decimals] = (Math.abs(paisa) / 100).toFixed(2).split(".");
  return { decimals: `.${decimals}`, integer: Number(integer).toLocaleString("en-US"), negative: paisa < 0 };
}

export function formatMoney(value: number, { currency = true }: { currency?: boolean } = {}): string {
  const { decimals, integer, negative } = splitAmount(value);
  return `${currency ? "Rs " : ""}${negative ? MINUS : ""}${integer}${decimals}`;
}

// Keeps what someone types or pastes into an amount field to digits and one
// decimal point with at most two places; everything else is dropped.
export function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  const fraction = cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return `${cleaned.slice(0, dot)}.${fraction}`;
}
```

`src/lib/meter.ts`:

```ts
// Widths (in %) for the 4px progress meter. Past 100% the bar keeps its full
// length: the budgeted share is drawn in ink and the overspend in red, so the
// red part grows with the overspend.
export type MeterWidths = { fill: number; over: number };

export function meterWidths(ratio: number): MeterWidths {
  // Spending against a zero budget divides to Infinity — that's all overspend.
  if (ratio === Number.POSITIVE_INFINITY) return { fill: 0, over: 100 };
  if (!Number.isFinite(ratio) || ratio <= 0) return { fill: 0, over: 0 };
  if (ratio <= 1) return { fill: ratio * 100, over: 0 };
  return { fill: 100 / ratio, over: 100 - 100 / ratio };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/money.test.ts src/lib/meter.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Create the three components**

`src/components/Money.tsx`:

```tsx
import { splitAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

type Size = "cell" | "hero" | "lead" | "row";
type Tone = "default" | "muted" | "negative";

const STYLES: Record<Size, { currency: string; decimals: string; integer: string; wrapper: string }> = {
  cell: {
    currency: "text-[13px] font-semibold text-n-600",
    decimals: "-ml-1 text-[15px] text-n-500",
    integer: "text-2xl leading-none font-semibold tracking-[-0.015em]",
    wrapper: "gap-[5px]",
  },
  hero: {
    currency: "text-[22px] font-semibold text-n-600",
    decimals: "-ml-1.5 text-[32px] font-semibold text-n-500",
    integer: "text-[76px] leading-[0.95] font-extrabold tracking-[-0.035em]",
    wrapper: "gap-2",
  },
  lead: {
    currency: "text-base font-semibold text-n-600",
    decimals: "-ml-[5px] text-xl font-semibold text-n-500",
    integer: "text-[40px] leading-none font-extrabold tracking-[-0.025em]",
    wrapper: "gap-1.5",
  },
  row: { currency: "mr-1 font-semibold text-n-600", decimals: "font-normal text-n-500", integer: "font-semibold", wrapper: "" },
};

const TONES: Record<Tone, string> = { default: "", muted: "text-n-600", negative: "text-signal-ink" };

type Props = { className?: string; currency?: boolean; size?: Size; tone?: Tone; value: number };

// An amount set the modernist way: "Rs", grouped rupees, then smaller and
// lighter paisa. `row` inherits its font size from the surrounding text and
// leaves "Rs" off unless asked.
export function Money({ className, currency, size = "row", tone = "default", value }: Props) {
  const { decimals, integer, negative } = splitAmount(value);
  const style = STYLES[size];
  const showCurrency = currency ?? size !== "row";

  return (
    <span className={cn("inline-flex items-baseline whitespace-nowrap tabular-nums", style.wrapper, className)}>
      {showCurrency && <span className={style.currency}>Rs</span>}
      <span className={cn(style.integer, TONES[tone])}>
        {negative ? "−" : ""}
        {integer}
      </span>
      <span className={style.decimals}>{decimals}</span>
    </span>
  );
}
```

`src/components/Meter.tsx`:

```tsx
import { meterWidths } from "@/lib/meter";
import { cn } from "@/lib/utils";

type Segment = { tone: "ink" | "partner" | "shared"; value: number };

const SEGMENT_TONES: Record<Segment["tone"], string> = { ink: "bg-ink", partner: "bg-n-600", shared: "bg-n-300" };

type Props = { className?: string; label?: string; ratio?: number; segments?: Segment[] };

// 4px bar. With `ratio` it is a progress meter (ink up to 100%, red for the
// overspend beyond it); with `segments` it is a stacked share bar (you /
// partner / shared). Pass `label` when the bar carries meaning on its own.
export function Meter({ className, label, ratio = 0, segments }: Props) {
  const a11y = label ? { "aria-label": label, role: "img" } : { "aria-hidden": true };

  if (segments) {
    return (
      <span className={cn("flex h-1 gap-0.5", className)} {...a11y}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment, i) => (
            <span className={SEGMENT_TONES[segment.tone]} key={`${segment.tone}-${i}`} style={{ flex: `${segment.value} 1 0` }} />
          ))}
      </span>
    );
  }

  const { fill, over } = meterWidths(ratio);
  return (
    <span className={cn("flex h-1 bg-n-200", className)} {...a11y}>
      <span className="bg-ink" style={{ width: `${fill}%` }} />
      <span className="bg-signal" style={{ width: `${over}%` }} />
    </span>
  );
}
```

`src/components/Monogram.tsx`:

```tsx
import { cn } from "@/lib/utils";

export type MonogramPerson = { name: string; role: "me" | "partner" };

const SIZES = { lg: "size-[22px] text-[11px]", md: "size-5 text-[11px]", sm: "size-[18px] text-[10px]" } as const;

type Props = { className?: string; people: MonogramPerson[]; size?: keyof typeof SIZES };

// Square initial badges: you in ink, your partner in grey. Shared items pass
// both people and the second badge overlaps the first.
export function Monogram({ className, people, size = "md" }: Props) {
  return (
    <span aria-hidden className={cn("flex shrink-0", className)}>
      {people.map((person, i) => (
        <span
          className={cn(
            "grid place-items-center font-semibold text-paper",
            SIZES[size],
            person.role === "me" ? "bg-ink" : "bg-n-600",
            i > 0 && "-ml-1 ring-2 ring-paper",
          )}
          key={`${person.role}-${person.name}`}
        >
          {person.name.trim().charAt(0).toUpperCase() || "?"}
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint -- --fix && npx vitest run src/lib/money.test.ts src/lib/meter.test.ts`
Expected: exit 0 and PASS. The components are checked visually on `/design-kit` in Task 11.

---

### Task 5: Month navigation and layout composites

**Files:**
- Modify: `src/lib/month-nav.ts` (add `buildMonthNav`)
- Create: `src/lib/month-nav.test.ts`
- Create: `src/components/MonthNav.tsx`, `src/components/PageHeader.tsx`, `src/components/ArrowLink.tsx`, `src/components/SectionHeading.tsx`, `src/components/Ledger.tsx`, `src/components/EmptyState.tsx`

**Interfaces:**
- Consumes: `formatPeriodLabel(year, month, dateFormat)` from `@/lib/month-period`, and `DateFormat` from `@/lib/date-format-cookie`.
- Produces:
  - `buildMonthNav({ allowFuture?, basePath, current, dateFormat, selected }): MonthNavModel`, where `MonthNavModel = { label: string; nextHref: null | string; options: { href: string; label: string; selected: boolean }[]; prevHref: string }`
  - `<PageHeader title actions? meta? monthNav? subtitle? className? />`
  - `<ArrowLink href className?>…</ArrowLink>`
  - `<SectionHeading aside? sub? rule? className?>title</SectionHeading>`
  - `<Ledger className?>` with `<LedgerCell label lead? note? bar? onSelect? selected?>figure</LedgerCell>`
  - `<EmptyState title body action? size? ("md" | "lg") className? />`

- [ ] **Step 1: Write the failing test**

`src/lib/month-nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildMonthNav } from "./month-nav";

const current = { month: 10, year: 2026 };

describe("buildMonthNav", () => {
  it("links to the previous month and stops at the current one", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current, dateFormat: "english", selected: current });
    expect(nav.label).toBe("October 2026");
    expect(nav.prevHref).toBe("/expenses?year=2026&month=9");
    expect(nav.nextHref).toBeNull();
  });

  it("links forward from a past month", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current, dateFormat: "english", selected: { month: 8, year: 2026 } });
    expect(nav.nextHref).toBe("/expenses?year=2026&month=9");
  });

  it("crosses the year boundary in both directions", () => {
    const nav = buildMonthNav({ basePath: "/reports", current, dateFormat: "english", selected: { month: 1, year: 2026 } });
    expect(nav.prevHref).toBe("/reports?year=2025&month=12");
    expect(buildMonthNav({ basePath: "/reports", current, dateFormat: "english", selected: { month: 12, year: 2025 } }).nextHref).toBe(
      "/reports?year=2026&month=1",
    );
  });

  it("lets Budget go past the current month", () => {
    const nav = buildMonthNav({ allowFuture: true, basePath: "/budget", current, dateFormat: "english", selected: current });
    expect(nav.nextHref).toBe("/budget?year=2026&month=11");
    expect(nav.options[0]).toEqual({ href: "/budget?year=2026&month=11", label: "November 2026", selected: false });
  });

  it("offers the last 12 months, newest first, with the selected one marked", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current, dateFormat: "english", selected: { month: 8, year: 2026 } });
    expect(nav.options).toHaveLength(12);
    expect(nav.options[0].label).toBe("October 2026");
    expect(nav.options[11].label).toBe("November 2025");
    expect(nav.options.filter((o) => o.selected).map((o) => o.label)).toEqual(["August 2026"]);
  });

  it("marks nothing when the selected month is older than the menu", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current, dateFormat: "english", selected: { month: 1, year: 2024 } });
    expect(nav.options.some((o) => o.selected)).toBe(false);
    expect(nav.label).toBe("January 2024");
  });

  it("uses Bikram Sambat month names for nepali households", () => {
    const nav = buildMonthNav({ basePath: "/expenses", current: { month: 6, year: 2083 }, dateFormat: "nepali", selected: { month: 1, year: 2083 } });
    expect(nav.label).toBe("Baisakh 2083");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/month-nav.test.ts`
Expected: FAIL with `buildMonthNav is not a function` (or a missing-export error).

- [ ] **Step 3: Implement `buildMonthNav`**

Append to `src/lib/month-nav.ts`, and add these two imports at the top of the file:

```ts
import type { DateFormat } from "@/lib/date-format-cookie";
import { formatPeriodLabel } from "@/lib/month-period";
```

```ts
type YearMonth = { month: number; year: number };

export type MonthNavOption = { href: string; label: string; selected: boolean };
export type MonthNavModel = { label: string; nextHref: null | string; options: MonthNavOption[]; prevHref: string };

const MENU_LENGTH = 12;

function toIndex({ month, year }: YearMonth): number {
  return year * 12 + (month - 1);
}

function fromIndex(index: number): YearMonth {
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

// The header month switcher on every month-scoped page. Pages stop at the
// current month (as in the mockups) unless `allowFuture` is set — Budget sets
// it so next month's budget can be planned ahead.
export function buildMonthNav(input: {
  allowFuture?: boolean;
  basePath: string;
  current: YearMonth;
  dateFormat: DateFormat;
  selected: YearMonth;
}): MonthNavModel {
  const { allowFuture = false, basePath, current, dateFormat, selected } = input;
  const href = (ym: YearMonth) => `${basePath}?year=${ym.year}&month=${ym.month}`;
  const label = (ym: YearMonth) => formatPeriodLabel(ym.year, ym.month, dateFormat);

  const next = nextMonth(selected.year, selected.month);
  const lastNavigable = allowFuture ? toIndex(nextMonth(current.year, current.month)) : toIndex(current);
  const newest = Math.max(toIndex(selected), lastNavigable);
  const options = Array.from({ length: MENU_LENGTH }, (_, k) => fromIndex(newest - k)).map((ym) => ({
    href: href(ym),
    label: label(ym),
    selected: toIndex(ym) === toIndex(selected),
  }));

  return {
    label: label(selected),
    nextHref: allowFuture || toIndex(next) <= toIndex(current) ? href(next) : null,
    options,
    prevHref: href(previousMonth(selected.year, selected.month)),
  };
}
```

Run: `grep -n "month-nav" src/lib/month-period.ts`
Expected: no output, so the new import can't be circular.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/month-nav.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Create the components**

`src/components/MonthNav.tsx`:

```tsx
"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";

const ARROW = "grid size-[30px] place-items-center";

export function MonthNav({ nav }: { nav: MonthNavModel }) {
  return (
    <div className="-ml-1.5 flex items-center gap-0.5">
      <Link aria-label="Previous month" className={cn(ARROW, "text-ink hover:bg-ink/[0.07]")} href={nav.prevHref}>
        <ChevronLeft className="size-4" />
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-[30px] items-center gap-1.5 px-1.5 text-[15px] font-semibold hover:bg-ink/[0.07]">
          {nav.label}
          <ChevronDown aria-hidden className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto min-w-[180px] py-1.5">
          {nav.options.map((option) => (
            <DropdownMenuItem asChild key={option.href}>
              <Link aria-current={option.selected ? "page" : undefined} className={cn(option.selected && "font-semibold")} href={option.href}>
                {option.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {nav.nextHref ? (
        <Link aria-label="Next month" className={cn(ARROW, "text-ink hover:bg-ink/[0.07]")} href={nav.nextHref}>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <button aria-label="Next month" className={cn(ARROW, "text-n-400")} disabled title="This is the current month" type="button">
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
```

`src/components/PageHeader.tsx`:

```tsx
import type { ReactNode } from "react";

import { MonthNav } from "@/components/MonthNav";
import type { MonthNavModel } from "@/lib/month-nav";
import { cn } from "@/lib/utils";

type Props = {
  actions?: ReactNode;
  className?: string;
  meta?: ReactNode;
  monthNav?: MonthNavModel;
  subtitle?: ReactNode;
  title: string;
};

// Page title row: 42px title, then either the month switcher (+ a short meta
// line such as "12 days left in the month") or a one-line subtitle, with the
// page's actions bottom-aligned on the right.
export function PageHeader({ actions, className, meta, monthNav, subtitle, title }: Props) {
  return (
    <header className={cn("mb-[26px] flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="flex flex-col gap-3">
        <h1 className="text-[34px] leading-none font-extrabold tracking-[-0.02em] md:text-[42px]">{title}</h1>
        {monthNav ? (
          <div className="flex flex-wrap items-center gap-x-2.5">
            <MonthNav nav={monthNav} />
            {meta && <span className="text-[13px] text-n-600">{meta}</span>}
          </div>
        ) : (
          subtitle && <p className="text-[15px] leading-[30px] text-n-700">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
```

`src/components/ArrowLink.tsx`:

```tsx
import type { ReactNode } from "react";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// "All expenses ↗"-style link beside section headings.
export function ArrowLink({ children, className, href }: { children: ReactNode; className?: string; href: string }) {
  return (
    <Link className={cn("inline-flex items-center gap-1 text-[13px] font-semibold text-signal-ink hover:text-signal", className)} href={href}>
      {children}
      <ArrowUpRight aria-hidden className="size-[13px]" />
    </Link>
  );
}
```

`src/components/SectionHeading.tsx`:

```tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = { aside?: ReactNode; children: ReactNode; className?: string; rule?: boolean; sub?: ReactNode };

// 20px section title with an optional sub-line and a right-hand slot (a link
// or a short note). The 2px rule underneath is dropped when a table header
// directly below already draws one.
export function SectionHeading({ aside, children, className, rule = true, sub }: Props) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3", rule && "border-b-2 border-rule", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl leading-tight font-extrabold tracking-[-0.01em]">{children}</h2>
        {sub && <span className="text-[13px] text-n-600">{sub}</span>}
      </div>
      {aside && <div className="text-[13px] text-n-600">{aside}</div>}
    </div>
  );
}
```

`src/components/Ledger.tsx`:

```tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Headline-figure row at the top of most pages: one large lead figure and up
// to three smaller ones. Lays out against the page's @container (set in the
// (app) layout): side by side from 780px, lead on its own row below that.
export function Ledger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 border-t-2 border-b border-t-ink border-b-rule @min-[780px]:grid-cols-[minmax(0,1.55fr)_repeat(3,minmax(0,1fr))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const LEAD =
  "col-span-full border-b border-n-300 pt-[18px] pb-5 @min-[780px]:col-span-1 @min-[780px]:border-b-0 @min-[780px]:pr-7";
// The first small cell sits flush left when the lead wraps onto its own row.
const SMALL =
  "border-l border-n-300 px-5 pt-[18px] pb-5 [&:nth-child(2)]:border-l-0 [&:nth-child(2)]:pl-0 @min-[780px]:[&:nth-child(2)]:border-l @min-[780px]:[&:nth-child(2)]:pl-5";

type CellProps = {
  bar?: ReactNode;
  children: ReactNode;
  label: ReactNode;
  lead?: boolean;
  note?: ReactNode;
  onSelect?: () => void;
  selected?: boolean;
};

// One figure in a Ledger. With `onSelect` the cell becomes a filter button and
// `selected` draws the red bar along its top edge.
export function LedgerCell({ bar, children, label, lead = false, note, onSelect, selected = false }: CellProps) {
  const className = cn(
    "relative flex min-w-0 flex-col items-stretch gap-2 text-left",
    lead ? LEAD : SMALL,
    onSelect && "hover:bg-ink/[0.03]",
  );
  const content = (
    <>
      {selected && <span aria-hidden className={cn("absolute right-0 -top-0.5 h-1 bg-signal", lead ? "left-0" : "-left-px")} />}
      <span className={cn("micro-label flex items-center gap-2", selected ? "text-ink" : "text-n-600")}>{label}</span>
      <span className={cn(!lead && "mt-3")}>{children}</span>
      {note && <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-n-700">{note}</span>}
      {bar && <span className="mt-1">{bar}</span>}
    </>
  );

  if (onSelect) {
    return (
      <button aria-pressed={selected} className={className} onClick={onSelect} type="button">
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}
```

`src/components/EmptyState.tsx`:

```tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = { action?: ReactNode; body: ReactNode; className?: string; size?: "lg" | "md"; title: string };

// Every "nothing here yet" or error message: a bold line, one sentence, one action.
export function EmptyState({ action, body, className, size = "md", title }: Props) {
  return (
    <div className={cn("flex flex-col items-start", size === "md" ? "gap-2.5 py-[22px]" : "gap-3.5 py-6", className)}>
      {size === "lg" ? (
        <h2 className="max-w-[18ch] text-[34px] leading-[1.08] font-extrabold tracking-[-0.02em] text-balance">{title}</h2>
      ) : (
        <h3 className="text-[17px] font-semibold">{title}</h3>
      )}
      <p className={cn("max-w-[46ch] leading-[1.55] text-pretty", size === "md" ? "text-sm text-n-700" : "text-[15px] text-n-800")}>{body}</p>
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint -- --fix && npx vitest run src/lib/month-nav.test.ts`
Expected: exit 0 and PASS.

---

### Task 6: Interactive composites

**Files:**
- Create: `src/components/LineTabs.tsx`, `FilterMenu.tsx`, `Segmented.tsx`, `AmountInput.tsx`, `MoreDetails.tsx`, `RowMenu.tsx`, `Rows.tsx` (all in `src/components/`)

**Interfaces:**
- Consumes: `sanitizeAmountInput` (Task 4).
- Produces:
  - `<LineTabs<T> label tabs ({ count?; label; value: T }[]) value onChange aside? className? />`
  - `<FilterMenu active label options ({ count?; label; value }[]) value onSelect />`, exporting `FilterMenuOption`
  - `<Segmented<T> label hideLabel? name? options ({ label; value: T }[]) value onChange className? />`
  - `<AmountInput label error? size? ("lg" | "xl") …inputProps />`, whose `onChange` receives the sanitised value
  - `<MoreDetails label? forceOpen?>fields</MoreDetails>`
  - `<RowMenu items ({ label; onSelect; destructive? }[]) label? />`, exporting `RowMenuItem`
  - `RowColumns = { lg: string; md?: string; sm?: string }` (CSS grid templates for ≥780 / ≥560 / <560px), plus `<RowsHeader columns>`, `<RowGroupHead columns first?>`, `<GroupLabel label sub? className?>`, `<Row columns onClick? className?>`

- [ ] **Step 1: `src/components/LineTabs.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type LineTab<T extends string> = { count?: number; label: string; value: T };

type Props<T extends string> = {
  aside?: ReactNode;
  className?: string;
  label: string;
  onChange: (value: T) => void;
  tabs: LineTab<T>[];
  value: T;
};

// Text tabs on a 1px rule; the selected one is semibold with a red underline.
export function LineTabs<T extends string>({ aside, className, label, onChange, tabs, value }: Props<T>) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b border-n-300", className)}>
      <div aria-label={label} className="flex flex-wrap gap-x-[26px]" role="tablist">
        {tabs.map((tab) => {
          const selected = tab.value === value;
          return (
            <button
              aria-selected={selected}
              className={cn(
                "relative inline-flex items-baseline gap-1.5 pt-2 pb-[11px] text-sm",
                selected ? "font-semibold text-ink" : "text-n-700 hover:text-ink",
              )}
              key={tab.value}
              onClick={() => onChange(tab.value)}
              role="tab"
              type="button"
            >
              {tab.label}
              {tab.count !== undefined && <span className="text-xs font-normal text-n-600 tabular-nums">{tab.count}</span>}
              {selected && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 bg-signal" />}
            </button>
          );
        })}
      </div>
      {aside && <div className="pb-[11px] text-[13px] text-n-600">{aside}</div>}
    </div>
  );
}
```

- [ ] **Step 2: `src/components/FilterMenu.tsx`**

```tsx
"use client";

import { Check, ChevronDown } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FilterMenuOption = { count?: number; label: string; value: string };

type Props = {
  active: boolean;
  label: string;
  onSelect: (value: string) => void;
  options: FilterMenuOption[];
  value: null | string;
};

// Plain-text filter dropdown ("Category ▾"). `label` is what the trigger shows
// (the filter's name, or the chosen value once active); the caller decides
// what picking an option means (toggle off, replace, …).
export function FilterMenu({ active, label, onSelect, options, value }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-[38px] items-center gap-[7px] px-2.5 text-sm hover:bg-ink/[0.06]",
          active ? "font-semibold text-ink" : "text-n-800",
        )}
      >
        {active && <span aria-hidden className="size-1.5 bg-signal" />}
        {label}
        <ChevronDown aria-hidden className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto min-w-[190px] py-1.5">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onSelect(option.value)}>
            <span className="grid w-3.5 place-items-center text-signal">{option.value === value && <Check className="size-3.5" />}</span>
            <span className="flex-1">{option.label}</span>
            {option.count !== undefined && <span className="text-[13px] text-n-600 tabular-nums">{option.count}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: `src/components/Segmented.tsx`**

```tsx
"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  className?: string;
  hideLabel?: boolean;
  label: string;
  name?: string;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  value: T;
};

// One-of-n choice drawn as joined square buttons. Native radios underneath,
// so arrow keys, labels and form semantics come for free.
export function Segmented<T extends string>({ className, hideLabel = false, label, name, onChange, options, value }: Props<T>) {
  const id = useId();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className={cn("text-xs text-n-700", hideLabel && "sr-only")} id={`${id}-label`}>
        {label}
      </span>
      <div aria-labelledby={`${id}-label`} className="flex border border-n-400" role="radiogroup">
        {options.map((option) => (
          <label className="relative flex-1 border-l border-n-400 first:border-l-0" key={option.value}>
            <input
              checked={option.value === value}
              className="peer sr-only"
              name={name ?? id}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span className="grid h-[38px] cursor-pointer place-items-center px-2 text-sm text-n-800 peer-checked:bg-ink peer-checked:font-semibold peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-signal hover:bg-ink/[0.06] peer-checked:hover:bg-ink">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `src/components/AmountInput.tsx`**

```tsx
"use client";

import { type ComponentProps, useId } from "react";

import { sanitizeAmountInput } from "@/lib/money";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "size" | "type"> & { error?: string; label: string; size?: "lg" | "xl" };

// The big "Rs ____" field every money dialog leads with. Input is cut down to
// digits and one decimal point (two places) before any onChange sees it, so it
// works the same controlled or registered with react-hook-form.
export function AmountInput({ className, error, id, label, onChange, size = "lg", ...props }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-n-700" htmlFor={inputId}>
        {label}
      </label>
      <div className="flex items-baseline gap-2 border-b-2 border-ink pb-1.5">
        <span aria-hidden className="text-lg font-semibold text-n-600">
          Rs
        </span>
        <input
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent p-0 leading-[1.1] font-extrabold tracking-[-0.02em] text-ink tabular-nums caret-signal outline-none placeholder:text-n-400",
            size === "xl" ? "text-[44px]" : "text-[40px]",
            className,
          )}
          id={inputId}
          inputMode="decimal"
          onChange={(event) => {
            event.target.value = sanitizeAmountInput(event.target.value);
            onChange?.(event);
          }}
          placeholder="0.00"
          type="text"
          {...props}
        />
      </div>
      {error && <p className="text-[13px] text-signal-ink">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: `src/components/MoreDetails.tsx`**

```tsx
"use client";

import { type ReactNode, useState } from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = { children: ReactNode; forceOpen?: boolean; label?: string };

// Collapsed section for the fields a dialog's design leaves out but the app
// still needs. `forceOpen` keeps it open while one of those fields has an
// error, so the message is never hidden.
export function MoreDetails({ children, forceOpen = false, label = "More details" }: Props) {
  const [open, setOpen] = useState(false);
  const isOpen = open || forceOpen;

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} open={isOpen}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] text-n-700 hover:text-ink [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
      </summary>
      <div className="mt-[18px] flex flex-col gap-[22px]">{children}</div>
    </details>
  );
}
```

- [ ] **Step 6: `src/components/RowMenu.tsx`**

```tsx
"use client";

import { MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowMenuItem = { destructive?: boolean; label: string; onSelect: () => void };

// The ⋯ button at the end of a row. Destructive items go below a rule, as in
// the mockups. Clicks are stopped here because React bubbles portal events up
// the component tree — without it, choosing an item would also "click" the
// row (which opens Edit).
export function RowMenu({ items, label = "More actions" }: { items: RowMenuItem[]; label?: string }) {
  const regular = items.filter((item) => !item.destructive);
  const destructive = items.filter((item) => item.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="grid size-7 place-items-center text-n-500 hover:bg-ink/[0.07] hover:text-ink data-[state=open]:text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-[190px] py-1.5" onClick={(event) => event.stopPropagation()}>
        {regular.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
            {item.label}
          </DropdownMenuItem>
        ))}
        {regular.length > 0 && destructive.length > 0 && <DropdownMenuSeparator className="my-1.5 bg-n-300" />}
        {destructive.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect} variant="destructive">
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 7: `src/components/Rows.tsx`**

```tsx
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

// Grid-based table rows. Each page passes its column template per width band
// of the page container — `lg` from 780px, `md` from 560px, `sm` below — and
// hides the cells a band drops itself (e.g. `@max-[559px]:hidden`).
export type RowColumns = { lg: string; md?: string; sm?: string };

function columnStyle({ lg, md, sm }: RowColumns): CSSProperties {
  return { "--cols-lg": lg, "--cols-md": md ?? lg, "--cols-sm": sm ?? md ?? lg } as CSSProperties;
}

const GRID =
  "grid gap-x-4 [grid-template-columns:var(--cols-sm)] @min-[560px]:[grid-template-columns:var(--cols-md)] @min-[780px]:[grid-template-columns:var(--cols-lg)]";

export function RowsHeader({ children, columns }: { children: ReactNode; columns: RowColumns }) {
  return (
    <div className={cn(GRID, "micro-label border-b-2 border-rule px-2 pb-2.5 text-n-600")} style={columnStyle(columns)}>
      {children}
    </div>
  );
}

// A group's heading row (a day, a person, …). The first group sits closer to
// the column header than the ones after it.
export function RowGroupHead({ children, columns, first = false }: { children: ReactNode; columns: RowColumns; first?: boolean }) {
  return (
    <div
      className={cn(GRID, "items-baseline border-b border-rule px-2 pb-2.5", first ? "pt-[18px]" : "pt-9")}
      style={columnStyle(columns)}
    >
      {children}
    </div>
  );
}

export function GroupLabel({ className, label, sub }: { className?: string; label: ReactNode; sub?: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 items-baseline gap-2.5", className)}>
      <span className="text-[15px] font-semibold whitespace-nowrap">{label}</span>
      {sub && <span className="truncate text-[13px] text-n-600">{sub}</span>}
    </div>
  );
}

type RowProps = { children: ReactNode; className?: string; columns: RowColumns; onClick?: () => void };

// Clicking a row is a mouse shortcut for its main action; keyboard users get
// the same action from the row's ⋯ menu or a button inside the row.
export function Row({ children, className, columns, onClick }: RowProps) {
  return (
    <div
      className={cn(GRID, "relative items-center border-b border-n-300 px-2 py-3", onClick && "cursor-pointer hover:bg-ink/[0.03]", className)}
      onClick={onClick}
      style={columnStyle(columns)}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npm run lint -- --fix`
Expected: exit 0. These components are exercised on `/design-kit` (Task 11).

---

### Task 7: Sidebar, nav items and the N shortcut

**Files:**
- Create: `src/lib/keyboard-shortcut.ts`, `src/lib/keyboard-shortcut.test.ts`
- Create: `src/components/nav/nav-items.ts`, `src/components/nav/useAddExpenseShortcut.ts`
- Modify: `src/components/nav/SidebarNav.tsx` (full rewrite)
- Modify: `src/app/(app)/layout.tsx` (sidebar props; the frame itself changes in Task 9)
- Modify: `e2e/activity-revert.spec.ts:29`, `e2e/activity.spec.ts:25`, `e2e/expenses.spec.ts:21`, `e2e/expenses.spec.ts:31`
- Create: `e2e/shell.spec.ts`

**Interfaces:**
- Produces:
  - `isAddExpenseShortcut(event: ShortcutEvent, overlayOpen: boolean): boolean`
  - `useAddExpenseShortcut(onTrigger: () => void): void`
  - `NavItem = { href; icon: LucideIcon; label }`, `NavGroup = { items; label }`
  - `NAV_GROUPS`, `NAV_FOOTER`, `BOTTOM_BAR`, `MORE_GROUPS`, and `isActivePath(pathname, href)`
- `SidebarNav` props become `{ categories, currentMemberId, initialCollapsed, members, unreadNotifications }`. The unused `realMemberId` and `viewingAsMemberId` go.

- [ ] **Step 1: Write the failing test**

`src/lib/keyboard-shortcut.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isAddExpenseShortcut, type ShortcutEvent } from "./keyboard-shortcut";

function press(overrides: Partial<ShortcutEvent> = {}): ShortcutEvent {
  return { altKey: false, ctrlKey: false, defaultPrevented: false, key: "n", metaKey: false, target: { tagName: "BODY" }, ...overrides };
}

describe("isAddExpenseShortcut", () => {
  it("fires on n or N with nothing focused", () => {
    expect(isAddExpenseShortcut(press(), false)).toBe(true);
    expect(isAddExpenseShortcut(press({ key: "N" }), false)).toBe(true);
    expect(isAddExpenseShortcut(press({ target: null }), false)).toBe(true);
  });

  it("ignores other keys", () => {
    expect(isAddExpenseShortcut(press({ key: "m" }), false)).toBe(false);
  });

  it("ignores keydowns without a key (Chrome autofill sends these)", () => {
    expect(isAddExpenseShortcut(press({ key: undefined }), false)).toBe(false);
  });

  it("never fires while typing", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(isAddExpenseShortcut(press({ target: { tagName } }), false)).toBe(false);
    }
    expect(isAddExpenseShortcut(press({ target: { isContentEditable: true, tagName: "DIV" } }), false)).toBe(false);
  });

  it("leaves browser and OS shortcuts alone", () => {
    expect(isAddExpenseShortcut(press({ ctrlKey: true }), false)).toBe(false);
    expect(isAddExpenseShortcut(press({ metaKey: true }), false)).toBe(false);
    expect(isAddExpenseShortcut(press({ altKey: true }), false)).toBe(false);
  });

  it("does nothing while a dialog or menu is open, or when already handled", () => {
    expect(isAddExpenseShortcut(press(), true)).toBe(false);
    expect(isAddExpenseShortcut(press({ defaultPrevented: true }), false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/keyboard-shortcut.test.ts`
Expected: FAIL, because `./keyboard-shortcut` can't be resolved.

- [ ] **Step 3: Implement**

`src/lib/keyboard-shortcut.ts`:

```ts
export type ShortcutEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  key: string | undefined;
  metaKey: boolean;
  target: null | { isContentEditable?: boolean; tagName?: string };
};

const TYPING_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

// "N" opens Add expense from anywhere — but never while someone is typing,
// holding a modifier (browser shortcuts), already inside a dialog or menu, or
// on the key-less keydown Chrome's autofill dispatches.
export function isAddExpenseShortcut(event: ShortcutEvent, overlayOpen: boolean): boolean {
  if (overlayOpen || event.defaultPrevented) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  if ((event.key ?? "").toLowerCase() !== "n") return false;
  const { target } = event;
  if (!target) return true;
  return !target.isContentEditable && !TYPING_TAGS.has(target.tagName ?? "");
}
```

`src/components/nav/useAddExpenseShortcut.ts`:

```ts
import { useEffect } from "react";

import { isAddExpenseShortcut } from "@/lib/keyboard-shortcut";

export function useAddExpenseShortcut(onTrigger: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const overlayOpen = document.querySelector('[role="dialog"], [role="menu"]') !== null;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const shortcut = {
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        defaultPrevented: event.defaultPrevented,
        key: event.key,
        metaKey: event.metaKey,
        target,
      };
      if (!isAddExpenseShortcut(shortcut, overlayOpen)) return;
      event.preventDefault();
      onTrigger();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/keyboard-shortcut.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: `src/components/nav/nav-items.ts`**

```ts
import {
  BarChart3,
  Bell,
  HandCoins,
  History,
  Home,
  List,
  type LucideIcon,
  PiggyBank,
  Receipt,
  Repeat,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = { href: string; icon: LucideIcon; label: string };
export type NavGroup = { items: NavItem[]; label: string };

const HOME: NavItem = { href: "/dashboard", icon: Home, label: "Home" };
const EXPENSES: NavItem = { href: "/expenses", icon: Receipt, label: "Expenses" };
const BUDGET: NavItem = { href: "/budget", icon: Wallet, label: "Budget" };
const RECURRING: NavItem = { href: "/recurring", icon: Repeat, label: "Recurring" };
const SAVINGS: NavItem = { href: "/savings-goals", icon: PiggyBank, label: "Savings Goals" };
const LOANS: NavItem = { href: "/loans", icon: HandCoins, label: "Loans" };
const DHUKU: NavItem = { href: "/dhuku", icon: Users, label: "Dhuku" };
const REPORTS: NavItem = { href: "/reports", icon: BarChart3, label: "Reports" };
const CATEGORIES: NavItem = { href: "/categories", icon: List, label: "Categories" };
const NOTIFICATIONS: NavItem = { href: "/notifications", icon: Bell, label: "Notifications" };
const ACTIVITY: NavItem = { href: "/activity", icon: History, label: "Activity" };
const SETTINGS: NavItem = { href: "/settings", icon: Settings, label: "Settings" };

// Sidebar sections, in the mockup's order.
export const NAV_GROUPS: NavGroup[] = [
  { items: [HOME, EXPENSES, BUDGET, RECURRING], label: "Everyday" },
  { items: [SAVINGS, LOANS, DHUKU], label: "Saving & lending" },
  { items: [REPORTS, CATEGORIES], label: "Insight" },
];

// Pinned to the bottom of the sidebar.
export const NAV_FOOTER: NavItem[] = [NOTIFICATIONS, ACTIVITY, SETTINGS];

// Phone bottom bar; everything else lives in its "More" sheet, grouped as in the sidebar.
export const BOTTOM_BAR: NavItem[] = [HOME, EXPENSES, BUDGET, SETTINGS];

export const MORE_GROUPS: NavGroup[] = [
  ...NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => !BOTTOM_BAR.includes(item)) })),
  { items: NAV_FOOTER.filter((item) => !BOTTOM_BAR.includes(item)), label: "Updates" },
].filter((group) => group.items.length > 0);

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

- [ ] **Step 6: Replace `src/components/nav/SidebarNav.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";

import { ChevronsUpDown, LogOut, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath, NAV_FOOTER, NAV_GROUPS, type NavItem } from "@/components/nav/nav-items";
import { useAddExpenseShortcut } from "@/components/nav/useAddExpenseShortcut";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/actions/auth";
import { SIDEBAR_COLLAPSED_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { cn } from "@/lib/utils";
import { AddExpenseModal } from "@/modules/expenses/components/AddExpenseModal";
import { VoiceEntryButton } from "@/modules/voice-entry/components/VoiceEntryButton";

type Category = { groupName: string; id: string; name: string };
type Member = { id: string; image: null | string; name: string };

type Props = {
  categories: Category[];
  currentMemberId: string;
  initialCollapsed: boolean;
  members: Member[];
  unreadNotifications: number;
};

function NavLink({ badge, collapsed, item, pathname }: { badge?: number; collapsed: boolean; item: NavItem; pathname: string }) {
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-3 px-2.5 text-sm transition-colors hover:bg-ink/[0.06] hover:text-ink",
        active ? "bg-surface font-semibold text-ink" : "text-n-800",
        collapsed && "justify-center px-0",
      )}
      href={item.href}
      title={collapsed ? item.label : undefined}
    >
      {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-signal" />}
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      {collapsed ? <span className="sr-only">{item.label}</span> : <span className="flex-1 truncate">{item.label}</span>}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "grid h-[18px] min-w-[18px] place-items-center bg-signal px-1 text-[11px] font-semibold text-paper",
            collapsed && "absolute top-0.5 right-1",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export function SidebarNav({ categories, currentMemberId, initialCollapsed, members, unreadNotifications }: Props) {
  const pathname = usePathname();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const openAddExpense = useCallback(() => setAddExpenseOpen(true), []);
  useAddExpenseShortcut(openAddExpense);

  const me = members.find((m) => m.id === currentMemberId);
  const myName = me?.name ?? "Me";
  const expenseMembers = members.map((m) => ({ id: m.id, name: m.name }));

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COLLAPSED_COOKIE_NAME}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col gap-[22px] overflow-y-auto border-r-2 border-rule bg-paper pt-5 pb-[18px] text-ink md:flex",
        collapsed ? "w-16 px-2" : "w-[244px] px-3.5",
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-1", collapsed && "flex-col px-0")}>
        <span aria-hidden className="grid size-8 shrink-0 place-items-center bg-ink text-base font-extrabold text-paper">
          P
        </span>
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[17px] leading-tight font-extrabold">Piko</span>
            <span className="truncate text-xs text-n-600">Plan together, grow together</span>
          </div>
        )}
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid size-7 shrink-0 place-items-center text-n-600 hover:bg-ink/[0.07] hover:text-ink"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          {collapsed ? <PanelLeftOpen className="size-4" strokeWidth={1.75} /> : <PanelLeftClose className="size-4" strokeWidth={1.75} />}
        </button>
      </div>

      <div className={cn("flex gap-1.5", collapsed && "flex-col items-center")}>
        <Button
          className={cn("h-10 min-w-0 flex-1 justify-start", collapsed && "w-10 flex-none justify-center px-0")}
          onClick={openAddExpense}
          title="Add expense (N)"
          type="button"
        >
          <Plus />
          {collapsed ? <span className="sr-only">Add expense</span> : "Add expense"}
        </Button>
        <VoiceEntryButton
          categories={categories}
          className="grid size-10 shrink-0 place-items-center border border-ink text-ink hover:bg-ink/[0.06]"
          currentMemberId={currentMemberId}
          members={expenseMembers}
        />
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-[18px]">
        {NAV_GROUPS.map((group) => (
          <div className="flex flex-col gap-px" key={group.label}>
            {collapsed ? (
              <span aria-hidden className="mx-auto mb-1.5 h-px w-6 bg-n-300" />
            ) : (
              <span className="micro-label px-2.5 pb-1.5 font-normal text-n-600">{group.label}</span>
            )}
            {group.items.map((item) => (
              <NavLink collapsed={collapsed} item={item} key={item.href} pathname={pathname} />
            ))}
          </div>
        ))}

        <div className="mt-auto flex flex-col gap-px border-t border-n-300 pt-3.5">
          {NAV_FOOTER.map((item) => (
            <NavLink
              badge={item.href === "/notifications" ? unreadNotifications : undefined}
              collapsed={collapsed}
              item={item}
              key={item.href}
              pathname={pathname}
            />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Account menu for ${myName}`}
                className={cn("mt-1.5 flex h-10 items-center gap-2.5 px-2.5 text-left hover:bg-ink/[0.06]", collapsed && "justify-center px-0")}
                type="button"
              >
                <Avatar className="size-[22px]" size="sm">
                  {me?.image && <AvatarImage alt="" src={me.image} />}
                  <AvatarFallback className="bg-ink text-[11px] font-semibold text-paper">{myName.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{myName}</span>
                    <ChevronsUpDown className="size-3.5 text-n-600" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" side="top">
              <DropdownMenuItem onClick={() => logoutAction()} variant="destructive">
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      <AddExpenseModal
        categories={categories}
        currentMemberId={currentMemberId}
        members={expenseMembers}
        onOpenChange={setAddExpenseOpen}
        open={addExpenseOpen}
      />
    </aside>
  );
}
```

- [ ] **Step 7: Update the sidebar props in `src/app/(app)/layout.tsx`**

Remove `getEffectiveMember` from the `@/lib/session` import and from the `Promise.all` (the `effective` variable goes too). Replace the `<SidebarNav …/>` element with:

```tsx
      <SidebarNav
        categories={expenseCategories}
        currentMemberId={current.memberId}
        initialCollapsed={initialCollapsed}
        members={members.map((m) => ({ id: m.id, image: m.user.image, name: m.user.name }))}
        unreadNotifications={unreadNotifications}
      />
```

- [ ] **Step 8: Point the e2e specs at the new button name**

In `e2e/activity-revert.spec.ts:29`, `e2e/activity.spec.ts:25`, `e2e/expenses.spec.ts:21` and `e2e/expenses.spec.ts:31`, change `name: "+ Add Expense"` to `name: "Add expense"`. Keep `exact: true` where present. The dialog title and its submit button stay "Add Expense" in this phase, so nothing else in those files changes.

- [ ] **Step 9: Write `e2e/shell.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

import { gotoRoute } from "./support/nav";

test.describe("app shell", () => {
  test("N opens Add expense from any page", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog", { name: "Add Expense" })).toBeVisible();
  });

  test("N types normally inside a field instead of opening Add expense", async ({ page }) => {
    await gotoRoute(page, "/settings");
    const field = page.getByLabel("Current password");
    await field.focus();
    await page.keyboard.press("n");
    await expect(field).toHaveValue("n");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("N inside an open dialog doesn't stack a second one", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await page.getByRole("complementary").getByRole("button", { exact: true, name: "Add expense" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Expense" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).focus();
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("a collapsed sidebar keeps links reachable and stays collapsed after reload", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    const sidebar = page.getByRole("complementary");
    await sidebar.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(sidebar.getByRole("link", { name: "Budget" })).toBeVisible();
    await page.reload();
    await expect(sidebar.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  });

  test("the account menu offers Sign out", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await page.getByRole("complementary").getByRole("button", { name: /^Account menu for / }).click();
    await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });
});
```

- [ ] **Step 10: Verify**

Run: `npx tsc --noEmit && npm run lint -- --fix && npx vitest run src/lib/keyboard-shortcut.test.ts`
Expected: exit 0 and PASS.

Run: `npx playwright test e2e/shell.spec.ts e2e/navigation.spec.ts`
Expected: all pass. (`playwright.config.ts` starts the seeded server on :3100 through `npm run e2e:serve`.)

---

### Task 8: Phone bottom nav

**Files:**
- Modify: `src/components/nav/BottomNav.tsx` (full rewrite)

**Interfaces:**
- Consumes: `BOTTOM_BAR`, `MORE_GROUPS`, `isActivePath` (Task 7).
- Props are unchanged: `{ categories, currentMemberId, members, unreadNotifications }`.

- [ ] **Step 1: Replace `src/components/nav/BottomNav.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BOTTOM_BAR, isActivePath, MORE_GROUPS } from "@/components/nav/nav-items";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AddExpenseModal } from "@/modules/expenses/components/AddExpenseModal";
import { VoiceEntryButton } from "@/modules/voice-entry/components/VoiceEntryButton";

type Category = { groupName: string; id: string; name: string };
type Member = { id: string; name: string };

type Props = {
  categories: Category[];
  currentMemberId: string;
  members: Member[];
  unreadNotifications: number;
};

const BAR_ITEM = "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]";

export function BottomNav({ categories, currentMemberId, members, unreadNotifications }: Props) {
  const pathname = usePathname();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fabsHidden, setFabsHidden] = useState(false);
  const lastScrollY = useRef(0);
  // Accumulated upward movement since the last downward tick — requiring a
  // deliberate scroll-up (not just settling after a downward flick) before
  // the buttons reappear over list content avoids them popping back in on
  // every tiny wobble and immediately covering whatever is underneath.
  const upDistance = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      if (delta > 0) {
        upDistance.current = 0;
        if (y > 80) setFabsHidden(true);
      } else {
        upDistance.current += -delta;
        // Near the top there's nothing left for the buttons to cover, so
        // show them immediately rather than waiting for the distance check.
        if (y <= 80 || upDistance.current > 60) setFabsHidden(false);
      }
      lastScrollY.current = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const fabHiddenClass = fabsHidden ? "pointer-events-none translate-y-16 opacity-0" : "";
  const moreActive = MORE_GROUPS.some((group) => group.items.some((item) => isActivePath(pathname, item.href)));

  return (
    <>
      <button
        aria-label="Add expense"
        className={cn(
          "fixed right-4 bottom-20 z-10 grid size-12 place-items-center bg-ink text-paper shadow-dialog transition-[transform,opacity] duration-200 md:hidden",
          fabHiddenClass,
        )}
        onClick={() => setAddExpenseOpen(true)}
        type="button"
      >
        <Plus className="size-6" />
      </button>
      <VoiceEntryButton
        categories={categories}
        className={cn(
          "fixed right-4 bottom-36 z-10 grid size-11 place-items-center border border-ink bg-paper text-ink shadow-menu transition-[transform,opacity] duration-200 md:hidden",
          fabHiddenClass,
        )}
        currentMemberId={currentMemberId}
        members={members}
      />

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-10 flex border-t-2 border-rule bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
        {BOTTOM_BAR.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(BAR_ITEM, active ? "font-semibold text-ink" : "text-n-600")}
              href={item.href}
              key={item.href}
            >
              {active && <span aria-hidden className="absolute inset-x-3 -top-0.5 h-0.5 bg-signal" />}
              <Icon className="size-5" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
        <button className={cn(BAR_ITEM, moreActive ? "font-semibold text-ink" : "text-n-600")} onClick={() => setMoreOpen(true)} type="button">
          {moreActive && <span aria-hidden className="absolute inset-x-3 -top-0.5 h-0.5 bg-signal" />}
          <MoreHorizontal className="size-5" strokeWidth={1.75} />
          More
          {unreadNotifications > 0 && <span aria-hidden className="absolute top-1.5 right-[calc(50%-16px)] size-2 bg-signal" />}
        </button>
      </nav>

      <Sheet onOpenChange={setMoreOpen} open={moreOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4">
            {MORE_GROUPS.map((group) => (
              <div className="flex flex-col" key={group.label}>
                <span className="micro-label pb-1.5 font-normal text-n-600">{group.label}</span>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(pathname, item.href);
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn("flex h-11 items-center gap-3 border-b border-n-300 px-1 text-[15px]", active ? "font-semibold text-ink" : "text-n-800")}
                      href={item.href}
                      key={item.href}
                      onClick={() => setMoreOpen(false)}
                    >
                      <Icon className="size-4" strokeWidth={1.75} />
                      <span className="flex-1">{item.label}</span>
                      {item.href === "/notifications" && unreadNotifications > 0 && (
                        <span className="grid h-[18px] min-w-[18px] place-items-center bg-signal px-1 text-[11px] font-semibold text-paper">
                          {unreadNotifications}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <AddExpenseModal
        categories={categories}
        currentMemberId={currentMemberId}
        members={members}
        onOpenChange={setAddExpenseOpen}
        open={addExpenseOpen}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint -- --fix`
Expected: exit 0.

With `npm run dev` running, use a 390×844 viewport (Chrome devtools device mode). The bar shows Home, Expenses, Budget, Settings and More, and the current tab has a red bar above it. **More** opens a sheet grouped Everyday / Saving & lending / Insight / Updates. The square + opens Add expense. Scrolling down hides both floating buttons.

---

### Task 9: Page frame, loading and error

**Files:**
- Modify: `src/app/(app)/layout.tsx` (frame)
- Create: `src/components/PageSkeleton.tsx`
- Modify: `src/app/(app)/loading.tsx`, `src/app/loading.tsx`, `src/app/(app)/error.tsx`, `src/app/error.tsx`, `src/components/ErrorState.tsx`
- Delete: `src/components/LoadingState.tsx`, `src/components/WanderingEyes.tsx`

**Interfaces:**
- Consumes: `EmptyState` (Task 5).
- Produces the page `@container` that every composite's `@min-[560px]` / `@min-[780px]` classes measure against.

- [ ] **Step 1: Replace `src/app/(app)/layout.tsx`**

```tsx
import { cookies } from "next/headers";

import { BottomNav } from "@/components/nav/BottomNav";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { getCurrentMember, getHouseholdMembers } from "@/lib/session";
import { SIDEBAR_COLLAPSED_COOKIE_NAME } from "@/lib/sidebar-cookie";
import { listCategories } from "@/modules/categories/api/categories";
import { countUnreadNotifications } from "@/modules/notifications/api/notifications.actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentMember();
  const [members, categories, unreadNotifications, cookieStore] = await Promise.all([
    getHouseholdMembers(current.householdId),
    listCategories(current.householdId),
    countUnreadNotifications(current.householdId),
    cookies(),
  ]);

  const expenseCategories = categories.map((c) => ({ groupName: c.groupName, id: c.id, name: c.name }));
  const expenseMembers = members.map((m) => ({ id: m.id, name: m.user.name }));
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_COOKIE_NAME)?.value === "true";

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <SidebarNav
        categories={expenseCategories}
        currentMemberId={current.memberId}
        initialCollapsed={initialCollapsed}
        members={members.map((m) => ({ id: m.id, image: m.user.image, name: m.user.name }))}
        unreadNotifications={unreadNotifications}
      />
      <main className="min-w-0 flex-1 px-4 pt-5 pb-28 md:px-12 md:pt-9 md:pb-16">
        {/* @container: composites lay out against the content width, not the window.
            space-y-6 spaces the pages not yet redesigned (each redesigned page renders
            a single root element); removed in phase 6. */}
        <div className="@container max-w-[1120px] space-y-6">{children}</div>
      </main>
      <BottomNav
        categories={expenseCategories}
        currentMemberId={current.memberId}
        members={expenseMembers}
        unreadNotifications={unreadNotifications}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/PageSkeleton.tsx`**

```tsx
// Placeholder shaped like a redesigned page — title, month line, headline
// figures, rows — so moving between pages doesn't flash a spinner.
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse" role="status">
      <div className="h-[42px] w-56 bg-n-200" />
      <div className="mt-3 h-4 w-40 bg-n-200" />
      <div className="mt-[26px] grid grid-cols-3 border-t-2 border-b border-t-ink border-b-rule @min-[780px]:grid-cols-[minmax(0,1.55fr)_repeat(3,minmax(0,1fr))]">
        <div className="col-span-full flex flex-col gap-3 border-b border-n-300 pt-[18px] pb-5 @min-[780px]:col-span-1 @min-[780px]:border-b-0 @min-[780px]:pr-7">
          <div className="h-3 w-24 bg-n-200" />
          <div className="h-10 w-48 bg-n-200" />
        </div>
        {[0, 1, 2].map((cell) => (
          <div className="flex flex-col gap-3 px-5 pt-[18px] pb-5" key={cell}>
            <div className="h-3 w-16 bg-n-200" />
            <div className="mt-3 h-6 w-24 bg-n-200" />
          </div>
        ))}
      </div>
      <div className="mt-9">
        {Array.from({ length: 6 }, (_, row) => (
          <div className="flex items-center gap-4 border-b border-n-300 px-2 py-3.5" key={row}>
            <div className="size-7 bg-n-200" />
            <div className="h-4 flex-1 bg-n-200" />
            <div className="h-4 w-20 bg-n-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Loading routes**

`src/app/(app)/loading.tsx`:

```tsx
import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return <PageSkeleton />;
}
```

`src/app/loading.tsx` (no app frame here, so show the mark):

```tsx
export default function Loading() {
  return (
    <div aria-label="Loading" className="flex min-h-screen items-center justify-center bg-paper" role="status">
      <span className="grid size-10 animate-pulse place-items-center bg-ink text-lg font-extrabold text-paper">P</span>
    </div>
  );
}
```

Then run `git rm src/components/LoadingState.tsx src/components/WanderingEyes.tsx`.

Run: `grep -rn "LoadingState\|WanderingEyes" src`
Expected: no output.

- [ ] **Step 4: Error state**

`src/components/ErrorState.tsx`:

```tsx
"use client";

import { useEffect } from "react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

type Props = { error: Error & { digest?: string }; reset: () => void };

export function ErrorState({ error, reset }: Props) {
  useEffect(() => {
    // Server errors are serialised across the boundary, so `cause` (e.g. the
    // underlying Postgres error) is already stripped by the time we see it —
    // check the server terminal for the full chain.
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      action={
        <Button onClick={reset} type="button" variant="outline">
          Try again
        </Button>
      }
      body={error.digest ? `Reference: ${error.digest}` : "Please try again."}
      size="lg"
      title="Something went wrong"
    />
  );
}
```

In `src/app/(app)/error.tsx`, change the wrapper `className="flex h-full items-center justify-center"` to `className="pt-6"`. In `src/app/error.tsx`, change `className="flex min-h-screen items-center justify-center"` to `className="flex min-h-screen items-center bg-paper px-6 md:px-12"`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint -- --fix`
Expected: exit 0.

With `npm run dev` running, move between `/dashboard` and `/reports`: the skeleton (grey title block, ruled figures row, grey rows) shows instead of the eyes animation. Content is left-aligned and stops at 1120px.

---

### Task 10: Login

**Files:**
- Modify: `src/app/login/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `loginAction` (unchanged) and `TextField`.
- Keeps the e2e contract: labels "Email" and "Password", a heading "Sign in", and a button "Sign in".

- [ ] **Step 1: Replace `src/app/login/page.tsx`**

```tsx
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
        <form action={formAction} className="flex w-full max-w-sm flex-col gap-[22px]">
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx playwright test e2e/auth.spec.ts`
Expected: exit 0 and PASS.

Sign out, then view `/login` at desktop width (brand panel on the left, form on the right) and at 390px (one column, brand row on top). Try a wrong password: the error appears in red text.

---

### Task 11: Design-kit preview page

A temporary, un-linked route that renders every composite with sample data, so the user can review the building blocks before any real page is rebuilt. It's deleted in phase 6.

**Files:**
- Create: `src/modules/design-kit/index.tsx`, `src/modules/design-kit/pages/DesignKitPage.tsx`, `src/modules/design-kit/components/DesignKitDemo.tsx`
- Create: `src/app/(app)/design-kit/page.tsx`

**Interfaces:**
- Consumes every composite from Tasks 3–6 and `buildMonthNav`.

- [ ] **Step 1: Module page (server)**

`src/modules/design-kit/pages/DesignKitPage.tsx`:

```tsx
import { ArrowUpRight, FileDown, ListPlus } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { buildMonthNav } from "@/lib/month-nav";
import { DesignKitDemo } from "@/modules/design-kit/components/DesignKitDemo";

// Temporary review page for the phase-1 building blocks (removed in phase 6).
export function DesignKitPage() {
  const monthNav = buildMonthNav({
    basePath: "/design-kit",
    current: { month: 6, year: 2083 },
    dateFormat: "nepali",
    selected: { month: 6, year: 2083 },
  });

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/reports">
                Full report
                <ArrowUpRight />
              </Link>
            </Button>
            <Button type="button" variant="outline">
              <ListPlus />
              Bulk add
            </Button>
            <Button type="button" variant="outline">
              <FileDown />
              Export
            </Button>
          </>
        }
        meta="12 days left in the month"
        monthNav={monthNav}
        title="Design kit"
      />
      <DesignKitDemo />
    </div>
  );
}
```

`src/modules/design-kit/index.tsx`:

```tsx
export { DesignKitPage } from "./pages/DesignKitPage";
```

`src/app/(app)/design-kit/page.tsx`:

```tsx
import type { Metadata } from "next";

export { DesignKitPage as default } from "@/modules/design-kit";

export const metadata: Metadata = { title: "Design kit" };
```

- [ ] **Step 2: Interactive demo (client)**

`src/modules/design-kit/components/DesignKitDemo.tsx`:

```tsx
"use client";

import { useState } from "react";

import { Plus } from "lucide-react";

import { AmountInput } from "@/components/AmountInput";
import { ArrowLink } from "@/components/ArrowLink";
import { EmptyState } from "@/components/EmptyState";
import { FilterMenu } from "@/components/FilterMenu";
import { Ledger, LedgerCell } from "@/components/Ledger";
import { LineTabs } from "@/components/LineTabs";
import { Meter } from "@/components/Meter";
import { Modal } from "@/components/Modal";
import { Money } from "@/components/Money";
import { Monogram, type MonogramPerson } from "@/components/Monogram";
import { MoreDetails } from "@/components/MoreDetails";
import { RowMenu } from "@/components/RowMenu";
import { GroupLabel, Row, type RowColumns, RowGroupHead, RowsHeader } from "@/components/Rows";
import { SectionHeading } from "@/components/SectionHeading";
import { Segmented } from "@/components/Segmented";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/ui/button";

type Owner = "all" | "me" | "partner" | "shared";

const ME: MonogramPerson = { name: "Nirjal", role: "me" };
const PARTNER: MonogramPerson = { name: "Karuna", role: "partner" };

const COLUMNS: RowColumns = {
  lg: "minmax(170px,1fr) minmax(0,230px) 104px 28px",
  md: "minmax(140px,1fr) minmax(0,180px) 96px 28px",
  sm: "minmax(0,1fr) 88px 28px",
};

const ROWS = [
  { amount: 2340, category: "Groceries", note: "Bhatbhateni", owner: [ME, PARTNER], ownerLabel: "Shared" },
  { amount: 500, category: "Petrol", note: "Bike", owner: [ME], ownerLabel: "Me" },
  { amount: 6900, category: "Shopping", note: "", owner: [PARTNER], ownerLabel: "Karuna" },
];

export function DesignKitDemo() {
  const [owner, setOwner] = useState<Owner>("all");
  const [tab, setTab] = useState("All");
  const [category, setCategory] = useState<null | string>(null);
  const [forWho, setForWho] = useState("Me");
  const [amount, setAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-12">
      <Ledger>
        <LedgerCell
          bar={<Meter segments={[{ tone: "ink", value: 91515 }, { tone: "partner", value: 82170 }, { tone: "shared", value: 5607 }]} />}
          label="All expenses"
          lead
          note={
            <>
              <span>103 expenses</span>
              <span className="text-signal-ink">115% of income</span>
            </>
          }
          onSelect={() => setOwner("all")}
          selected={owner === "all"}
        >
          <Money size="lead" value={179291.88} />
        </LedgerCell>
        <LedgerCell label="Me" note="51% of total" onSelect={() => setOwner("me")} selected={owner === "me"}>
          <Money size="cell" value={91515.28} />
        </LedgerCell>
        <LedgerCell label="Karuna" note="46% of total" onSelect={() => setOwner("partner")} selected={owner === "partner"}>
          <Money size="cell" value={82169.6} />
        </LedgerCell>
        <LedgerCell label="Unallocated" note="Spending is above income">
          <Money size="cell" tone="negative" value={-23691.88} />
        </LedgerCell>
      </Ledger>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="micro-label text-n-600">Safe to spend today</span>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-signal-ink">
            <span className="size-1.5 bg-signal" />
            Over budget
          </span>
        </div>
        <Money className="mt-2.5" size="hero" value={512} />
        <div className="mt-6 grid max-w-md gap-3">
          <Meter label="Spent 148% of income" ratio={1.48} />
          <Meter ratio={0.88} />
          <Meter ratio={Number.POSITIVE_INFINITY} />
        </div>
      </div>

      <section>
        <SectionHeading aside={<ArrowLink href="/expenses">All expenses</ArrowLink>}>Recent expenses</SectionHeading>
        <LineTabs
          className="mt-4"
          label="Owner"
          onChange={setTab}
          tabs={[
            { count: 6, label: "All", value: "All" },
            { count: 2, label: "Me", value: "Me" },
            { count: 3, label: "Karuna", value: "Karuna" },
            { count: 1, label: "Shared", value: "Shared" },
          ]}
          value={tab}
        />
        <div className="flex flex-wrap items-center gap-1 py-4">
          <FilterMenu
            active={category !== null}
            label={category ?? "Category"}
            onSelect={(value) => setCategory(category === value ? null : value)}
            options={[
              { count: 14, label: "Groceries", value: "Groceries" },
              { count: 9, label: "Petrol", value: "Petrol" },
              { count: 3, label: "Shopping", value: "Shopping" },
            ]}
            value={category}
          />
        </div>
        <RowsHeader columns={COLUMNS}>
          <span>Expense</span>
          <span className="@max-[559px]:hidden">For · paid by</span>
          <span className="text-right">NPR</span>
          <span />
        </RowsHeader>
        <RowGroupHead columns={COLUMNS} first>
          <GroupLabel className="col-[1/-3]" label="Today" sub="20 Ashwin, Tuesday" />
          <span className="text-right text-[15px]">
            <Money value={9740} />
          </span>
          <span />
        </RowGroupHead>
        {ROWS.map((row) => (
          <Row columns={COLUMNS} key={row.category} onClick={() => setDialogOpen(true)}>
            <div className="flex min-w-0 items-baseline gap-2.5">
              <span className="text-[15px]">{row.category}</span>
              {row.note && <span className="truncate text-[13px] text-n-600">{row.note}</span>}
            </div>
            <div className="flex items-center gap-2.5 @max-[559px]:hidden">
              <Monogram people={row.owner} />
              <span className="text-sm">{row.ownerLabel}</span>
            </div>
            <span className="text-right text-[15px]">
              <Money value={row.amount} />
            </span>
            <RowMenu
              items={[
                { label: "Edit", onSelect: () => setDialogOpen(true) },
                { label: "Repeat today", onSelect: () => undefined },
                { destructive: true, label: "Delete", onSelect: () => undefined },
              ]}
            />
          </Row>
        ))}
      </section>

      <EmptyState
        action={
          <Button type="button" variant="outline">
            <Plus />
            Create a goal
          </Button>
        }
        body="Karuna's budget sets aside Rs 20,000 for savings this month. Give it a target and you'll see how close you are each month."
        title="No goals yet"
      />

      <Modal
        footer={
          <Button className="min-w-[150px] justify-start" type="button">
            Add expense
          </Button>
        }
        onOpenChange={setDialogOpen}
        open={dialogOpen}
        subtitle="Sample dialog"
        title="Add expense"
      >
        <AmountInput autoFocus label="Amount" onChange={(event) => setAmount(event.target.value)} size="xl" value={amount} />
        <Segmented
          label="For"
          onChange={setForWho}
          options={[
            { label: "Me", value: "Me" },
            { label: "Karuna", value: "Karuna" },
            { label: "Shared", value: "Shared" },
          ]}
          value={forWho}
        />
        <MoreDetails>
          <TextField label="Vendor" placeholder="Optional" />
        </MoreDetails>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint -- --fix`
Expected: exit 0.

With `npm run dev` running, open `http://localhost:3000/design-kit` and check:
- **Month nav:** the arrows work, the label menu lists 12 months, and next is greyed out.
- **Headline figures:** cells select with a red top bar.
- **Meters:** 148% shows ink plus red, and Infinity shows all red.
- **Rows:** clicking a row opens the dialog, but choosing a ⋯ item does *not*.
- **Filter:** shows the red dot and ✓ when a category is active.
- **Dialog:** typing `Rs 1,500.50` into Amount leaves `1500.50`; the button row selects; **More details** expands.
- **Container widths:** check at about 1200px, 700px and 390px wide. The headline lead wraps below 780px and the "For" column hides below 560px.

---

### Task 12: Phase verification, review and commit

**Files:** none new.

- [ ] **Step 1: Full checks**

Run: `npm run lint -- --fix && npm run lint`
Expected: exit 0.

Run: `npm test`
Expected: all Vitest suites pass, including the new `money`, `meter`, `month-nav` and `keyboard-shortcut` tests.

Run: `npx tsc --noEmit`
Expected: exit 0.

Run: `npm run test:e2e`
Expected: the full Playwright suite passes, including `e2e/shell.spec.ts`. If a spec fails because a selector depends on old styling (rounded classes, colours), update the selector to a role or label. Don't change app behaviour to satisfy it.

- [ ] **Step 2: Visual pass**

With `npm run dev` running, screenshot `/design-kit`, `/dashboard`, `/expenses`, `/settings` and `/login` in **light** and **dark** (Settings → Theme), each at 1280px and 390px wide. Compare `/design-kit` against `.new_designs/Expenses.dc.html` and `.new_designs/Home.dc.html`: square corners, ink rules, red only as accent, and amounts set as "Rs 179,291.88". Note any mismatch and fix it before the commit.

- [ ] **Step 3: Refresh the knowledge graph**

Run: `graphify update .`
Expected: completes without error.

- [ ] **Step 4: Commit the phase**

```bash
git add -A src e2e docs/architecture.md docs/superpowers/plans
git commit -m "$(cat <<'EOF'
feat(redesign): modernist foundation and app shell (phase 1)

New palette (light/dark), square restyled primitives, shared composites
(PageHeader, Ledger, Money, Meter, Monogram, Rows, LineTabs, FilterMenu,
Segmented, AmountInput, MoreDetails, RowMenu, EmptyState), the new
sidebar with an N shortcut for Add expense, phone bottom nav, page frame,
skeleton loading, and Login. Removes the accent-colour picker.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Expected: the pre-commit hook (`tsc`, `next build`) passes and the commit lands on `redesign/modernist`.

- [ ] **Step 5: Hand over for review**

Stop and ask the user to review the sidebar, bottom nav, `/design-kit`, `/login`, and one existing page (e.g. `/expenses`) in light and dark. Their feedback goes into the Phase 2 plan.
