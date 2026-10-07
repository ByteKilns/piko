# Modernist redesign — design spec

Date: 2026-10-07 · Branch: `redesign/modernist` · Source mockups: `.new_designs/*.dc.html`

## Goal

Restyle every page of the Piko web app to the "modernist" mockups in `.new_designs/`
(Sidebar, Home, Expenses, Budget, Recurring, Savings, Dhuku, Reports), and extrapolate the
same language to the pages that have no mockup (Loans, Categories, Notifications, Activity,
Settings, Login).

## Decisions (agreed with the user)

| Topic | Decision |
| --- | --- |
| Scope | **Match the designs fully** — new behaviours shown in mockups are built (incl. schema changes); panels the mockups omit are removed. |
| Tokens | The mockups' design-system stylesheet is not available — **values are inferred** from the mockups (below). Font stays **Host Grotesk**. |
| Theme | **Keep light/dark/system and the accent picker**; red becomes the new default accent. |
| Forms | **Design fields first**; fields the design omits but the app needs/stores live in a collapsed **More details** section with sensible defaults. |
| Delivery | **Phased on `redesign/modernist`**, one commit per phase, user review between phases. |
| Build approach | Re-theme shadcn primitives in place + a small set of shared composites (approach A). |

## 1. Visual foundation

### 1.1 Tokens (`src/app/globals.css`)

Light (`:root`):

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#faf8f4` | page + panel background |
| `--surface` | `#f0ede7` | icon tiles, active nav row, focused bulk-add cell |
| `--ink` | `#201e1d` | text, primary button fill, 2px section rules |
| `--rule` | `#3d3936` | 2px column-header / sidebar rules, 1px group rows |
| `--n-200 … --n-800` | `#e6e2db` `#d8d3cb` `#b5afa6` `#8f8981` `#6e6862` `#56514c` `#3d3936` | warm neutral scale (200 meter track, 300 row rules, 400 disabled, 500 decimals/placeholder, 600 labels, 700 secondary text, 800 body copy) |
| `--signal` / `--signal-ink` | `#d23a24` / `#a82a18` | **accent** (picker-driven): active-nav bar, tab underline, selected-ledger bar, filter dot, today marker, caret, payout cell, unread badge |
| `--negative` / `--negative-ink` | `#d23a24` / `#a82a18` | **always red**: over budget, over income, overdue, negative amounts, Delete |
| `--shadow-md` / `--shadow-lg` | `0 4px 16px rgb(32 30 29 / .12)` / `0 16px 48px rgb(32 30 29 / .22)` | menus / dialogs only |

Dark (`.dark`): `--paper #161413`, `--surface #22201e`, `--ink #f3efe8`, `--rule #d3cec6`,
neutrals inverted (`--n-200 #2a2725` … `--n-800 #d3cec6`), `--signal #ef5a42`,
`--signal-ink #ff8a73`, `--negative #ef5a42`, `--negative-ink #ff8a73`, shadows at higher alpha.

**Accent vs negative split.** The mockups use one red for two jobs. Because the accent picker
stays, they are split: the picker changes only `--signal`/`--signal-ink`; `--negative` stays red
so "over budget" never turns green. With the default (red) accent the result is identical to
the mockups.

Accent presets (`[data-accent]`, light + dark variants): **red (new default)**, purple, blue,
green, pink, orange. `ACCENT_COLOR` type and cookie default change from `purple` to `red`;
an existing cookie is respected.

shadcn token mapping: `--background → paper`, `--foreground → ink`, `--card/--popover → paper`,
`--primary → ink`, `--primary-foreground → paper`, `--secondary/--muted → surface`,
`--muted-foreground → n-600`, `--accent → color-mix(ink 6%)` (hover tint),
`--destructive → negative`, `--border → n-300`, `--input → n-400`, `--ring → signal`,
`--radius: 0`. Tailwind `@theme inline` exposes `paper, surface, ink, rule, n-200…n-800,
signal, signal-ink, negative, negative-ink`. The old `surface-secondary/featured/positive`
and `chart-*` tokens are removed in phase 6.

