import { describe, expect, it } from "vitest";

import {
  EVERY_DAY,
  HABIT_TREND_WINDOWS,
  WEEKDAY_TWO_LETTER,
  WEEKENDS,
  WEEKDAYS,
  buildHabitCompletionLog,
  describeHabitCadence,
  formatHabitDays,
  habitCompletionRate,
  habitHistory,
  habitStreak,
  habitTrend,
  habitWeekday,
  isHabitDayEditable,
  isHabitDueOn,
  isValidHabitTrendWindow,
  normaliseHabitDays,
  parseHabitDays,
  trendAverage,
  trendBest,
  trendCheckInDays,
  trendPerfectDays,
  type HabitCompletionLog,
  type HabitTrendPoint,
} from "@/lib/habits";

/** Sunday — the same anchor other view tests use. */
const TODAY = "2026-10-04";
const YESTERDAY = "2026-10-03"; // Saturday
const FRIDAY = "2026-10-02";
const THURSDAY = "2026-10-01";

const daily = { id: "h-daily", days: EVERY_DAY };
const weekdays = { id: "h-weekdays", days: WEEKDAYS };

function log(entries: Record<string, string[]>): HabitCompletionLog {
  return new Map(Object.entries(entries).map(([id, days]) => [id, new Set(days)]));
}

describe("habit days", () => {
  it("reads and writes the stored weekday list", () => {
    expect(parseHabitDays("1,3,5")).toEqual([1, 3, 5]);
    expect(parseHabitDays(" 5 , 1 ")).toEqual([1, 5]);
    expect(formatHabitDays([5, 1, 1])).toBe("1,5");
  });

  it("falls back to every day for a missing or unusable value", () => {
    expect(parseHabitDays(null)).toEqual([...EVERY_DAY]);
    expect(parseHabitDays("")).toEqual([...EVERY_DAY]);
    expect(parseHabitDays("nonsense")).toEqual([...EVERY_DAY]);
    expect(parseHabitDays("9")).toEqual([...EVERY_DAY]);
  });

  it("drops values that are not whole weekdays", () => {
    expect(normaliseHabitDays([1, 1, -1, 7, 2.5, 3])).toEqual([1, 3]);
    expect(normaliseHabitDays([])).toEqual([]);
  });

  it("knows which weekday a date-only value is", () => {
    expect(habitWeekday(TODAY)).toBe(0);
    expect(habitWeekday(YESTERDAY)).toBe(6);
    expect(habitWeekday(FRIDAY)).toBe(5);
  });

  it("is due only on the chosen days", () => {
    expect(isHabitDueOn(EVERY_DAY, TODAY)).toBe(true);
    expect(isHabitDueOn(WEEKDAYS, FRIDAY)).toBe(true);
    expect(isHabitDueOn(WEEKDAYS, YESTERDAY)).toBe(false);
    expect(isHabitDueOn(WEEKENDS, TODAY)).toBe(true);
  });

  it("describes the common selections in words", () => {
    expect(describeHabitCadence(EVERY_DAY)).toBe("Every day");
    expect(describeHabitCadence(WEEKDAYS)).toBe("Weekdays");
    expect(describeHabitCadence(WEEKENDS)).toBe("Weekends");
    expect(describeHabitCadence([1, 3, 5])).toBe("Mon, Wed, Fri");
  });
});

describe("habit history", () => {
  it("returns the window oldest first, marking due and done separately", () => {
    const history = habitHistory(
      weekdays,
      log({ "h-weekdays": [THURSDAY, FRIDAY] }),
      TODAY,
      7,
    );

    expect(history).toHaveLength(7);
    expect(history[history.length - 1].date).toBe(TODAY);
    expect(history[0].date).toBe("2026-09-28");

    const byDate = new Map(history.map((day) => [day.date, day]));
    expect(byDate.get(FRIDAY)).toEqual({ date: FRIDAY, due: true, done: true });
    // Not due: neither a hit nor a miss.
    expect(byDate.get(YESTERDAY)).toEqual({ date: YESTERDAY, due: false, done: false });
    expect(byDate.get(THURSDAY)).toEqual({ date: THURSDAY, due: true, done: true });
  });
});

