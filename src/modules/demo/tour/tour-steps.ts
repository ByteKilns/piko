// The demo's guided tours: one on Home when a visitor arrives, and a short one
// the first time they open Budget, Savings or Dhuku.

export type TourId = "budget" | "dhuku" | "home" | "savings";

// A step points at sections marked `data-tour="<target>"`. The first of its
// targets that is on screen wins (the sidebar's button on a laptop, the
// floating one on a phone). A step with no targets sits in the middle.
export type TourStep = { body: string; targets: string[]; title: string };

export const TOURS: Record<TourId, TourStep[]> = {
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
      body: "Budget, Savings and Dhuku each have a short tour the first time you open them.",
      targets: ["nav-main", "nav-bottom"],
      title: "Keep exploring",
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
};

const TOUR_PATHS: Record<string, TourId> = {
  "/budget": "budget",
  "/dashboard": "home",
  "/dhuku": "dhuku",
  "/savings": "savings",
};

export function tourForPath(pathname: string): null | TourId {
  return TOUR_PATHS[pathname] ?? null;
}
