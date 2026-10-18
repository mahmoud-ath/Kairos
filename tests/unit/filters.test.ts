import { describe, expect, it } from "vitest";

import { UNCATEGORIZED_ID } from "@/lib/categories";
import {
  applyFilters,
  countActiveFilters,
  DEFAULT_FILTERS,
  hasActiveFilters,
  matchesCategory,
  matchesQuery,
} from "@/lib/filters";
import type { TaskDTO } from "@/types/kairos";

function task(overrides: Partial<TaskDTO> & { id: string }): TaskDTO {
  return {
    title: "Task",
    notes: null,
    status: "TODO",
    categoryId: null,
    parentId: null,
    scheduledDate: null,
    dueDate: null,
    position: 0,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
    completedAt: null,
    habitId: null,
    subtasks: [],
    ...overrides,
  };
}

const report = task({
  id: "report",
  title: "Write the Q3 report",
  notes: "Include retention numbers",
});
const invoice = task({ id: "invoice", title: "Send the invoice" });
const notesOnly = task({
  id: "notes-only",
  title: "Groceries",
  notes: "Milk, bread and the Q3 report",
});

const tasks = [report, invoice, notesOnly];

describe("search", () => {
  it("matches titles case-insensitively", () => {
    expect(matchesQuery(report, "q3 report")).toBe(true);
    expect(matchesQuery(report, "Q3 REPORT")).toBe(true);
    expect(matchesQuery(invoice, "report")).toBe(false);
  });

  it("matches notes as well as titles", () => {
    expect(matchesQuery(notesOnly, "milk")).toBe(true);
    expect(matchesQuery(notesOnly, "retention")).toBe(false);
  });

  it("requires every term to match somewhere", () => {
    expect(matchesQuery(report, "write retention")).toBe(true);
    expect(matchesQuery(report, "write missing")).toBe(false);
  });

  it("treats an empty query as everything", () => {
    expect(matchesQuery(invoice, "   ")).toBe(true);
    expect(applyFilters(tasks, DEFAULT_FILTERS)).toHaveLength(3);
  });

  it("narrows the list and leaves the input untouched", () => {
    const result = applyFilters(tasks, { query: "report", categoryId: null });
    expect(result.map((t) => t.id)).toEqual(["report", "notes-only"]);
    expect(tasks).toHaveLength(3);
  });

  it("reports whether a search is active", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ query: "  ", categoryId: null })).toBe(0);
    expect(countActiveFilters({ query: "report", categoryId: null })).toBe(1);
  });
});

describe("category filter", () => {
  const work = task({ id: "work-task", title: "Invoice", categoryId: "work" });
  const home = task({ id: "home-task", title: "Invoice", categoryId: "home" });
  const loose = task({ id: "loose-task", title: "Invoice" });
  const list = [work, home, loose];

  it("keeps one category only", () => {
    expect(applyFilters(list, { query: "", categoryId: "work" }).map((t) => t.id)).toEqual([
      "work-task",
    ]);
  });

  it("treats \u201cno category\u201d as a category of its own", () => {
    expect(
      applyFilters(list, { query: "", categoryId: UNCATEGORIZED_ID }).map((t) => t.id),
    ).toEqual(["loose-task"]);
    expect(matchesCategory(loose, UNCATEGORIZED_ID)).toBe(true);
    expect(matchesCategory(work, UNCATEGORIZED_ID)).toBe(false);
  });

  it("does not confuse the bucket with a real category called like it", () => {
    // A real id is a cuid, so the sentinel can never collide with one.
    expect(matchesCategory(task({ id: "x", categoryId: "work" }), "work")).toBe(true);
    expect(matchesCategory(task({ id: "y" }), "work")).toBe(false);
  });

  it("combines with the text search", () => {
    const result = applyFilters(list, { query: "invoice", categoryId: UNCATEGORIZED_ID });
    expect(result.map((t) => t.id)).toEqual(["loose-task"]);
  });

  it("selects everything when no category is chosen", () => {
    expect(matchesCategory(work, null)).toBe(true);
    expect(matchesCategory(loose, null)).toBe(true);
    expect(applyFilters(list, DEFAULT_FILTERS)).toHaveLength(3);
  });

  it("counts each active control", () => {
    expect(countActiveFilters({ query: "", categoryId: null })).toBe(0);
    expect(countActiveFilters({ query: "", categoryId: "work" })).toBe(1);
    expect(countActiveFilters({ query: "x", categoryId: null })).toBe(1);
    expect(countActiveFilters({ query: "x", categoryId: UNCATEGORIZED_ID })).toBe(2);
    expect(hasActiveFilters({ query: "", categoryId: UNCATEGORIZED_ID })).toBe(true);
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });
});
