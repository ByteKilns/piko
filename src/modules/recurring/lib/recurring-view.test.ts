import { describe, expect, it } from "vitest";

import { buildRecurringTimeline, dayOfHouseholdCalendar, nextDueDateForDay } from "./recurring-view";

describe("buildRecurringTimeline", () => {
  it("marks due, paid, today and past days across the period", () => {
    const { days } = buildRecurringTimeline({
      daysInPeriod: 31,
      entries: [
        { amount: 3000, day: 10, name: "Internet", paid: false },
        { amount: 2000, day: 20, name: "Dhuku", paid: true },
      ],
      todayDay: 20,
    });

    expect(days).toHaveLength(31);
    expect(days[9]).toMatchObject({ allPaid: false, day: 10, hasDue: true, isPast: true, isToday: false, showNumber: true });
    expect(days[19]).toMatchObject({ allPaid: true, day: 20, hasDue: true, isPast: false, isToday: true, showNumber: true });
    expect(days[0].showNumber).toBe(true); // day 1
    expect(days[2].showNumber).toBe(false); // day 3
  });

  it("labels a day with its single item or a payment count", () => {
    const { marks } = buildRecurringTimeline({
      daysInPeriod: 30,
      entries: [
        { amount: 3000, day: 4, name: "Internet", paid: false },
        { amount: 2000, day: 20, name: "Dhuku", paid: false },
        { amount: 1000, day: 20, name: "Gym", paid: false },
      ],
      todayDay: 10,
    });

    expect(marks[0]).toMatchObject({ align: "right", amount: 3000, label: "Internet" });
    expect(marks[1]).toMatchObject({ align: "left", amount: 3000, label: "2 payments" });
  });

  it("does not mark a day without entries", () => {
    const { marks } = buildRecurringTimeline({ daysInPeriod: 28, entries: [], todayDay: 5 });
    expect(marks).toEqual([]);
  });
});

describe("nextDueDateForDay", () => {
  it("uses this month when the day is still ahead (AD)", () => {
    expect(nextDueDateForDay(15, "english", "2026-10-09")).toBe("2026-10-15");
    expect(nextDueDateForDay(9, "english", "2026-10-09")).toBe("2026-10-09");
  });

  it("rolls to next month once the day has passed (AD)", () => {
    expect(nextDueDateForDay(5, "english", "2026-10-09")).toBe("2026-11-05");
    expect(nextDueDateForDay(5, "english", "2026-12-20")).toBe("2027-01-05");
  });

  it("clamps to the month length (AD)", () => {
    expect(nextDueDateForDay(31, "english", "2026-02-01")).toBe("2026-02-28");
  });

  it("returns a date whose BS day matches the requested day (BS)", () => {
    const result = nextDueDateForDay(10, "nepali", "2026-10-09");
    expect(result >= "2026-10-09").toBe(true);
    expect(dayOfHouseholdCalendar(result, "nepali")).toBe(10);
  });
});

describe("dayOfHouseholdCalendar", () => {
  it("reads the day straight off an AD date in english mode", () => {
    expect(dayOfHouseholdCalendar("2026-10-09", "english")).toBe(9);
  });
});
