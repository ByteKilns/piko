# Piko — Architecture

Orientation doc for working in this repo without reading everything. Pair it with
`graphify query "<question>"` (see `AGENTS.md`) for exact cross-file relationships.

## What Piko is

A household expense tracker for a small two-person household:

- **Web app** (`src/`) — Next.js 16 (App Router, Turbopack), React 19, TypeScript,
  Tailwind v4, shadcn/radix UI. Dashboard, expenses, budgets, income, loans, savings
  goals, dhukus, recurring bills, reports, notifications.
- **Mobile app** (`mobile/`) — Flutter companion for capturing expenses by voice.
  Talks to the same Next.js backend over a small JSON API. See `mobile/README.md`.

Domain conventions that shape everything:

- **Shared vs per-member.** A row with `ownerMemberId === null` is *shared*; otherwise
  it belongs to one member. Getting this wrong changes dashboard math and privacy.
- **Household scoping.** Every domain table carries `householdId`. All reads and writes
  are scoped by it, and writes derive it from the session — never from client input.
- **Nepali (BS) calendar.** "Months" can be Bikram Sambat or Gregorian per household
  (`households.dateFormat`), resolved through `resolvePeriod` (`src/lib/month-period.ts`).

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 App Router + Turbopack (`next dev` / `next build`) |
| UI | React 19, Tailwind v4, shadcn (`src/components/ui/*`), `lucide-react` |
| DB | PostgreSQL via `postgres` driver + Drizzle ORM (`src/db/`) |
| Validation | Zod v4 (`*.schema.ts`), shared by server actions and API routes |
| Auth | next-auth v5 beta, JWT sessions, credentials (`src/auth.ts`) |
| Voice | `@google/genai` (Gemini) parses spoken text into an expense draft |
| Storage | `@vercel/blob` for published APKs |
| Dates | `bikram-sambat-js` for BS↔AD conversion |
| Tests | Vitest, colocated `*.test.ts` (`npm test`) |

## Top-level layout

```
src/
  app/            # routes only — thin files that re-export a module page
    (app)/        # authed route group; layout.tsx gates auth + renders nav
    api/          # route handlers: web (auth, app-releases) + mobile/*
    login/
  modules/        # feature slices (see below)
  components/     # shared UI: nav/, ui/ (shadcn), TextField, ErrorState, ...
  db/
    schema/       # one Drizzle table file per domain; barrel-exported in index.ts
    connection.ts # postgres client (pool timeouts here); client.ts = "server-only" re-export
  lib/            # cross-cutting helpers: session, mobile-auth, cookies, dates, gemini
drizzle/          # generated SQL migrations + meta snapshots (never hand-edit the meta)
mobile/           # Flutter app (own README)
e2e/              # Playwright browser tests (own runner; see Commands)
docs/             # this file
graphify-out/     # knowledge graph (gitignored)
```

## Module anatomy

Each feature is a slice under `src/modules/<feature>/`:

```
<feature>/
  index.tsx                 # public surface: `export { XPage } from "./pages/XPage"`
  pages/XPage.tsx           # server component page (async, calls queries)
  components/               # PascalCase components, client components where interactive
  api/
    <feature>.actions.ts    # "use server" mutations (actions)
    <feature>.ts            # Drizzle queries (no "use server")
  schemas/<feature>.schema.ts  # Zod schemas
  lib/                      # pure helpers, usually with a colocated .test.ts
  hooks/                    # client hooks (e.g. table columns)
```

A route file is a thin adapter that re-exports the page, e.g.
`src/app/(app)/expenses/page.tsx` → `export { ExpensesPage as default } from "@/modules/expenses";`.
It also carries the Next-only bits a module can't: `export const metadata` (page titles)
and, when needed, route segment config (`dynamic`, `revalidate`, `runtime`, …).
Route handlers in `src/app/api/**` are the exception — they hold real logic.

**Worked example:** `expenses`. `api/expenses.actions.ts` holds `createExpenseAction`
(session-based) plus `createExpenseForHousehold(input, { actorName, householdId })` —
the shared core that both the web action and the mobile route call. Reuse that pattern:
put the tenancy-agnostic logic in a `...ForHousehold` function so web and mobile share it.

## Request & data flow

### Web (browser session)

1. `src/auth.ts` — NextAuth credentials provider; `authorize` → `verifyCredentials`.
   Session strategy is JWT; `session.user.id` is the user id.
2. `getCurrentMember()` (`src/lib/session.ts`) → `auth()` → looks up the user's
   `householdMembers` row → returns `{ householdId, memberId, userId, name }`.
   Throws `"User does not belong to a household"` if there's no membership.
3. `getEffectiveMember()` adds **presentation-only** "viewing as" support (a cookie):
   it can only ever resolve to a member of the *caller's own* household. Never use it
   to derive `householdId` for a write — server actions call `getCurrentMember()` directly
   so a forged cookie can't cross households.
4. Pages/layout call module queries and actions. `src/app/(app)/layout.tsx` fetches the
   member, members, categories and unread count once, then renders sidebar/bottom nav.
5. Server actions re-derive the member themselves (`getCurrentMember()`), scope by
   `householdId`, then `revalidatePath(...)`.

### Mobile (bearer token)

1. `POST /api/mobile/login` → `signMobileToken(userId)` (`src/lib/mobile-auth.ts`): an
   HS256 JWT signed with `AUTH_SECRET`, TTL 90 days. The app stores it in
   `flutter_secure_storage`.
