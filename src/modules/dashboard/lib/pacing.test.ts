import { describe, expect, it } from "vitest";

import { buildPacingSchedule, currentWeekPacing, weekIndexOf, withOverrun } from "./pacing";

describe("buildPacingSchedule", () => {
  it("creates one week per 7 days", () => {
    expect(buildPacingSchedule({ daysInPeriod: 30, flexibleTotal: 4000 }).weeks).toHaveLength(5);
    expect(buildPacingSchedule({ daysInPeriod: 28, flexibleTotal: 4000 }).weeks).toHaveLength(4);
  });

  it("always sums the weeks back to the flexible total", () => {
    for (const total of [0, 100, 3999, 4000, 12345]) {
      const schedule = buildPacingSchedule({ daysInPeriod: 30, flexibleTotal: total });
      expect(schedule.weeks.reduce((s, w) => s + w.allowance, 0)).toBe(total);
    }
  });

  it("holds the buffer back and releases it in the final week", () => {
    const schedule = buildPacingSchedule({ daysInPeriod: 30, flexibleTotal: 4000, bufferShare: 0.15 });
    expect(schedule.bufferAmount).toBe(600);
    const last = schedule.weeks[schedule.weeks.length - 1];
    const first = schedule.weeks[0];
    expect(last.allowance).toBeGreaterThan(first.allowance);
  });

  it("gives a single short period the whole total with no buffer", () => {
    const schedule = buildPacingSchedule({ daysInPeriod: 5, flexibleTotal: 1000 });
    expect(schedule.weeks).toEqual([{ allowance: 1000, endDay: 5, index: 0, startDay: 1 }]);
    expect(schedule.bufferAmount).toBe(0);
  });

  it("lays weeks out consecutively and covers the whole period", () => {
    const schedule = buildPacingSchedule({ daysInPeriod: 30, flexibleTotal: 4000 });
    expect(schedule.weeks[0].startDay).toBe(1);
    expect(schedule.weeks[schedule.weeks.length - 1].endDay).toBe(30);
    for (let i = 1; i < schedule.weeks.length; i++) {
      expect(schedule.weeks[i].startDay).toBe(schedule.weeks[i - 1].endDay + 1);
    }
  });
});

describe("currentWeekPacing", () => {
  const schedule = buildPacingSchedule({ daysInPeriod: 30, flexibleTotal: 4000, bufferShare: 0.15 });

  it("finds the week containing the day", () => {
    expect(currentWeekPacing(schedule, 1, []).index).toBe(0);
    expect(currentWeekPacing(schedule, 8, []).index).toBe(1);
  });

  it("subtracts spend within the current week only", () => {
    const spentByDay = new Array(30).fill(0);
    spentByDay[0] = 100; // day 1
    spentByDay[7] = 500; // day 8 (next week)
    const week = currentWeekPacing(schedule, 10, spentByDay);
    expect(week.index).toBe(1);
    expect(week.spent).toBe(500);
    expect(week.remaining).toBe(week.allowance + week.carryIn - 500);
  });

  it("carries unspent allowance from earlier weeks forward", () => {
    const spentByDay = new Array(30).fill(0);
    spentByDay[0] = 100; // week 0 allowance is 650, so 550 carries into week 1
    const week = currentWeekPacing(schedule, 8, spentByDay);
    expect(week.index).toBe(1);
    expect(week.carryIn).toBe(550);
    expect(week.remaining).toBe(650 + 550);
  });

  it("reports the days left in the week and the next week's start", () => {
    const week = currentWeekPacing(schedule, 10, []);
    expect(week.daysLeftInWeek).toBe(5); // days 10..14
    expect(week.nextWeekStartDay).toBe(15);
  });

  it("spreads the remaining allowance over the days left in the week", () => {
    const week = currentWeekPacing(schedule, 10, []);
    expect(week.safeToday).toBe(Math.round(week.remaining / week.daysLeftInWeek));
  });

  it("never reports negative remaining", () => {
    const spentByDay = new Array(30).fill(0);
    spentByDay[0] = 999999;
    expect(currentWeekPacing(schedule, 3, spentByDay).remaining).toBe(0);
  });
});

describe("weekIndexOf", () => {
  const schedule = buildPacingSchedule({ daysInPeriod: 30, flexibleTotal: 4000 });

  it("finds the week a day falls in", () => {
    expect(weekIndexOf(schedule, 1)).toBe(0);
    expect(weekIndexOf(schedule, 15)).toBe(2);
    expect(weekIndexOf(schedule, 30)).toBe(4);
  });

  it("uses the last week for a day past the end", () => {
    expect(weekIndexOf(schedule, 31)).toBe(4);
  });
});

describe("withOverrun", () => {
  const schedule = buildPacingSchedule({ daysInPeriod: 30, flexibleTotal: 7500 });
  const sum = (from: number, s = schedule) => s.weeks.filter((w) => w.index >= from).reduce((t, w) => t + w.allowance, 0);

  it("takes the overrun out of this week and the weeks after it", () => {
    const cut = withOverrun(schedule, 2, 1000);

    expect(Math.abs(sum(2, cut) - (sum(2) - 1000))).toBeLessThanOrEqual(2);
  });

  it("leaves earlier weeks as they were", () => {
    const cut = withOverrun(schedule, 2, 1000);

    expect(cut.weeks.slice(0, 2)).toEqual(schedule.weeks.slice(0, 2));
  });

  it("spreads the cut so no single week is wiped out", () => {
    const cut = withOverrun(schedule, 2, 1000);

    for (const week of cut.weeks.slice(2)) expect(week.allowance).toBeGreaterThan(0);
  });

  it("never goes below zero", () => {
    const cut = withOverrun(schedule, 3, 99999);

    expect(cut.weeks.slice(3).every((w) => w.allowance === 0)).toBe(true);
  });

  it("changes nothing without an overrun", () => {
    expect(withOverrun(schedule, 1, 0)).toBe(schedule);
  });
});