describe("habit streaks", () => {
  it("counts consecutive due days completed", () => {
    expect(habitStreak(daily, log({ "h-daily": [TODAY, YESTERDAY, FRIDAY] }), TODAY)).toBe(3);
  });

  it("does not break the streak while today is still open", () => {
    expect(habitStreak(daily, log({ "h-daily": [YESTERDAY, FRIDAY] }), TODAY)).toBe(2);
  });

  it("breaks the streak at a missed day that is already over", () => {
    expect(habitStreak(daily, log({ "h-daily": [FRIDAY] }), TODAY)).toBe(0);
  });

  it("skips the days a habit is not due on", () => {
    // Thursday and Friday done; Saturday and Sunday are not due for a
    // weekday habit, so the streak survives the weekend.
    expect(habitStreak(weekdays, log({ "h-weekdays": [THURSDAY, FRIDAY] }), TODAY)).toBe(2);
  });

  it("is zero with no history at all", () => {
    expect(habitStreak(daily, log({}), TODAY)).toBe(0);
  });
});

describe("habit completion rate", () => {
  it("measures only the days the habit is due on", () => {
    // The 7-day window has five weekdays: 28–30 Sep and 1–2 Oct.
    expect(habitCompletionRate(weekdays, log({ "h-weekdays": [] }), TODAY, 7)).toBe(0);
    expect(
      habitCompletionRate(
        weekdays,
        log({ "h-weekdays": ["2026-09-28", "2026-09-29", "2026-09-30", THURSDAY] }),
        TODAY,
        7,
      ),
    ).toBe(80);
    expect(
      habitCompletionRate(
        weekdays,
        log({ "h-weekdays": [FRIDAY, THURSDAY, "2026-09-30", "2026-09-29", "2026-09-28"] }),
        TODAY,
        7,
      ),
    ).toBe(100);
  });

  it("does not count today as a miss before the day is over", () => {
    // Yesterday was missed; today is still open, so it is left out of the
    // maths entirely rather than counted as a failure.
    const finished = ["2026-09-28", "2026-09-29", "2026-09-30", THURSDAY, FRIDAY];
    expect(habitCompletionRate(daily, log({ "h-daily": finished }), TODAY, 7)).toBe(83);

    // …and once today is done it counts as a hit.
    expect(habitCompletionRate(daily, log({ "h-daily": [...finished, TODAY] }), TODAY, 7)).toBe(86);
  });
});

describe("a habit only counts from the day it started", () => {
  // Started on the Friday: everything before it is neither due nor missed.
  const young = { id: "h-young", days: EVERY_DAY, startDate: FRIDAY };
  const brandNew = { id: "h-new", days: EVERY_DAY, startDate: TODAY };

  it("leaves the days before it existed out of the history strip", () => {
    const history = habitHistory(young, log({}), TODAY, 7);

    expect(history.filter((day) => day.date < FRIDAY).every((day) => !day.due)).toBe(true);
    expect(history.filter((day) => day.due).map((day) => day.date)).toEqual([
      FRIDAY,
      YESTERDAY,
      TODAY,
    ]);
  });

  it("does not count earlier days against the rate", () => {
    // Three days exist; today is open, so the two finished days decide the rate.
    expect(habitCompletionRate(young, log({}), TODAY, 7)).toBe(0);
    expect(habitCompletionRate(young, log({ "h-young": [YESTERDAY] }), TODAY, 7)).toBe(50);
    expect(
      habitCompletionRate(young, log({ "h-young": [YESTERDAY, TODAY] }), TODAY, 7),
    ).toBe(67);
  });

  it("stops the streak at the start day instead of padding it", () => {
    expect(habitStreak(young, log({ "h-young": [YESTERDAY, TODAY] }), TODAY)).toBe(2);
  });

  it("reads as brand new, not as a week of failures, on day one", () => {
    expect(habitHistory(brandNew, log({}), TODAY, 7).filter((day) => day.due)).toHaveLength(1);
    expect(habitCompletionRate(brandNew, log({}), TODAY, 7)).toBe(0);
    expect(habitStreak(brandNew, log({}), TODAY)).toBe(0);

    // …and as a single successful day once it is ticked off.
    expect(habitCompletionRate(brandNew, log({ "h-new": [TODAY] }), TODAY, 7)).toBe(100);
    expect(habitStreak(brandNew, log({ "h-new": [TODAY] }), TODAY)).toBe(1);
  });
});

