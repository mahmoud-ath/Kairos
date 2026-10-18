import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  compareDateOnly,
  dateOnlyInTimeZone,
  dateOnlyToDate,
  dateRange,
  dateToDateOnly,
  diffInDays,
  endOfMonth,
  formatFullMonthDay,
  formatMonthLabel,
  formatRelativeDate,
  hourInTimeZone,
  isValidDateOnly,
  lastNDays,
  monthParamValue,
  parseMonthParam,
  startOfMonth,
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

describe("months", () => {
  it("finds the first and last day of the month", () => {
    expect(startOfMonth("2026-10-13")).toBe("2026-10-01");
    expect(endOfMonth("2026-10-13")).toBe("2026-10-31");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    // …and knows about a leap year.
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
  });

  it("shifts whole months without spilling into the next one", () => {
    expect(addMonths("2026-10-13", 1)).toBe("2026-11-13");
    expect(addMonths("2026-10-13", -1)).toBe("2026-09-13");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    // 31 January + 1 month is the end of February, never 2 or 3 March.
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("labels a month in words", () => {
    expect(formatMonthLabel("2026-10-01")).toBe("October 2026");
  });

  it("spells out a day without its year, for a tooltip", () => {
    expect(formatFullMonthDay("2026-10-12")).toBe("October 12");
    expect(formatFullMonthDay("2026-10-01")).toBe("October 1");
    // Read as UTC, so a date-only value never slips a day west of Greenwich.
    expect(formatFullMonthDay("2026-01-01")).toBe("January 1");
  });
});

describe("the ?month= query value", () => {
  it("reads both the short and the full form", () => {
    expect(parseMonthParam("2026-08")).toBe("2026-08-01");
    expect(parseMonthParam("2026-08-17")).toBe("2026-08-01");
    expect(parseMonthParam(" 2026-08 ")).toBe("2026-08-01");
  });

  it("refuses anything that is not a real month", () => {
    expect(parseMonthParam(null)).toBeNull();
    expect(parseMonthParam(undefined)).toBeNull();
    expect(parseMonthParam("")).toBeNull();
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("2026-00")).toBeNull();
    expect(parseMonthParam("2026-8")).toBeNull();
    expect(parseMonthParam("2026-02-30")).toBeNull();
    expect(parseMonthParam("August 2026")).toBeNull();
    expect(parseMonthParam("2026")).toBeNull();
  });

  it("writes the short form the links use", () => {
    expect(monthParamValue("2026-08-01")).toBe("2026-08");
    expect(monthParamValue("2026-08-31")).toBe("2026-08");
  });
});

describe("the hour in a timezone", () => {
  const lateEvening = new Date("2026-10-14T23:30:00.000Z");

  it("follows the offset each zone actually has", () => {
    expect(hourInTimeZone(lateEvening, "UTC")).toBe(23);
    // UTC+1, so it is already the next day there — and 00:30, not 24:30.
    expect(hourInTimeZone(lateEvening, "Africa/Casablanca")).toBe(0);
    expect(hourInTimeZone(lateEvening, "America/Los_Angeles")).toBe(16);
  });

  it("reads midnight as 0, whatever the zone", () => {
    expect(hourInTimeZone(new Date("2026-10-14T00:10:00.000Z"), "UTC")).toBe(0);
    expect(hourInTimeZone(new Date("2026-10-14T23:10:00.000Z"), "Africa/Casablanca")).toBe(0);
  });

  it("falls back to UTC rather than throwing on a nonsense zone", () => {
    expect(hourInTimeZone(new Date("2026-10-14T05:30:00.000Z"), "Not/AZone")).toBe(5);
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
