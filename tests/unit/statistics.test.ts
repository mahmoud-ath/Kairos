import { describe, expect, it } from "vitest";

import {
  ACTIVITY_RANGE_MAX_DAYS,
  buildActivitySeries,
  buildScopeCounts,
  bucketActivityByWeek,
  completionPercentage,
  isHabitEvent,
  resolveActivityRange,
} from "@/lib/stats";

const DAYS = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];

describe("scope counts", () => {
  const tasks = [
    { status: "DONE" },
    { status: "DONE" },
    { status: "TODO" },
    { status: "TODO" },
  ];

  it("separates completed from remaining", () => {
    expect(buildScopeCounts(tasks)).toEqual({
      total: 4,
      completed: 2,
      remaining: 2,
      percentage: 50,
    });
  });

  it("reports 0% for an empty scope", () => {
    expect(buildScopeCounts([])).toEqual({
      total: 0,
      completed: 0,
      remaining: 0,
      percentage: 0,
    });
    expect(completionPercentage(3, 0)).toBe(0);
  });

  it("rounds to whole percentages", () => {
    expect(completionPercentage(1, 3)).toBe(33);
    expect(completionPercentage(2, 3)).toBe(67);
  });
});

describe("completion activity history", () => {
  it("counts a task at most once per day", () => {
    const series = buildActivitySeries(
      [
        // Toggled three times on the same day: still a single completion.
        { taskId: "t1", action: "completed", timestamp: "2026-10-02T09:00:00.000Z" },
        { taskId: "t1", action: "completed", timestamp: "2026-10-02T10:00:00.000Z" },
        { taskId: "t1", action: "completed", timestamp: "2026-10-02T11:00:00.000Z" },
        { taskId: "t2", action: "completed", timestamp: "2026-10-02T12:00:00.000Z" },
      ],
      DAYS,
      "UTC",
    );

    expect(series.map((point) => point.completed)).toEqual([0, 2, 0, 0]);
  });

  it("tracks reopens separately from completions", () => {
    const series = buildActivitySeries(
      [
        { taskId: "t1", action: "completed", timestamp: "2026-10-03T08:00:00.000Z" },
        { taskId: "t1", action: "reopened", timestamp: "2026-10-04T08:00:00.000Z" },
      ],
      DAYS,
      "UTC",
    );
    expect(series.at(-2)?.completed).toBe(1);
    expect(series.at(-1)?.reopened).toBe(1);
  });

  it("buckets events by the calendar day in the user's timezone", () => {
    // 2026-10-02T02:00Z is still Oct 1 in Los Angeles.
    const series = buildActivitySeries(
      [{ taskId: "t1", action: "completed", timestamp: "2026-10-02T02:00:00.000Z" }],
      DAYS,
      "America/Los_Angeles",
    );
    expect(series[0].completed).toBe(1);
    expect(series[1].completed).toBe(0);
  });

  it("keeps counting a task that was later deleted, using the id in metadata", () => {
    const series = buildActivitySeries(
      [
        {
          taskId: null,
          action: "completed",
          timestamp: "2026-10-02T09:00:00.000Z",
          metadata: JSON.stringify({ taskId: "deleted-1" }),
        },
      ],
      DAYS,
      "UTC",
    );
    expect(series[1].completed).toBe(1);
  });

  it("ignores events outside the window and unrelated actions", () => {
    const series = buildActivitySeries(
      [
        { taskId: "t1", action: "completed", timestamp: "2026-09-01T09:00:00.000Z" },
        { taskId: "t1", action: "created", timestamp: "2026-10-02T09:00:00.000Z" },
        { taskId: "t1", action: "moved", timestamp: "2026-10-02T09:00:00.000Z" },
      ],
      DAYS,
      "UTC",
    );
    expect(series.every((point) => point.completed === 0)).toBe(true);
  });

  it("leaves habit completions out of the task statistics", () => {
    const series = buildActivitySeries(
      [
        { taskId: "t1", action: "completed", timestamp: "2026-10-02T09:00:00.000Z" },
        // A habit instance writes the same action, but its work is reported on
        // the habits page, not here.
        {
          taskId: "h1",
          action: "completed",
          timestamp: "2026-10-02T09:00:00.000Z",
          metadata: JSON.stringify({ habitId: "habit-1", habitDate: "2026-10-02" }),
        },
      ],
      DAYS,
      "UTC",
    );

    expect(series[1].completed).toBe(1);
  });

  it("recognises a habit event however the metadata is shaped", () => {
    const withMetadata = (metadata: string | null) => ({
      taskId: null,
      action: "completed",
      timestamp: "2026-10-02T09:00:00.000Z",
      metadata,
    });

    expect(isHabitEvent(withMetadata(JSON.stringify({ habitId: "h1" })))).toBe(true);
    expect(isHabitEvent(withMetadata(JSON.stringify({ habitId: "" })))).toBe(false);
    expect(isHabitEvent(withMetadata(JSON.stringify({ taskId: "t1" })))).toBe(false);
    expect(isHabitEvent(withMetadata(null))).toBe(false);
    expect(isHabitEvent(withMetadata("not json"))).toBe(false);
  });
});

