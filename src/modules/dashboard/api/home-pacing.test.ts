import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDateFormatPref } from "@/lib/date-format-cookie";
import { getHouseholdMembers } from "@/lib/session";
import { listPlanLines } from "@/modules/budget/api/budget";
import { listCategories } from "@/modules/categories/api/categories";
import { listHouseholdExpensesForMonth } from "@/modules/expenses/api/expenses-by-month";

import { loadViewerPacing } from "./home-pacing";

vi.mock("@/lib/date-format-cookie", () => ({ getDateFormatPref: vi.fn() }));
vi.mock("@/lib/session", () => ({ getHouseholdMembers: vi.fn() }));
vi.mock("@/modules/budget/api/budget", () => ({ listPlanLines: vi.fn() }));
vi.mock("@/modules/categories/api/categories", () => ({ listCategories: vi.fn() }));
vi.mock("@/modules/expenses/api/expenses-by-month", () => ({ listHouseholdExpensesForMonth: vi.fn() }));

const line = (ownerMemberId: string, categoryId: string, kind: "can_cut" | "fixed", plannedAmount: number) =>
  ({ categoryId, inherited: false, kind, ownerMemberId, plannedAmount }) as never;
const expense = (paidByMemberId: string, categoryId: string, amount: string, date: string) =>
  ({ amount, categoryId, date, fundAmount: null, paidByMemberId, payBackAmount: null, savingsPotId: null }) as never;

describe("loadViewerPacing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Friday 3 April 2026, Nepal time: day 3 of April in AD.
    vi.useFakeTimers({ now: new Date("2026-04-03T06:00:00Z"), toFake: ["Date"] });
    vi.mocked(getDateFormatPref).mockResolvedValue("english");
    vi.mocked(getHouseholdMembers).mockResolvedValue([{ id: "me" }, { id: "her" }] as never);
    vi.mocked(listCategories).mockResolvedValue([
      { budgetType: "flexible", id: "lunch", name: "Lunch" },
      { budgetType: "fixed", id: "rent", name: "Rent" },
    ] as never);
    vi.mocked(listPlanLines).mockResolvedValue([
      line("me", "lunch", "can_cut", 3000),
      line("me", "rent", "fixed", 10000),
      // Her lines and spending are hers: they don't change my figure.
      line("her", "lunch", "can_cut", 9000),
    ]);
    vi.mocked(listHouseholdExpensesForMonth).mockResolvedValue([
      expense("me", "lunch", "100.00", "2026-04-02"),
      expense("her", "lunch", "5000.00", "2026-04-02"),
    ]);
  });
  afterEach(() => vi.useRealTimers());

  it("works out the signed-in person's Safe to spend for this month, from their household only", async () => {
    await expect(loadViewerPacing("h1", "me")).resolves.toMatchObject({ over: false, safeToday: 78, weeklyAllowance: 490 });

    expect(getDateFormatPref).toHaveBeenCalledWith("h1");
    expect(getHouseholdMembers).toHaveBeenCalledWith("h1");
    expect(listCategories).toHaveBeenCalledWith("h1");
    expect(listPlanLines).toHaveBeenCalledWith("h1", 2026, 4);
    expect(listHouseholdExpensesForMonth).toHaveBeenCalledWith("h1", 2026, 4, "english");
  });

  it("is null for someone without can-cut lines", async () => {
    await expect(loadViewerPacing("h1", "nobody")).resolves.toBeNull();
  });
});
