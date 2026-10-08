# Handover — Piko "modernist" redesign

You are taking over a visual redesign of the Piko web app partway through. Read this whole file before writing code. It tells you what's done, what's left, the rules, the shared building blocks, and how to verify your work.

- **Repo:** this one (Next.js 16 web app in `src/`; ignore `mobile/`).
- **Branch:** `redesign/modernist`. Work and commit here. Don't push, merge or deploy unless the user asks.
- **Source of truth for the design:** `.new_designs/*.dc.html` (mockups) and `docs/superpowers/specs/2026-10-07-modernist-redesign-design.md` (the spec; it wins over this file if they disagree).
- **Read first:** `AGENTS.md`, `docs/architecture.md`, then the spec.

---

## 1. Where things stand

Commits on the branch (newest first):

| Commit | What |
| --- | --- |
| `e8561a6` | Expenses page rebuilt to match `.new_designs/Expenses.dc.html` (**the reference implementation, copy its patterns**) |
| `9cdd95e` | Red primary buttons; app opens in light mode by default |
| `a64014f` | Review fixes: amount paste ("Rs. 1,500"), N shortcut vs dropdowns, 16px inputs on phones |
| `005d6da` | Phase 1: tokens, restyled primitives, shared components, sidebar, bottom nav, page frame, loading/error, Login, `/design-kit` preview |
| `e45c7d4`, `9ccc16e` | Spec + mockups |

All checks were green at `e8561a6`: `npx tsc --noEmit` clean, `npm run lint` 0 errors (8 old `<img>` warnings are pre-existing, ignore), `npm test` 285/285, `npm run test:e2e` 39/39.

**Done:** sidebar, phone bottom nav, page frame, Login, Expenses (page + Add/Edit dialog + Bulk add).
**Not done:** every other page still has its old content sitting on the new colours.

---

## 2. Rules you must follow

1. **Next.js 16 is not the Next.js you know.** Before using any Next API you haven't seen in this repo, read the guide in `node_modules/next/dist/docs/`.
2. **Household scoping:** every DB query filters by `householdId`; writes get it from the session (`getCurrentMember()`), never from client input. Pages read with `getEffectiveMember()`.
3. **Ordering is linted** (eslint-plugin-perfectionist): imports `react` → third-party → `@/…` (blank line between groups, alphabetical inside); object-type keys, named imports and JSX props alphabetical. Just run `npm run lint -- --fix` after editing.
4. **File names:** components `PascalCase.tsx`, libs `kebab-case.ts`, hooks `useX.ts`, schemas `x.schema.ts`, actions `x.actions.ts`. Feature code lives in `src/modules/<feature>/{pages,components,lib,api,schemas}`; `src/app/(app)/<route>/page.tsx` only re-exports the module page.
5. **Pre-commit hook** runs `npx tsc --noEmit` and `npm run build` (~1–2 min). Never use `--no-verify`; fix the error instead.
6. **Tests first for logic:** pure functions go in `src/modules/<feature>/lib/*.ts` with a Vitest `*.test.ts` next to them (Vitest runs in **node**, no DOM, no React Testing Library). Write the test, watch it fail, then implement.
7. **Every mutation already logs activity** via existing actions. Reuse existing server actions; if you add one, follow the `...ForHousehold` + `logActivity` pattern in `docs/architecture.md`.
8. **Don't break e2e.** Run the specs you touched, and the full suite before each commit.
9. After code changes: `graphify update .` (keeps the code graph current; free).
10. **Ask the user** before: DB migrations on production, deleting user data, pushing.
11. **Backend not ready for a mockup feature?** The user said: build the UI first with mock data. Put mock values in one clearly named constant in the page (e.g. `const MOCK_CARRY_OVER = …` with a `// MOCK until phase 2: <what's missing>` comment), never fake a write, and list it in your hand-back.

---

## 3. Design system (already built — use it, don't invent new styles)

### Tokens (Tailwind classes) — `src/app/globals.css`

| Class | Use |
| --- | --- |
| `bg-paper` | page/panel background (`#faf8f4`) |
| `bg-surface` | icon tiles, active nav row |
| `text-ink`, `bg-ink`, `border-ink` | text, 2px top rules, selected segmented option |
| `border-rule` | 2px rules under column headers / section headings |
| `n-200 … n-800` (e.g. `text-n-600`, `border-n-300`, `bg-n-200`) | warm greys: 200 meter track, 300 row lines, 400 input borders, 500 paisa digits, 600 labels, 700 secondary text, 800 body |
| `bg-signal` / `text-signal-ink` | the red accent: marks (active bars, dots, overspend) / red text (over budget, negative, Delete, errors) |
| `bg-signal-fill` | primary buttons only (the `Button` default variant already uses it) |
| `shadow-menu`, `shadow-dialog` | the only shadows allowed |
| `micro-label` | 11px uppercase label. **Has no colour** — always add `text-n-600` (or `text-ink` when selected) |

