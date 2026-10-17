// The demo's guided tours: one on Home when a visitor arrives, and a short one
// the first time they open each other page.

export type TourId =
  | "activity"
  | "budget"
  | "categories"
  | "dhuku"
  | "expenses"
  | "home"
  | "loans"
  | "notifications"
  | "recurring"
  | "reports"
  | "savings"
  | "settings";

// A step points at sections marked `data-tour="<target>"`. The first of its
// targets that is on screen wins (the sidebar's button on a laptop, the
// floating one on a phone). A step with no targets sits in the middle.
export type TourStep = { body: string; targets: string[]; title: string };

export const TOURS: Record<TourId, TourStep[]> = {
  activity: [
    {
      body: "Every change anyone made: who added, edited or deleted what, in plain words.",
      targets: ["activity-list"],
      title: "What changed",
    },
    {
      body: "Narrow it to one person, one section, a date range, or a word.",
      targets: ["activity-filters"],
      title: "Filter the trail",
    },
  ],
  budget: [
    {
      body: "Each person plans their own pay. Switch between Aarav's plan and Sita's here.",
      targets: ["budget-whose"],
      title: "Whose plan",
    },
    {
      body: "Savings, dhuku, loan installments and funds come out of pay before anything else. Piko fills these in from what it already knows.",
      targets: ["budget-set-aside"],
      title: "Set aside first",
    },
    {
      body: "Pay, minus what's set aside and what's budgeted. Below it, each line is fixed, essential or can-cut; can-cut lines decide Safe to spend on Home.",
      targets: ["budget-ledger"],
      title: "Left to plan",
    },
  ],
  categories: [
    {
      body: "Categories group expenses and budgets. Active ones show in pickers; archived ones keep their history.",
      targets: ["categories-tabs"],
      title: "Active and archived",
    },
    {
      body: "Add a category, or open one to rename it, change its group, or archive it.",
      targets: ["categories-add"],
      title: "Add or edit",
    },
  ],
  dhuku: [
    {
      body: "What's due this month, what you've put in so far, and what you've received when it was your turn.",
      targets: ["dhuku-ledger"],
      title: "Your dhukus",
    },
    {
      body: "Each group's months: dark is paid, red is the month you took the pot. Tap a group to see every month.",
      targets: ["dhuku-group"],
      title: "One group",
    },
    {
      body: "Log a month's payment, the pot when it's your turn, or a fine.",
      targets: ["dhuku-log"],
      title: "Log entry",
    },
  ],
  expenses: [
    {
      body: "This month's spending, split between the two of you and what's shared. Tap a figure to filter the list to it.",
      targets: ["expenses-ledger"],
      title: "This month",
    },
    {
      body: "Search a note, or narrow by category, who paid, or dates. Tap a row to edit it.",
      targets: ["expenses-filters"],
      title: "Find an expense",
    },
  ],
  home: [
    {
      body: "You're Aarav. Aarav and Sita keep their money separate but plan together. Nothing here is real, so add, change or delete anything.",
      targets: [],
      title: "Welcome to Piko",
    },
    {
      body: "What you can still spend today on things you can cut, and stay on plan. What you don't use carries into tomorrow.",
      targets: ["home-safe"],
      title: "Safe to spend today",
    },
    {
      body: "Where this month's pay went: spent, moved into savings, dhuku and loans, and what's still unallocated.",
      targets: ["home-ledger"],
      title: "This month",
    },
    {
      body: "The savings pot, the dhuku (plus means the group owes you), loans, and who owes whom.",
      targets: ["home-balances"],
      title: "Balances",
    },
    {
      body: "The latest from both of you, day by day.",
      targets: ["home-recent"],
      title: "Recent expenses",
    },
    {
      body: "Record what you spent: the amount, a category, and who it was for.",
      targets: ["add-expense", "add-expense-mobile"],
      title: "Add expense",
    },
    {
      body: "Piko has a phone app for adding expenses by voice. Try it here.",
      targets: ["phone-button"],
      title: "The phone app",
    },
    {
      body: "Budget, Savings, Dhuku and every other page have a short tour the first time you open them.",
      targets: ["nav-main", "nav-bottom"],
      title: "Keep exploring",
    },
  ],
  loans: [
    {
      body: "What's still to come back to you, what you still owe, and the totals you've lent and borrowed.",
      targets: ["loans-ledger"],
      title: "Owed and owing",
    },
    {
      body: "Each loan with how much is repaid. Tap one to see its payments, or add one here.",
      targets: ["loans-tabs"],
      title: "Each loan",
    },
  ],
  notifications: [
    {
      body: "What needs you: unread items, payments coming in the next week, and budget alerts.",
      targets: ["notifications-ledger"],
      title: "What needs you",
    },
    {
      body: "The list itself, and below it what Piko should tell you about.",
      targets: ["notifications-list"],
      title: "The list",
    },
  ],
  recurring: [
    {
      body: "Bills that repeat: what they cost a month, what's paid, what's still due, and the next one.",
      targets: ["recurring-ledger"],
      title: "Monthly commitments",
    },
    {
      body: "This month day by day: filled is due, outlined is paid, red is today.",
      targets: ["recurring-timeline"],
      title: "The month at a glance",
    },
    {
      body: "Every bill, grouped by whether it's active, paused or done.",
      targets: ["recurring-tabs"],
      title: "Every bill",
    },
  ],
  reports: [
    {
      body: "Switch between the Expenses, Income and Savings reports.",
      targets: ["reports-tabs"],
      title: "Pick a report",
    },
    {
      body: "The headline figures, then how they compare with last month, your budget, and what changed most.",
      targets: ["reports-ledger"],
      title: "Where it went",
    },
  ],
  savings: [
    {
      body: "What's in the pot, the emergency reserve it fills first, and what each of you puts in a month.",
      targets: ["savings-ledger"],
      title: "The pot",
    },
    {
      body: "What you're saving for, in order. Piko works out when each one becomes affordable.",
      targets: ["savings-list"],
      title: "Saving for",
    },
    {
      body: "Record money going into the pot.",
      targets: ["savings-add"],
      title: "Add money",
    },
  ],
  settings: [
    {
      body: "Change the theme and the calendar for everyone in the household.",
      targets: ["settings-appearance"],
      title: "Appearance and dates",
    },
    {
      body: "Your account, the server, and the way out of the demo.",
      targets: ["settings-account"],
      title: "Account",
    },
  ],
};

const TOUR_PATHS: Record<string, TourId> = {
  "/activity": "activity",
  "/budget": "budget",
  "/categories": "categories",
  "/dashboard": "home",
  "/dhuku": "dhuku",
  "/expenses": "expenses",
  "/loans": "loans",
  "/notifications": "notifications",
  "/recurring": "recurring",
  "/reports": "reports",
  "/savings": "savings",
  "/settings": "settings",
};

export function tourForPath(pathname: string): null | TourId {
  return TOUR_PATHS[pathname] ?? null;
}