### 1.2 Type & shape

- Host Grotesk; weights 400 / 600 / 800. All amounts use `tabular-nums`.
- Page title 42px/1, weight 800, tracking −0.02em. Section heading 20px/1.2, 800, −0.01em.
  Micro-label 11px, 600, uppercase, tracking 0.08em, `n-600`. Body 14–15px. Meta 12–13px.
- Radius 0 everywhere. No card chrome, no shadows except menus (`shadow-md`) and dialogs (`shadow-lg`).
- Rules: 2px `ink` tops a ledger/section; 2px `rule` under column headers & section headings;
  1px `n-300` between rows; 1px `rule` under group heads.
- Hover = `color-mix(in srgb, ink 6–7%, transparent)` background.

### 1.3 Primitive restyle (`src/components/ui/*`)

`button` (variants: `primary` ink fill, `secondary` 1px ink outline, `ghost` text-only,
`icon`; heights 38/40px), `input`/`select` (square, 1px `n-400`, 38px, focus ring = signal),
`dialog` (layout in §2.4), `dropdown-menu` (square, 1px rule border, `shadow-md`, 8×14px items,
destructive items `negative-ink`), `tabs` (superseded by `LineTabs`), `sheet`, `popover`,
`sonner` (square, 1px rule border), `avatar` (square). Radix behaviour (focus trap, keyboard,
ARIA) is kept.

### 1.4 Shared composites (`src/components/`)

| Component | Contract |
| --- | --- |
| `PageHeader` | `title`, optional `month` nav (`prevHref`, `nextHref`, label, picker, `nextDisabled`), optional `subtitle`/`meta` ("12 days left in the month"), `actions` slot. **Next is disabled at the current month** (as in the mockups) on Home, Expenses, Recurring, Savings and Reports; **Budget still allows next month** so budgets can be planned ahead. |
| `Ledger` / `LedgerCell` | Grid with one **lead** cell (40px figure, bar slot) + up to 3 cells (24px). 2px ink top, 1px rule bottom, 1px n-300 separators. Cells can be buttons (`selected` → 4px signal bar on top). Container-query layout: ≥780px `1.55fr 1fr 1fr 1fr`; <780px lead spans full row, others 3-up. |
| `Money` | `value`, `size` (`lead 40` / `hero 76` / `cell 24` / `row 15`), `currency` (show "Rs"), `tone` (`default`/`muted`/`negative`). Renders `Rs` + grouped integer (`en-US`, minus sign `−`) + smaller lighter `.dd`. Pure `splitAmount(value)` helper. |
| `Monogram` | `members: {name}[]` → 20/22px squares with initial; first member ink, partner `n-600`; overlap −4/−5px with 2px paper ring. Shared = both. |
| `Meter` | 4px bar on an `n-200` track; `ratio`; when `ratio > 1` the ink part is `1/ratio` of the width and the overspend remainder is `negative`; optional `segments` for stacked bars (owner split). |
| `SectionHeading` | 20px h2 + 2px rule + optional right slot (link with ↗ / note). |
| `LineTabs` | Text tabs, optional count, 2px signal underline on active; `role="tablist"`. |
| `FilterMenu` | Text trigger (label or selected value, signal dot when active) + square menu with ✓ items and optional counts. |
| `AmountInput` | Big numeric input (40–44px, weight 800) with "Rs" prefix and 2px ink underline, error line in `negative-ink`. Accepts digits/`.`/`,`. |
| `Segmented` | Radio group rendered as joined square buttons. |
| `GroupedRows` | Grid table: header row (micro-labels, 2px rule), group head rows (label, sub, total), body rows (1px n-300), optional row click + `RowMenu` (⋯). Container-query column sets; <560px rows stack (primary left, amount right, secondary columns hidden). |
| `MoreDetails` | Disclosure ("More details ▾") inside dialogs for extra fields. |
| `EmptyState` | Heading + one sentence + one action. |
| `CategoryIcon` | 28px surface tile with lucide icon from `categories.icon` or `guessCategoryIcon(name)`; outlined variant for upcoming/paid. |