describe("which days can be corrected by hand", () => {
  it("allows a due day that has already happened, today included", () => {
    expect(isHabitDayEditable(daily, TODAY, TODAY)).toBe(true);
    expect(isHabitDayEditable(daily, FRIDAY, TODAY)).toBe(true);
  });

  it("refuses a future day", () => {
    expect(isHabitDayEditable(daily, "2026-10-05", TODAY)).toBe(false);
  });

  it("refuses a day the habit is not due on", () => {
    expect(isHabitDayEditable(weekdays, YESTERDAY, TODAY)).toBe(false);
  });

  it("refuses a day from before the habit started", () => {
    const startedYesterday = { id: "h-new", days: EVERY_DAY, startDate: YESTERDAY };
    expect(isHabitDayEditable(startedYesterday, FRIDAY, TODAY)).toBe(false);
    expect(isHabitDayEditable(startedYesterday, TODAY, TODAY)).toBe(true);
  });
});

describe("the last 30 days across every habit", () => {
  const first = { id: "h-first", title: "First", days: EVERY_DAY };
  const second = { id: "h-second", title: "Second", days: EVERY_DAY };
  const habits = [first, second];
  const completions = log({
    "h-first": [TODAY],
    "h-second": [TODAY, YESTERDAY],
  });

  /** The headline numbers of a day, without the id lists. */
  const score = (point: HabitTrendPoint) => ({
    date: point.date,
    due: point.due,
    done: point.done,
    percent: point.percent,
  });

  it("reports how much of each day was done", () => {
    const trend = habitTrend(habits, completions, TODAY, 3);

    expect(trend.map((point) => point.date)).toEqual([FRIDAY, YESTERDAY, TODAY]);
    expect(trend.map(score)).toEqual([
      { date: FRIDAY, due: 2, done: 0, percent: 0 },
      { date: YESTERDAY, due: 2, done: 1, percent: 50 },
      { date: TODAY, due: 2, done: 2, percent: 100 },
    ]);
  });

  it("names the habits behind a day, so a tooltip can list them", () => {
    const today = habitTrend(habits, completions, TODAY, 3).at(-1)!;

    expect(today.dueIds).toEqual([first.id, second.id]);
    expect(today.doneIds).toEqual([first.id, second.id]);

    const yesterday = habitTrend(habits, completions, TODAY, 3).at(-2)!;
    expect(yesterday.dueIds).toEqual([first.id, second.id]);
    expect(yesterday.doneIds).toEqual([second.id]);
  });

  it("reports a day with nothing due as a gap rather than a zero", () => {
    const trend = habitTrend([weekdays], log({}), TODAY, 7);
    const byDate = new Map(trend.map((point) => [point.date, point]));

    // Saturday and Sunday: a weekday habit is not due, so there is no dot.
    expect(score(byDate.get(YESTERDAY)!)).toEqual({
      date: YESTERDAY,
      due: 0,
      done: 0,
      percent: null,
    });
    // Friday was due and skipped.
    expect(score(byDate.get(FRIDAY)!)).toEqual({ date: FRIDAY, due: 1, done: 0, percent: 0 });
  });

  it("trails a seven-day average behind each day", () => {
    const trend = habitTrend(habits, completions, TODAY, 3);

    // The window is still filling up: mean of [0] , then [0, 50], then [0, 50, 100].
    expect(trend[0].average).toBe(0);
    expect(trend[1].average).toBe(25);
    expect(trend[2].average).toBe(50);
  });

  it("leaves paused habits out of the trend entirely", () => {
    const paused = { id: "h-paused", days: EVERY_DAY, paused: true };
    const trend = habitTrend([paused], log({ "h-paused": [TODAY] }), TODAY, 3);

    expect(trend.every((point) => point.due === 0 && point.percent === null)).toBe(true);
    expect(trendCheckInDays(trend)).toBe(0);
  });

  it("summarises the window: check-ins, perfect days, average and best day", () => {
    const trend = habitTrend(habits, completions, TODAY, 3);

    expect(trendCheckInDays(trend)).toBe(2);
    expect(trendPerfectDays(trend)).toBe(1);
    expect(trendAverage(trend)).toBe(50);
    expect(trendBest(trend)?.date).toBe(TODAY);
  });

  it("has no best day, average or perfect day when nothing was ever done", () => {
    const trend = habitTrend(habits, log({}), TODAY, 3);

    expect(trendBest(trend)).toBeNull();
    expect(trendAverage(trend)).toBe(0);
    expect(trendPerfectDays(trend)).toBe(0);
  });

  it("has no average at all when nothing was ever due", () => {
    const paused = { id: "h-paused", days: EVERY_DAY, paused: true };
    expect(trendAverage(habitTrend([paused], log({}), TODAY, 3))).toBeNull();
  });
});

