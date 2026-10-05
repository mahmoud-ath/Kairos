import { describe, expect, it } from "vitest";

import {
  addDays,
  compareDateOnly,
  dateOnlyInTimeZone,
  dateOnlyToDate,
  dateRange,
  dateToDateOnly,
  diffInDays,
  formatRelativeDate,
  isValidDateOnly,
  lastNDays,
  startOfWeek,
  todayDateOnly,
} from "@/lib/dates";

describe("date-only values", () => {
  it("validates calendar days only", () => {
    expect(isValidDateOnly("2026-02-28")).toBe(true);
    expect(isValidDateOnly("2026-02-30")).toBe(false);
    expect(isValidDateOnly("2026-2-3")).toBe(false);
    expect(isValidDateOnly("tomorrow")).toBe(false);
    expect(isValidDateOnly(null)).toBe(false);
  });

  it("round-trips through the stored UTC-midnight Date", () => {
    const stored = dateOnlyToDate("2026-10-04");
    expect(stored.toISOString()).toBe("2026-10-04T00:00:00.000Z");
    expect(dateToDateOnly(stored)).toBe("2026-10-04");
  });

  it("never shifts a date-only value across timezones", () => {
    const stored = dateOnlyToDate("2026-01-01");
    expect(dateOnlyInTimeZone(stored, "America/Los_Angeles")).toBe("2025-12-31");
    // …which is exactly why grouping always compares date-only strings.
    expect(dateToDateOnly(stored)).toBe("2026-01-01");
  });

  it("adds days and compares chronologically", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffInDays("2026-03-05", "2026-03-01")).toBe(4);
    expect(compareDateOnly("2026-03-01", "2026-03-02")).toBe(-1);
    expect(compareDateOnly("2026-03-02", "2026-03-02")).toBe(0);
  });
});

describe("today in a timezone", () => {
  it("uses the configured timezone, not UTC", () => {
    // 2026-10-04T02:00Z is still Oct 3 in Los Angeles and already Oct 4 in Berlin.
    const instant = new Date("2026-10-04T02:00:00.000Z");
    expect(todayDateOnly("UTC", instant)).toBe("2026-10-04");
    expect(todayDateOnly("America/Los_Angeles", instant)).toBe("2026-10-03");
    expect(todayDateOnly("Europe/Berlin", instant)).toBe("2026-10-04");
    expect(todayDateOnly("Pacific/Kiritimati", instant)).toBe("2026-10-04");
  });

  it("falls back to UTC for an unknown timezone", () => {
    const instant = new Date("2026-10-04T02:00:00.000Z");
    expect(todayDateOnly("Not/AZone", instant)).toBe("2026-10-04");
  });
});

describe("ranges and labels", () => {
  it("builds inclusive ranges", () => {
    expect(dateRange("2026-10-01", "2026-10-03")).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(lastNDays("2026-10-04", 7)).toHaveLength(7);
    expect(lastNDays("2026-10-04", 7)[0]).toBe("2026-09-28");
    expect(lastNDays("2026-10-04", 7)[6]).toBe("2026-10-04");
  });

  it("honours the configured week start", () => {
    // 2026-10-04 is a Sunday.
    expect(startOfWeek("2026-10-04", 0)).toBe("2026-10-04");
    expect(startOfWeek("2026-10-04", 1)).toBe("2026-09-28");
    expect(startOfWeek("2026-10-07", 1)).toBe("2026-10-05");
  });

  it("labels relative days", () => {
    expect(formatRelativeDate("2026-10-04", "2026-10-04")).toBe("Today");
    expect(formatRelativeDate("2026-10-05", "2026-10-04")).toBe("Tomorrow");
    expect(formatRelativeDate("2026-10-03", "2026-10-04")).toBe("Yesterday");
    expect(formatRelativeDate("2026-10-10", "2026-10-04")).toContain("Oct");
  });
});