Existing `StatCardGrid`, `StatAmount`, `ToneIcon`, `TabSwitcher`, `DataTable`, `TrendLine`,
`DashboardPanel` are retired as their last consumer is migrated.

## 2. Shell

### 2.1 Sidebar (`components/nav/SidebarNav.tsx`)

- 244px, sticky, `paper` bg, 2px `rule` right border; collapsed 64px icon rail (cookie kept).
- Brand: 32px ink square "P" + "Piko" (17px/800) + "Plan together, grow together" + collapse button.
- `Add expense` primary button (title "Add expense (N)") + square secondary voice button.
- Groups with micro-labels: **Everyday** (Home, Expenses, Budget, Recurring), **Saving &
  lending** (Savings Goals, Loans, Dhuku), **Insight** (Reports, Categories).
- Bottom (1px rule, `margin-top:auto`): Notifications (square signal count badge), Activity,
  **Settings**, **account row** (monogram + name → menu: Sign out). Settings/account are additions.
- Active item: `surface` bg, 600 weight, 3px signal bar at left. Items 36px tall, 16px icons.
- Global keyboard shortcut: **N** (not while typing, no modifiers, no open dialog) opens Add expense.

### 2.2 Bottom nav (`components/nav/BottomNav.tsx`, <768px)

Same slots (Home, Expenses, Budget, Settings, More). 2px rule top; active = ink + 2px signal bar
above. FABs become squares (ink Add, outlined voice); scroll-hide behaviour unchanged. More
sheet lists the sidebar groups.

### 2.3 Frame (`app/(app)/layout.tsx`)

`main` padding 36/48/64px (desktop), 20/16px (mobile); inner `max-width: 1120px`, left-aligned,
`@container` for container queries. `loading.tsx` = skeleton of header + ledger + rows;
`error.tsx`/`ErrorState` restyled as `EmptyState`.

### 2.4 Dialog layout