2. Every request carries `Authorization: Bearer <token>`.
3. `requireMobileAuth(request)` (`src/lib/mobile-request.ts`) verifies it and resolves a
   `CurrentMember`, or returns a 401 `NextResponse` — check with
   `if (auth instanceof NextResponse) return auth;`.
4. Handlers reuse the same `...ForHousehold` core the web actions use.

## Domain model

`src/db/schema/` (all tables re-exported from `index.ts`):

- **Identity** — `users`, `households`, `household_members` (join of user↔household;
  the source of `householdId`/`memberId` for a session).
- **Money in/out** — `categories` (per household, `budgetType` fixed/flexible, archivable),
  `expenses` (`paidByMemberId` required, `ownerMemberId` null=shared, optional
  `recurringExpenseId`), `incomes` (per member/month), `recurring_expenses` (bills with
  `nextDueDate`), `monthly_budgets` + `budget_items` (planned amount per category/owner).
- **Goals & obligations** — `savings_goals` + `savings_contributions`,
  `loans` + `loan_payments` (`direction` given/taken), `dhukus` + `dhuku_entries`
  (rotating savings group: contribution/payout).
- **System** — `notifications` (deduped via unique `(householdId, dedupeKey)`),
  `app_releases` (global, not per-household; published APK builds).

Conventions to keep when adding columns/tables:

- `householdId` FK with `onDelete: "cascade"` on every domain table.
- Money is `numeric(12,2)`; Drizzle returns it as a **string** — pass `String(x)` in,
  `Number(x)` out (see the mobile expenses route).
- `ownerMemberId` nullable means *shared*.
- Notifications are deduped by `dedupeKey` so generating code can re-run safely.

## Cross-cutting concerns

- **Migrations** live in `drizzle/` (generated by `drizzle-kit generate`, applied by
  `drizzle-kit migrate`). Never hand-edit `drizzle/meta/*`.
- **Cookies** (all in `src/lib/*-cookie.ts`): `accent-color`, `date-format`,
  `sidebar-collapsed`, `notification-preferences`, `viewing-as`.
- **Error logging**: `src/instrumentation.ts` (`onRequestError`) unwraps `error.cause`
  chains so the real Postgres error is visible server-side — the client error boundary
  (`src/components/ErrorState.tsx`) only sees a stripped message.
- **AI budget planner** (`src/modules/budget-planner/`): derives an envelope
  (income − fixed commitments − savings) and a masked payload for the AI. The
  privacy boundary is `lib/mask-financial-context.ts` — the only producer of
  `MaskedFinancialContext` (shares + opaque category/owner tokens; no amounts,
  names, dates or notes). The model returns token-keyed shares of the envelope;
  `lib/build-plan.ts` maps them back to real categories/owners, converts to
  amounts, and enforces invariants (drops unknown tokens, scales into the
  flexible pool) for review — nothing is written until the user applies a row
  via `setBudgetItemAction`. Gated by `AI_BUDGET_PLANNER=off|mock|live`; `mock`
  is deterministic and offline. `npm run eval:planner` runs the real model
  offline against fixtures (not part of CI).
- **App releases**: publishing is gated by `APP_RELEASE_ADMIN_EMAILS`
  (`src/lib/release-admin.ts`); APKs are uploaded to Vercel Blob via a client-token
  flow (`src/app/api/app-releases/upload/route.ts`). `handleUpload` requires
  `BLOB_READ_WRITE_TOKEN` (OIDC alone is not enough). Full procedure in `mobile/README.md`.

## Task playbooks

**Add a DB column**
1. Edit the table in `src/db/schema/<domain>.ts`.
2. `npm run db:generate` → new `drizzle/NNNN_*.sql` + snapshot.
3. `npm run db:migrate`.
4. Thread it through the Zod schema, `...ForHousehold` core, and the form/page.

**Add a feature module**
1. Create `src/modules/<x>/` with `index.tsx`, `pages/`, `components/`, `api/`, `schemas/`.
2. Add a thin route: `src/app/(app)/<x>/page.tsx` re-exporting the page.
3. Add the nav entry in `src/components/nav/` (`SidebarNav` / `BottomNav`).
4. Queries/actions must scope by `householdId` via `getCurrentMember()`.

**Add a mobile endpoint**
1. `src/app/api/mobile/<x>/route.ts` using `requireMobileAuth`.
2. Put the real logic in a `...ForHousehold` function in the owning module so the web
   and mobile paths stay in sync; validate with the module's Zod schema.

**Publish an app release** → follow `mobile/README.md`.

## Commands

```sh
npm run dev                 # Next dev server (also rewrites the AGENTS.md nextjs block)
npm run lint                # ESLint (perfectionist ordering) — add -- --fix
npm run test                # Vitest (unit/integration)
npm run test:e2e            # Playwright browser tests (builds + serves prod on :3100)
npm run e2e:serve           # `next build && next start -p 3100` — what Playwright starts
npm run build               # production build (runs tsc too; part of the pre-commit hook)
npm run db:generate         # generate a migration from schema changes
npm run db:migrate          # apply migrations to .env.local's DATABASE_URL
npm run db:seed             # seed household + 2 users + default categories
npm run eval:planner        # offline AI eval over fixtures (needs AI_BUDGET_PLANNER=live)

# mobile (from mobile/)
flutter build apk --release --split-per-abi
```

`DATABASE_URL` comes from `.env.local` (local dev) or Vercel env (deployed). `npm run
db:migrate` / `db:seed` use whatever `.env.local` points at, so confirm the target before
running them.