describe("activity range", () => {
  const TODAY = "2026-11-22";

  it("defaults to the last 7 days", () => {
    const range = resolveActivityRange({}, TODAY);
    expect(range.from).toBe("2026-11-16");
    expect(range.to).toBe(TODAY);
    expect(range.windowDays).toBe(7);
    expect(range.preset).toBe(7);
    expect(range.weekly).toBe(false);
  });

  it("honours the 7/30/90 presets and ignores anything else", () => {
    expect(resolveActivityRange({ range: "30" }, TODAY).windowDays).toBe(30);
    expect(resolveActivityRange({ range: "90" }, TODAY).preset).toBe(90);
    expect(resolveActivityRange({ range: "45" }, TODAY).preset).toBe(7);
    expect(resolveActivityRange({ range: "junk" }, TODAY).preset).toBe(7);
  });

  it("accepts a custom range and labels it", () => {
    const range = resolveActivityRange({ from: "2026-10-01", to: "2026-10-31" }, TODAY);
    expect(range.from).toBe("2026-10-01");
    expect(range.to).toBe("2026-10-31");
    expect(range.windowDays).toBe(31);
    expect(range.preset).toBeNull();
    expect(range.label).toBe("Oct 1 – Oct 31");
  });

  it("swaps a reversed range and never reaches into the future", () => {
    const swapped = resolveActivityRange({ from: "2026-10-31", to: "2026-10-01" }, TODAY);
    expect([swapped.from, swapped.to]).toEqual(["2026-10-01", "2026-10-31"]);

    const future = resolveActivityRange({ from: "2026-11-01", to: "2026-12-31" }, TODAY);
    expect(future.to).toBe(TODAY);
  });

  it("caps a very long range instead of rejecting it", () => {
    const range = resolveActivityRange({ from: "2020-01-01", to: TODAY }, TODAY);
    expect(range.windowDays).toBe(ACTIVITY_RANGE_MAX_DAYS);
    expect(range.to).toBe(TODAY);
    // A year is charted per week, so the bars stay readable.
    expect(range.weekly).toBe(true);
  });

  it("falls back to the preset when a date is not a real day", () => {
    const range = resolveActivityRange({ from: "2026-02-30", to: TODAY, range: "30" }, TODAY);
    expect(range.preset).toBe(30);
  });
});

describe("weekly activity buckets", () => {
  const series = Array.from({ length: 14 }, (_, index) => ({
    date: `2026-10-${String(index + 1).padStart(2, "0")}`,
    completed: index + 1,
    reopened: 0,
  }));

  it("sums consecutive weeks, aligned to the most recent day", () => {
    const buckets = bucketActivityByWeek(series);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].date).toBe("2026-10-01");
    expect(buckets[0].completed).toBe(1 + 2 + 3 + 4 + 5 + 6 + 7);
    expect(buckets[1].date).toBe("2026-10-08");
    expect(buckets[1].completed).toBe(8 + 9 + 10 + 11 + 12 + 13 + 14);
  });

  it("keeps a short tail as its own bucket", () => {
    const buckets = bucketActivityByWeek(series.slice(0, 9));
    // Aligned from the end: the newest bucket is a full week, the remainder
    // becomes the oldest bucket.
    expect(buckets.map((bucket) => bucket.date)).toEqual(["2026-10-01", "2026-10-03"]);
    expect(buckets.map((bucket) => bucket.completed)).toEqual([1 + 2, 3 + 4 + 5 + 6 + 7 + 8 + 9]);
  });
});