Header (20px/800 title, optional sub-line, close button, 2px rule) · body 24px padding, 22px gap ·
footer (1px n-300 rule; primary left-aligned min-width ~140px, Cancel, right hint "Enter to save ·
Esc to close" on desktop). Overlay `color-mix(n-900 45%)`. Max-height `100vh − 48px`, internal
scroll; phones: width `100% − 32px`.

## 3. Designed pages

Pages read data exactly as today unless stated. "Partner" = the other household member's name.

### 3.1 Home (`modules/dashboard`)

- `PageHeader`: "Home", month nav, days left, ghost **Full report ↗** → `/reports`.
  Removed: greeting, header notification dropdown (`DashboardHeader`).
- **Safe-to-spend hero** (2-col ≥780px): micro-label + status tag (`Over budget` negative /
  `On track` ink), hero `Money`, sentence, "How is this worked out?" disclosure; right `dl`:
  This week left · Weekly allowance · Buffer from last week. Over state copy: "This week's
  allowance is fully spent. A new weekly allowance of Rs X starts on {weekday}." No flexible
  budget → `EmptyState` linking to Budget.
- **Pacing change** (`dashboard/lib/pacing.ts`, TDD): unspent allowance carries forward —
  `carryIn(week k) = max(0, allowance(k−1) + carryIn(k−1) − spent(k−1))`;
  `remaining = max(0, allowance + carryIn − spentThisWeek)`;
  `safeToday = remaining / daysLeftInWeek` (days from today to `week.endDay`, inclusive).
  `WeekPacing` gains `carryIn`, `daysLeftInWeek`, `safeToday`, `nextWeekStartDay`. The 15%
  last-week buffer stays in the schedule. The weekday name is resolved from the period date.
- **Ledger**: Spent in {month} (lead: `% of income` (negative when >100), change vs previous
  month, meter ink = covered by income / negative = beyond) · Income (change vs prev; click →
  opens Set income dialog) · Saved (month contributions) · Unallocated (negative tone when <0).
- **By person** `GroupedRows`: Person (monogram) · Income (+ trend) · Spent · Left ("over income"
  negative / "% of income") · Income used (meter + %). Shared row: "—" income/left, "Split between both".
- Two columns (`auto-fit minmax(320px)`): **Recent expenses** (grouped by day with day total,
  CategoryIcon, category + note, amount; link "All expenses ↗") and **Savings goals** (top goals
  with meters, or empty state mentioning the Savings budget amount if one exists; link "All goals ↗").

### 3.2 Expenses (`modules/expenses`)

- `PageHeader` actions: ghost Full report, secondary **Bulk add**, secondary **Export** (existing CSV).
- **Ledger as owner filter**: All (lead; "N expenses", "% of income", 3-segment owner meter) ·
  Me · Partner · Shared ("% of total"). Selection filters the list (client state).
- **Filter bar**: search (notes + category names), `FilterMenu` Category (with counts), Paid by,
  Dates (Whole month / Last 7 days / Today), Clear, "N shown".
- **List** (`GroupedRows`): groups = **Upcoming** (active recurring items not paid this month,
  sub "Scheduled from Recurring", muted amounts, outlined icon, **Mark paid** via
  `markRecurringExpensePaidAction`; hidden for "Today" range) then days (Today / Yesterday /
  weekday, sub = date, day total). Row: CategoryIcon · category + note (note hidden when equal to
  category) · "For · paid by" (monograms + owner + "paid by X" when differs) · amount · ⋯.
  Row click = Edit. ⋯: Edit, **Repeat today** (new: creates a copy dated today via the existing
  create action), Delete.
- **Progressive reveal**: first 7 days with entries shown; footer "Showing X of Y expenses" +
  **Show earlier days** (+7 days). Client-side; month data already loaded.
- **Add/Edit dialog**: AmountInput (autofocus) · Category (existing combobox) + 5 quick chips
  (household's most-used categories this month, fallback alphabetical) · For / Paid by
  (`Segmented`) · Date (`NepaliDateField`) · Note. Submit label "Add expense" / "Save changes".
- **Bulk add dialog** (1080px): spreadsheet grid Date · Category · Amount · For · Paid by · Note · ×;
  cells are borderless inputs with surface + signal underline on focus; Add row; footer
  "N expenses · Rs total", Cancel, **Save N expenses** (disabled when none valid). Rows without
  an amount are skipped. Reuses existing bulk action.

### 3.3 Budget (`modules/budget`)

- `PageHeader` actions: ghost **Copy {prev}'s budget** (existing), secondary **Add budget**,
  ghost **Set income** (new placement; dialog with one AmountInput per member, existing
  `setIncomeAction`).
- **Lead sentence** (20px): "You've planned **X% of this month's income**, yet **Y% of
  spending** happened outside a budget. **{Cat}** is Rs N over." / "**N categories** are over
  budget." / "Every budget is within plan." Pure builder, TDD.
- **Ledger**: Budgeted (lead, meter vs income, "X% of Rs income") · Spent in budgets ("X% of
  what's budgeted") · Spent outside ("X% of all spending") · Left to plan ("X% of income").
- `LineTabs` All / Me / Partner / Shared + "Click a row to change its budget".
- `GroupedRows` grouped by owner: group head = monograms + name + "N budgets · Rs X spent in all"
  + totals + meter; rows sorted by used ratio desc: category + type · Budget · Spent · Left
  (negative when <0) · Used meter + %. Owner with no budgets → **Set a budget** ghost button.
- **Without a budget** (per owner, collapsible): preview "A, B and N more", total, count; expanded
  rows = category spend + **Set budget** (opens dialog prefilled).
- **Budget dialog**: Category (datalist/combobox; hint "Rs X already spent on Y this month") ·
  For (`Segmented`) · Monthly budget (AmountInput) · Type Fixed/Flexible (**updates the
  category's `budgetType`**, affecting every owner's budget for that category; helper text says so)
  · footer adds **Remove budget** (edit mode). Uses existing `setBudgetItemAction` (+ category update).
- Removed: `BudgetHealthCard`, `AllocationSummaryCard`, `TopBudgetCategoriesCard`,
  `BudgetSummaryCards`, the edit-everything modal (`BudgetGroups` edit flow, `IncomeForm` inline).

### 3.4 Recurring (`modules/recurring`)

- `PageHeader` with **month nav (new)**; past months show what was paid that month.
  Action: secondary **Add recurring**.
- **Ledger**: Monthly commitments (lead; monthly-equivalent of active items: monthly ×1,
  quarterly ×⅓, yearly ×1/12; "N active · X% of income") · Paid this month ("N of M payments") ·
  Still due ("N payments left this month" / "All paid for {month}") · Next due (date; "name · in N days").
- **Day strip (new)**: micro-label "{Month}, day by day" + legend (Due ■, Paid □, Today red □);
  N-day grid (period length), past days tinted, today outlined in signal, due cells filled/outlined
  when paid; labels above for due days (name or "N payments", amount), flipped to the left after
  mid-month; day numbers for 1/5/10/15/25/last, today and due days. Pure builder, TDD.
- `LineTabs` All / Upcoming / Active / Paused / Completed with counts + search.
- **Rows**: CategoryIcon (item icon) · name + "vendor · frequency" · For (monograms) · schedule
  (frequency; "Due {date} · in N days" / "Overdue since {date}" negative / "Paid {date} · next
  {date}" / "Paused" / "Completed") + **Mark paid** · amount · ⋯ (Edit, Pause/Resume, Mark
  completed, Delete). Row click = Edit.
- Footer explainer + ghost Add recurring.
- **Dialog**: Name · Amount each time · Repeats (Monthly / **Quarterly** / Yearly) · For ·
  Due on day (1–31 → next occurrence in household calendar). **More details**: Category
  (default: first `fixed` category, else first category), Vendor, Icon (`IconPicker`), exact next
  due date (overrides due day), End date.
- Removed: `UpcomingThisMonthCard`, `RecurringSummaryCard`, `ByCategoryCard`, `QuickTipsCard`,
  `RecurringCalendarView`.

### 3.5 Savings goals (`modules/savings-goals`)

- `PageHeader` month nav + secondary **New goal**.
- **Ledger**: Saved toward goals (lead; muted when 0; meter vs total targets; "of Rs T across N
  goals") · Added this month ("N contributions") · Goals ("All active" / "Create your first below") ·
  Average progress ("Toward each target").
- **Empty state** (2-col): 34px "Nothing saved toward a goal yet." + copy (mentions Savings-category
  budget when present) + primary **Create a goal**; "Or start from" starters: Emergency fund
  (target = 3 × average monthly spending over the previous 3 months, rounded), New vehicle, Travel,
  Education, Something else → open dialog prefilled.
- **With goals**: `LineTabs` All/Me/Partner/Shared with counts; rows: Goal · For · Saved ("of
  target") · Progress meter + % · Target date · **Add money** · ⋯ (Edit, Delete). No-target goals
  show "Ongoing", no meter. "+ New goal" row. **Recent contributions** (latest 6: date · goal · +amount).
- **Goal dialog**: Name · Target (AmountInput) · For · Target date (`NepaliDateField`) · Already
  saved (creates an initial contribution dated today). **More details**: Description, Image,
  "No fixed target" toggle.
- **Add money dialog** (sub-line = goal name): Amount. **More details**: Date (today), Added by (you).
- Removed: `GoalCard` grid, `SavingsOverviewCard`, `GoalProgressOverviewCard`, `RecentContributionsCard` (page).

### 3.6 Dhuku (`modules/dhuku`)

- `PageHeader` (no month nav), subtitle "Rotating savings groups you're part of", secondary **Add dhuku**.
- **Ledger**: Due this month (lead; active groups whose next entry is due this period or overdue,
  amount from existing next-due logic incl. post-payout interest; sub = group names) ·
  Contributed (all-time) · Received ("Payouts taken" / "No payout taken yet") · Active groups ("N completed").
- `LineTabs` All / Active / Completed + legend (Paid ■ ink, Payout received ■ signal, To come □).
- **Rows**: name (muted when completed) + monograms + "{owner} · Rs X a month" · **month cells**
  (one per month; paid ink, payout month signal, next outlined ink, rest outlined n-400) + "Month k
  of N" / "All N months paid" · Contributed ("of pot · %") · Next payment (date; "Overdue — log it
  if already paid" negative / "Rs X due this month" / "upcoming") · secondary **Log entry** · ⋯
  (Edit, Mark completed / Reopen, Delete). Row expand = entry history (date, type, amount, delete
  via `deleteDhukuEntryAction`).
- **Log entry dialog**: Contribution / Payout received (`Segmented`; amount prefill monthly /
  pot) · AmountInput · Date. **More details**: Note.
- **Add/Edit dialog**: Group name · Monthly contribution · Months · For · pot preview. **More
  details**: Start date (default: current period start), Interest per month, Note.
- **Schema**: `dhukus.completed_at` (nullable timestamp). `status = completedAt ? "completed" :
  derived` (all months logged). "Mark completed" sets it; "Reopen" shown only when `completedAt`
  is set and clears it. Activity diff spec + revert entity registry updated.

### 3.7 Reports (`modules/reports`)

- `PageHeader` month nav, meta "Compared with {prev}", secondary **Export** (existing CSV).
- `LineTabs` Expenses / Income / Savings (existing tab state).
- **Expenses**: lead sentence (from existing insight logic, bold category) · Ledger (Spent lead
  with "% of income" + change + owner meter; Me / Partner / Shared with "% of total") ·
  **Spending pace** (`SectionHeading` + legend; SVG: cumulative actual line, dashed even-pace
  line to total budget, dashed y-gridlines with k-labels, signal today rule + ink dot + label "Rs X /
  Today · N× the even pace", annotation on the largest day; optional daily bars below (today ink,
  others n-400); day numbers row) · grid `auto-fit minmax(340px)`: **Budget vs actual** (over first,
  top 4, meter, "Over by X" negative / "X left", "spent of budget · %", note on biggest unbudgeted
  categories + link) · **Biggest changes** (vs prev; diverging bars from a centre line, ink = up,
  n-400 = down; "+X / +%") · **Where it went** (14px stacked share bar ink→n-300, top 5 + "N other
  categories", amount, %) · **Largest expenses** (01–05, name, date · category, amount).
- **Income**: Ledger (Income lead + change; Me; Partner; Spent of income %, negative when >100) +
  **Last 6 months** `GroupedRows` (month · income · spent · left) from existing trend data.
- **Savings**: empty state (design) when no contributions this month; otherwise Ledger (Saved this
  month, Saved all-time, Goals, Average progress) + goal progress rows + this month's contributions.
- Removed: card versions (`SmartInsightCard`, `ExpenseSummaryCard`, `IncomeExpenseTrendCard`,
  `IncomeBreakdownCard`, `SavingsOverviewCard`, `GoalProgressOverviewCard`, …) as replaced.

## 4. Extrapolated pages

### 4.1 Loans
Header "Loans" / "Money you've lent and borrowed" / **Add loan**. Ledger: Owed to you (lead,
repaid meter) · You owe · Lent out · Borrowed. `LineTabs` All / Lent / Borrowed / Settled.
Rows: counterparty + direction tag + monograms · principal · repaid meter "X of Y · %" · next
instalment / due date (overdue negative) · secondary **Record payment** · ⋯ Edit, Delete; expand =
payment history with delete. Loan dialog: Lent/Borrowed · Person · AmountInput · For · Date;
More details: due date, instalment plan (amount, weekly/monthly, next date), note. Payment
dialog: Amount; More details: date, note.

### 4.2 Categories
Header "Categories" / "Used across expenses and budgets" / **Add category**. `LineTabs` Active /
Archived. `GroupedRows` by `groupName` (count): CategoryIcon · name · Fixed/Flexible · ⋯ Edit,
Archive/Restore, Delete. Dialog: Name · Group (combobox) · Type · Icon (`IconPicker`).

### 4.3 Notifications
Header + ghost **Mark all read**. Ledger: Unread · Upcoming payments · Budget alerts · Resolved
this month. `LineTabs` All / Unread / Alerts. Rows by day: unread signal square · title + body ·
category tag · time · mark read. Sections: **Coming up** (upcoming bills, loan instalments, dhuku
payments) and **What to notify about** (preference checkboxes). Removed: tips card.

### 4.4 Activity
Header "Activity" / "Who added, edited or deleted what". `FilterMenu`s Person, Section, From, To +
Clear (URL params as today). Rows by day: time · monogram · summary · "mobile" tag · ghost
**Revert**; expand = field diffs (before → after). Footer pagination under 2px rule.

### 4.5 Settings
720px column; sections with `SectionHeading`, rows = label + description left, control right.
Appearance (Light/Dark/System `Segmented`; square accent swatches, red first "default") · Dates
(BS/AD) · Profile (square photo, Change/Remove) · Password · App releases (admins) · Account
(Sign out, negative).

### 4.6 Login
≥lg split: left brand (ink "P" square, 42px **Piko**, tagline, 2px rule); right "Sign in" 42px,
Email, Password, error in `negative-ink`, full-width primary **Sign in**. Mobile single column.

## 5. Data changes

All additive; generated with `npm run db:generate` (never hand-edit `drizzle/meta`), applied with
`npm run db:migrate`. **Production migration is applied only after explicit user confirmation and
before the new code is deployed.**

1. `categories.icon text` (nullable). Zod schema, category form, `/api/mobile/categories` response
   (additive field), activity diff spec. UI fallback `guessCategoryIcon(name)` (keyword map → lucide
   icon, default `tag`), TDD.
2. `recurring_frequency` + `'quarterly'`. Next-due advance (+3 months, BS/AD aware), monthly
   equivalent in stats, Zod enum, activity formatting, notifications due-soon logic.
3. `dhukus.completed_at timestamp` (nullable). Status derivation, mark-complete / reopen actions
   (household-scoped, `logActivity`), revert registry, activity sections.

Mobile app: unaffected (does not read recurring; categories change is additive).

## 6. Delivery phases

| # | Phase | Exit criteria |
| --- | --- | --- |
| 1 | Foundation & shell: tokens, accent presets (red default), primitive restyle, shared composites, sidebar, bottom nav, frame, loading/error, N shortcut, Login | User reviews shell + one page in light/dark, desktop/mobile |
| 2 | Data & logic: 3 migrations, pacing carry-over, quarterly, dhuku completion, activity/revert, icon guess | Unit tests green; no visual change |
| 3 | Home, Expenses, Budget | User reviews pages |
| 4 | Recurring, Savings, Dhuku, Reports | User reviews pages |
| 5 | Loans, Categories, Notifications, Activity, Settings | User reviews pages |
| 6 | Cleanup: delete orphaned components/tokens, update `docs/architecture.md`, `graphify update .` | Final pass |

Components replaced in a phase are deleted in that phase. Each phase is one commit; the
pre-commit hook (`tsc --noEmit`, `next build`) must pass — never `--no-verify`.

## 7. Testing

- **Vitest (TDD)**: pacing carry-over & `safeToday`; quarterly advance + monthly equivalent;
  dhuku status with `completedAt`; `guessCategoryIcon`; `splitAmount`; recurring day-strip
  builder; budget lead sentence + without-a-budget grouping; expense day grouping, filters,
  progressive reveal, repeat-today date; savings starter target; reports pace series & changes;
  activity/revert for new fields.
- **Playwright** (`npm run test:e2e`, seeded server on :3100): update changed selectors per
  phase; full suite green before each phase commit. New specs: Repeat today, Mark paid from
  Upcoming, Set income, Quarterly recurring, dhuku Mark completed/Reopen, dhuku Log entry.
- **Visual**: each page in light + dark at desktop, ~780px and phone widths, compared with the
  mockup.
- `npm run lint -- --fix` (perfectionist ordering).

## 8. Out of scope

- Flutter mobile app visuals.
- Changing how money is stored or calculated beyond the pacing carry-over.
- Formatting of already-written activity-log summaries (`formatNPR` strings stay as stored).