describe("trend windows", () => {
  it("accepts only the windows the page offers", () => {
    expect(HABIT_TREND_WINDOWS).toEqual([7, 30, 90]);
    expect(isValidHabitTrendWindow(7)).toBe(true);
    expect(isValidHabitTrendWindow(30)).toBe(true);
    expect(isValidHabitTrendWindow(90)).toBe(true);
    expect(isValidHabitTrendWindow(14)).toBe(false);
    expect(isValidHabitTrendWindow(Number("nonsense"))).toBe(false);
  });

  it("has two-letter headings that do not repeat", () => {
    expect(WEEKDAY_TWO_LETTER).toHaveLength(7);
    expect(new Set(WEEKDAY_TWO_LETTER).size).toBe(7);
    expect(WEEKDAY_TWO_LETTER[habitWeekday(TODAY)]).toBe("Su");
  });
});

describe("habit completion log", () => {
  /** A `TaskEvent`-shaped row, as the service reads them out of the database. */
  function event(action: string, metadata: unknown) {
    return {
      action,
      metadata:
        typeof metadata === "string" || metadata === null || metadata === undefined
          ? (metadata ?? null)
          : JSON.stringify(metadata),
    };
  }

  it("reads the habit id and the day the instance belonged to", () => {
    const entries = buildHabitCompletionLog([
      event("completed", { habitId: "h1", habitDate: TODAY, taskId: "t1" }),
      event("completed", { habitId: "h1", habitDate: FRIDAY }),
      event("completed", { habitId: "h2", habitDate: TODAY }),
      // A duplicate day is stored once.
      event("completed", { habitId: "h1", habitDate: TODAY }),
    ]);

    expect(entries.get("h1")).toEqual(new Set([TODAY, FRIDAY]));
    expect(entries.get("h2")).toEqual(new Set([TODAY]));
  });

  it("takes a day back off when the same day is reopened", () => {
    const entries = buildHabitCompletionLog([
      event("completed", { habitId: "h1", habitDate: TODAY }),
      event("reopened", { habitId: "h1", habitDate: TODAY }),
    ]);

    expect(entries.get("h1")?.size ?? 0).toBe(0);
  });

  it("lets the last event for a day win", () => {
    // Tick it off, change your mind, tick it off again.
    const entries = buildHabitCompletionLog([
      event("completed", { habitId: "h1", habitDate: TODAY }),
      event("reopened", { habitId: "h1", habitDate: TODAY }),
      event("completed", { habitId: "h1", habitDate: TODAY }),
    ]);

    expect(entries.get("h1")).toEqual(new Set([TODAY]));
  });

  it("ignores events that are not about a habit day", () => {
    const entries = buildHabitCompletionLog([
      event("completed", null),
      event("completed", undefined),
      event("completed", "not json"),
      event("completed", "null"),
      event("completed", "{}"),
      event("completed", { habitId: "h1" }),
      event("completed", { habitDate: TODAY }),
      event("completed", { habitId: "", habitDate: TODAY }),
      event("completed", { habitId: "h1", habitDate: "04/10/2026" }),
      // Ordinary task history carries no habit id at all.
      event("completed", { taskId: "t1" }),
      event("reopened", { taskId: "t2" }),
    ]);

    expect(entries.size).toBe(0);
  });

  it("ignores other actions, so an edit cannot change a habit's record", () => {
    const entries = buildHabitCompletionLog([
      event("completed", { habitId: "h1", habitDate: TODAY }),
      event("updated", { habitId: "h1", habitDate: FRIDAY }),
      event("deleted", { habitId: "h1", habitDate: YESTERDAY }),
    ]);

    expect(entries.get("h1")).toEqual(new Set([TODAY]));
  });
});