- Radius is 0 everywhere (don't add `rounded-*`).
- Dark mode works automatically through the tokens; don't hard-code colours.
- **Canonical Tailwind values:** write `h-9.5` not `h-[38px]`, `bg-ink/6` not `bg-ink/[0.06]`, `max-w-280` not `max-w-[1120px]`. Keep arbitrary values only when off the 4px scale (`text-[15px]`, `tracking-[-0.02em]`).
- **Responsive = container queries**, measured against the page content (the `(app)` layout puts `@container` on it): use `@min-[780px]:` (desktop layout in the mockups), `@min-[560px]:`, and `@max-[559px]:hidden` for phone. Don't use `md:`/`lg:` for page layout.
- **Each redesigned page must render a single root `<div>`** (the layout wrapper still has `space-y-6` for old pages; it's removed in phase 6).

### Shared components (`src/components/` unless noted)

| Component | Use it for | Key props |
| --- | --- | --- |
| `PageHeader` | title row | `title`, `monthNav?`, `meta?` ("12 days left in the month"), `subtitle?` (pages without months), `actions?` |
| `buildMonthNav` (`@/lib/month-nav`) | data for the month switcher (server side) | `{ basePath, current, selected, dateFormat, allowFuture? }` → `MonthNavModel`. **Budget passes `allowFuture: true`**, everyone else stops at the current month |
| `Ledger` + `LedgerCell` | headline-figure row | cell: `label`, `lead?`, `note?`, `bar?`, `onSelect?`/`selected?` (makes it a filter button) |
| `Money` | every amount | `value`, `size` = `row` (inherits font, no "Rs") / `cell` / `lead` / `hero`, `tone` = `default`/`muted`/`negative`, `currency?` |
| `Meter` | 4px bars | `ratio` (ink to 100%, red overspend beyond) **or** `segments=[{tone:"ink"|"partner"|"shared", value}]`, `label?` |
| `Monogram` | square initials | `people=[{ name, role: "me"|"partner" }]` (shared = both), `size` sm/md/lg |
| `SectionHeading` | 20px section title + 2px rule | `children`, `aside?` (e.g. `<ArrowLink>`), `sub?`, `rule?` |
| `ArrowLink` | "All expenses ↗" links | `href`, `children` |
| `EmptyState` | empty / error messages | `title`, `body`, `action?`, `size` md/lg |
| `LineTabs` | text tabs with red underline | `label`, `tabs=[{label,value,count?}]`, `value`, `onChange`, `aside?` |
| `FilterMenu` | "Category ▾" text dropdown | `active`, `label`, `options=[{label,value,count?}]`, `value`, `onSelect` (caller decides toggle/replace) |
| `Segmented` | one-of-n buttons (native radios) | `label`, `options`, `value`, `onChange`, `hideLabel?` |
| `AmountInput` | big "Rs ____" field | `label`, `error?`, `size` lg/xl; works with react-hook-form `register`; add `data-autofocus` to focus it when a Modal opens |
| `MoreDetails` | collapsed extra fields in dialogs | `children`, `forceOpen?` |
| `RowMenu` | ⋯ menu on rows | `items=[{label,onSelect,destructive?}]` (destructive go below a rule, red) |
| `Rows`: `RowsHeader`, `RowGroupHead`, `GroupLabel`, `Row` | grid "tables" | `columns={ lg, md?, sm? }` = CSS grid templates per width band; `Row` has `onClick?` and `data-slot="row"` (e2e uses it) |
| `Modal` | every dialog | `title`, `subtitle?`, `footer?` (put the primary button here; **Modal adds Cancel itself**), `hint?` ("Enter to save · Esc to close"), `className` for width (e.g. `sm:max-w-125`) |
| `PageSkeleton` | loading state (already wired in `(app)/loading.tsx`) | — |
| `CategoryIcon` (`@/modules/categories/components/CategoryIcon`) | 28px icon tile for a category | `name`, `groupName`, `variant` filled/outline (outline = scheduled/upcoming) |
| `ExpenseDialog` (`@/modules/expenses/components/ExpenseDialog`) | Add/Edit expense anywhere | `open`, `onOpenChange`, `categories`, `members`, `currentMemberId`, `expenseId?` (edit), `initial?`, `quickCategoryIds?` |

Live examples of all of them: `/design-kit` (temporary page; delete in phase 6).

### Copy-this pattern (from Expenses)

- `src/modules/expenses/pages/ExpensesPage.tsx` (server): reads data, computes `monthNav`, `today = todayISO()`, `daysLeft`, maps DB rows (numeric strings → `Number`), passes plain data to a client view.
- `src/modules/expenses/components/ExpensesView.tsx` (client): `PageHeader` → `Ledger` → filter bar → `RowsHeader` + groups of `RowGroupHead`/`Row` → footer → dialogs. State is local (`useState`); mutations call server actions then `router.refresh()` and show a `toast`.
- `src/modules/expenses/lib/expense-view.ts` (+ test): all filtering/grouping/totals logic, pure.

---

## 4. Remaining work, in the recommended order

The user wants pages to look **exactly** like the mockups. Read the matching `.dc.html` first: it is HTML with inline styles (padding, font sizes, colours as `var(--color-…)`) plus a `<script type="text/x-dc">` at the bottom with the page's logic and sample data. Map its CSS variables to our tokens: `--color-text`→`ink`, `--color-bg`→`paper`, `--color-surface`→`surface`, `--color-divider`→`rule`, `--color-neutral-NNN`→`n-NNN`, `--color-accent`→`signal`, `--color-accent-700`→`signal-ink`, `btn-primary`→`<Button>`, `btn-secondary`→`<Button variant="outline">`, `btn-ghost`→`<Button variant="ghost">`, `.seg`→`Segmented`, `.input`→`Input`/`TextField`.

The spec sections give the exact contents of each page (§3.x designed pages, §4.x pages without mockups). Summary:

1. **Home** (`src/modules/dashboard`, mockup `Home.dc.html`, spec §3.1) — safe-to-spend hero, Ledger (Spent / Income / Saved / Unallocated), "By person" rows, Recent expenses + Savings goals. *Needs phase-2 pacing carry-over for "Buffer from last week"* → mock it per rule 11 if you do Home before phase 2. Clicking Income should open a Set income dialog (reuse `setIncomeAction`).
2. **Budget** (`src/modules/budget`, `Budget.dc.html`, §3.3) — lead sentence, Ledger, LineTabs by person, rows grouped by owner, "Without a budget" collapsible list, per-row budget dialog (Type changes the category's `budgetType`), **Set income** dialog, Copy last month (exists). `allowFuture: true` on month nav.
3. **Recurring** (`Recurring.dc.html`, §3.4) — Ledger, day-by-day strip, LineTabs with counts, rows with Mark paid, dialog with MoreDetails. *Quarterly needs phase 2* (DB enum) — leave it out of the options until then.
4. **Savings goals** (`Savings.dc.html`, §3.5), **Dhuku** (`Dhuku.dc.html`, §3.6; *Mark completed/Reopen needs phase 2 `completed_at`*), **Reports** (`Reports.dc.html`, §3.7; spending-pace chart is hand-built SVG).
5. **Pages without mockups** (§4): Loans, Categories, Notifications, Activity, Settings — same language (PageHeader, Ledger where there are numbers, LineTabs, Rows, RowMenu, Modal).
6. **Phase 2 data work** (§5 of the spec) — ask the user before running migrations against production:
   - `categories.icon` (nullable text) + icon picker (reuse `src/modules/recurring/components/IconPicker.tsx`); `CategoryIcon` should prefer it over the name guess.
   - `recurring_frequency` + `'quarterly'` (due date +3 months; ⅓ per month in stats).
   - `dhukus.completed_at` (nullable timestamp) + mark-complete / reopen actions with activity logging and revert support.
   - Weekly pacing carry-over in `src/modules/dashboard/lib/pacing.ts` (spec §3.1, TDD).
   - Workflow: edit `src/db/schema/*.ts` → `npm run db:generate` → `npm run db:migrate` (local). Never hand-edit `drizzle/meta`.
7. **Phase 6 cleanup**: delete `/design-kit` (`src/app/(app)/design-kit`, `src/modules/design-kit`), unused old components (`StatCardGrid`, `StatAmount`, `ToneIcon`, `TabSwitcher`, `DataTable`, `TrendLine`, `DashboardPanel` once nothing imports them — check with grep), the `space-y-6` on the layout wrapper, old tokens `surface-secondary/featured/positive` and `chart-*`; update `docs/architecture.md`.

### Known small follow-ups (from the code review; do them when you first touch the component)

- `MoreDetails`: after the user collapses it, `forceOpen` no longer reopens it — fix before using it in a real form.
- `LineTabs`: has tab roles but no arrow-key support — rebuild on Radix Tabs or switch to `aria-pressed` buttons.
- `AmountInput`/`TextField`: link the error text via `aria-describedby`.
- `MonthNav` links drop other query params (would reset filters if a page keeps filters in the URL).
- `PageSkeleton` duplicates Ledger's class strings.

### Open question for the user

The exact red is an estimate (`#d23a24`, dark `#ef5a42`; fill `#d23a24`). The user may send the real hex — it's a change to `--signal`, `--signal-ink`, `--signal-fill` in `globals.css`.

---

## 5. Verifying your work

```bash
npm run lint -- --fix && npm run lint   # 0 errors expected (8 old warnings OK)
npx tsc --noEmit
npm test                                 # Vitest, all must pass
npm run test:e2e                         # Playwright; builds + seeds its own DB, serves on :3100 (~1–2 min)
npx playwright test e2e/expenses.spec.ts --reporter=line   # one spec
```

- e2e uses a separate database (`piko_e2e`, reset and seeded by `scripts/seed-e2e.ts`, household date format **english**). It never touches the dev DB.
- e2e helpers: `e2e/support/nav.ts` (`gotoRoute`), `e2e/support/expenses.ts` (`expenseRow`, `searchExpenses`, `pickFirstCategory`, `openRowMenu`, `addExpenseFromSidebar`).
- When you rename visible text or change a page's structure, update the specs that target it (`grep -rn "<old text>" e2e`). Prefer role/label selectors; rows use `[data-slot="row"]`.
- **Look at the result.** Run `npm run dev`, sign in, and compare the page with the mockup at desktop width, ~700px and 390px, in light and dark. Screenshots via Playwright are fine.

---

## 6. Gotchas we already hit (save yourself the time)

- **React Compiler lint "Cannot create components during render"** when you do `const Icon = someFunction(); <Icon/>`. Use `createElement(someFunction(...), props)` (see `CategoryIcon.tsx`) or a static map + property access.
- **React bubbles portal events to the React parent**: a click inside a dropdown in a clickable `Row` would also trigger the row. `RowMenu` already stops propagation; do the same for any button inside a `Row` (`event.stopPropagation()`).
- **Dialog forms reset by themselves**: Radix unmounts closed dialog content, so a form rendered inside `Modal` starts fresh every open. If the form state lives *outside* the Modal (e.g. `useForm` in the dialog component itself), remount with a `key` per open (see `bulkKey` in `ExpensesView`).
- **Submit button in the Modal footer** is outside the `<form>`: give the form an `id` and the button `form={id}` + `type="submit"`.
- **Playwright `name` matching is case-insensitive substring** by default; use `exact: true` when it matters.
- **Hydration race in e2e**: keys pressed right after navigation can be lost. Wait for something interactive first (see `openAddExpenseWithShortcut` in `e2e/shell.spec.ts`).
- **The N shortcut** (open Add expense) is global (`src/components/nav/useAddExpenseShortcut.ts`); it ignores inputs, dropdowns (`combobox`/`listbox`/`option`), open dialogs and menus.
- **Dates:** expenses store AD `YYYY-MM-DD`; display with `formatShortDate(date, dateFormat)` / `formatPeriodLabel` (BS or AD per household). Pass `today` from the server (`todayISO()`) to client components to avoid hydration mismatches.
- **Money from the DB is a string** (`numeric`): `Number(row.amount)` before maths.
- **Windows + Git Bash:** files use CRLF; prefer your editor/file tools over `sed` for multi-line edits; long inline shell heredocs containing quotes have failed to parse — write files with the file-writing tool instead.
- `formatNPR` (old "RS 1,234" format) is still used by the activity log text; don't change it. New UI uses `Money` / `formatMoney`.

---

## 7. When you finish a chunk

1. All checks in §5 green.
2. Commit on `redesign/modernist` with a message like `feat(budget): rebuild the Budget page to match the mockup` and end it with your own co-author line if your tooling uses one.
3. Tell the user: what changed, what's mocked (rule 11), anything you decided on their behalf, and what's next.
