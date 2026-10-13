import { describe, expect, it } from "vitest";

import { buildActivitySeries, buildScopeCounts, completionPercentage, isHabitEvent } from "@/lib/stats";

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
