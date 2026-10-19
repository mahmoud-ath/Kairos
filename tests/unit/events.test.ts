import { describe, expect, it } from "vitest";

import {
  habitCompletionMetadata,
  habitDayOf,
  isHabitEventMetadata,
  metadataFromDetails,
  parseTaskEventMetadata,
} from "@/lib/events";

const DAY = "2026-10-04";

describe("parsing a stored payload", () => {
  it("reads the fields the writers record", () => {
    const metadata = parseTaskEventMetadata(
      JSON.stringify({ taskId: "t1", habitId: "h1", habitDate: DAY, count: 2, via: "parent" }),
    );
    expect(metadata).toMatchObject({
      taskId: "t1",
      habitId: "h1",
      habitDate: DAY,
      count: 2,
      via: "parent",
    });
  });

  it("accepts the older `date` field name, so history keeps counting", () => {
    // This is the regression the shared reader exists to prevent: a payload
    // written before the rename must still resolve to the same habit day.
    const legacy = parseTaskEventMetadata(JSON.stringify({ habitId: "h1", date: DAY }));
    expect(habitDayOf(legacy)).toEqual({ habitId: "h1", habitDate: DAY });
  });

  it("prefers the current name when both are present", () => {
    const both = parseTaskEventMetadata(
      JSON.stringify({ habitId: "h1", habitDate: DAY, date: "2020-01-01" }),
    );
    expect(both.habitDate).toBe(DAY);
  });

  it("keeps fields it does not know about instead of discarding them", () => {
    const metadata = parseTaskEventMetadata(
      JSON.stringify({ taskId: "t1", restored: true, titles: ["a"], index: 3 }),
    );
    expect(metadata.extra).toEqual({ restored: true, titles: ["a"], index: 3 });
  });

  it("survives anything that is not a JSON object", () => {
    const cases = [null, undefined, "", "not json", "[1,2]", '"text"', "42"];
    for (const raw of cases) {
      const metadata = parseTaskEventMetadata(raw);
      expect(metadata).toMatchObject({ taskId: null, habitId: null, habitDate: null });
      expect(metadata.extra).toEqual({});
    }
  });

  it("ignores an unusable date rather than inventing one", () => {
    expect(parseTaskEventMetadata(JSON.stringify({ habitId: "h1", habitDate: "04/10/2026" })).habitDate)
      .toBeNull();
    expect(parseTaskEventMetadata(JSON.stringify({ habitId: "h1", habitDate: 20261004 })).habitDate)
      .toBeNull();
  });

  it("requires both halves of a habit day", () => {
    expect(habitDayOf(parseTaskEventMetadata(JSON.stringify({ habitId: "h1" })))).toBeNull();
    expect(habitDayOf(parseTaskEventMetadata(JSON.stringify({ habitDate: DAY })))).toBeNull();
  });

  it("recognises a habit event by its id alone", () => {
    expect(isHabitEventMetadata(parseTaskEventMetadata(JSON.stringify({ habitId: "h1" })))).toBe(
      true,
    );
    expect(isHabitEventMetadata(parseTaskEventMetadata(JSON.stringify({ taskId: "t1" })))).toBe(
      false,
    );
  });
});

describe("building a habit payload", () => {
  it("names the habit and the day", () => {
    expect(habitCompletionMetadata({ habitId: "h1", habitDate: DAY })).toEqual({
      habitId: "h1",
      habitDate: DAY,
    });
  });

  it("writes nothing for an ordinary task", () => {
    expect(habitCompletionMetadata({ habitId: null, habitDate: DAY })).toBeUndefined();
    expect(habitCompletionMetadata({ habitId: "h1", habitDate: null })).toBeUndefined();
  });

  it("writes nothing rather than an invalid date", () => {
    expect(habitCompletionMetadata({ habitId: "h1", habitDate: "tomorrow" })).toBeUndefined();
  });

  it("round-trips through the reader", () => {
    const payload = habitCompletionMetadata({ habitId: "h1", habitDate: DAY });
    expect(habitDayOf(parseTaskEventMetadata(JSON.stringify(payload)))).toEqual({
      habitId: "h1",
      habitDate: DAY,
    });
  });
});

describe("what a writer records", () => {
  it("always stamps the task id that the column may later lose", () => {
    expect(metadataFromDetails({ action: "created", taskId: "t1" })).toMatchObject({
      taskId: "t1",
    });
    expect(metadataFromDetails({ action: "deleted", taskId: null })).toMatchObject({
      taskId: null,
    });
  });

  it("expands a habit day into the field names readers use", () => {
    const metadata = metadataFromDetails({
      action: "completed",
      taskId: "t1",
      habitDay: { habitId: "h1", habitDate: DAY },
    });
    expect(metadata).toMatchObject({ habitId: "h1", habitDate: DAY });
    expect(metadata).not.toHaveProperty("habitDay");
    // And the reader agrees with what was written.
    expect(habitDayOf(parseTaskEventMetadata(JSON.stringify(metadata)))).toEqual({
      habitId: "h1",
      habitDate: DAY,
    });
  });

  it("keeps the action out of the payload but the details in it", () => {
    const metadata = metadataFromDetails({
      action: "updated",
      taskId: "t1",
      fields: ["title", "status"],
    });
    expect(metadata).not.toHaveProperty("action");
    expect(metadata.fields).toEqual(["title", "status"]);
  });

  it("drops optional fields that were not supplied", () => {
    const metadata = metadataFromDetails({ action: "created", taskId: "t1", parentId: null });
    expect(metadata).toEqual({ parentId: null, taskId: "t1" });
  });

  it("survives a round trip through JSON unchanged", () => {
    const metadata = metadataFromDetails({
      action: "subtask_completed",
      taskId: "p1",
      count: 3,
      via: "parent",
    });
    expect(JSON.parse(JSON.stringify(metadata))).toEqual(metadata);
  });
});
