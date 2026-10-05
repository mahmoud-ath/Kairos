import { describe, expect, it } from "vitest";

import {
  arrayMove,
  computeReorderedIds,
  nextPosition,
  positionsFromOrder,
  sortSiblings,
} from "@/lib/ordering";

type Item = { id: string; position: number; groupKey: string };

const items: Item[] = [
  { id: "a", position: 0, groupKey: "2026-10-04" },
  { id: "b", position: 1, groupKey: "2026-10-04" },
  { id: "c", position: 2, groupKey: "2026-10-04" },
  { id: "d", position: 3, groupKey: "2026-10-05" },
  { id: "e", position: 4, groupKey: "" },
];

/** Ids of one group, in the order they were returned. */
function groupOrder(ids: readonly string[], group: string): string[] {
  const members = items
    .filter((item) => item.groupKey === group)
    .map((item) => item.id);
  return ids.filter((id) => members.includes(id));
}

/** Ids restricted to an explicit set of tasks that share a group. */
function idsWithin(ids: readonly string[], members: readonly string[]): string[] {
  return ids.filter((id) => members.includes(id));
}

describe("sibling ordering", () => {
  it("sorts by group, then position", () => {
    const shuffled: Item[] = [
      { id: "e", position: 4, groupKey: "" },
      { id: "b", position: 1, groupKey: "2026-10-04" },
      { id: "d", position: 3, groupKey: "2026-10-05" },
      { id: "a", position: 0, groupKey: "2026-10-04" },
      { id: "c", position: 2, groupKey: "2026-10-04" },
    ];
    expect(sortSiblings(shuffled).map((item) => item.id)).toEqual([
      "e",
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("reorders inside a group", () => {
    // Drag "a" down onto "c" (sortable semantics: insert at c's index).
    const downAgain = computeReorderedIds(items, "a", "2026-10-04", 2);
    expect(groupOrder(downAgain, "2026-10-04")).toEqual(["b", "c", "a"]);

    // Drag "c" up onto "a".
    const up = computeReorderedIds(items, "c", "2026-10-04", 0);
    expect(groupOrder(up, "2026-10-04")).toEqual(["c", "a", "b"]);
  });

  it("moves a task into another date group at the requested index", () => {
    // Move "a" into the Oct 5 group, first position.
    const first = computeReorderedIds(items, "a", "2026-10-05", 0);
    expect(idsWithin(first, ["a", "d"])).toEqual(["a", "d"]);
    expect(idsWithin(first, ["b", "c"])).toEqual(["b", "c"]);

    // Move "a" into the (currently empty) unscheduled group.
    const unscheduled = computeReorderedIds(items, "a", "", 0);
    expect(idsWithin(unscheduled, ["a", "e"])).toEqual(["a", "e"]);
  });

  it("appends when the target index is past the end of the group", () => {
    const appended = computeReorderedIds(items, "a", "2026-10-05", 99);
    expect(idsWithin(appended, ["a", "d"])).toEqual(["d", "a"]);
  });

  it("keeps every task exactly once", () => {
    const reordered = computeReorderedIds(items, "e", "2026-10-05", 1);
    expect([...reordered].sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(new Set(reordered).size).toBe(reordered.length);
  });

  it("keeps the order unchanged for an unknown id", () => {
    expect(computeReorderedIds(items, "zzz", "2026-10-04", 1)).toEqual([
      "e",
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("turns an order into positions", () => {
    const positions = positionsFromOrder(["c", "a", "b"]);
    expect(positions.get("c")).toBe(0);
    expect(positions.get("a")).toBe(1);
    expect(positions.get("b")).toBe(2);
  });

  it("computes the next append position", () => {
    expect(nextPosition([])).toBe(0);
    expect(nextPosition([0, 4, 2])).toBe(5);
  });

  it("moves items in an array the way the UI expects", () => {
    expect(arrayMove(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(arrayMove(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(arrayMove(["a", "b", "c"], 5, 0)).toEqual(["a", "b", "c"]);
  });
});
