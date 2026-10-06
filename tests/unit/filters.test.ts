import { describe, expect, it } from "vitest";

import { applyFilters, countActiveFilters, DEFAULT_FILTERS, matchesQuery } from "@/lib/filters";
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
    const result = applyFilters(tasks, { query: "report" });
    expect(result.map((t) => t.id)).toEqual(["report", "notes-only"]);
    expect(tasks).toHaveLength(3);
  });

  it("reports whether a search is active", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ query: "  " })).toBe(0);
    expect(countActiveFilters({ query: "report" })).toBe(1);
  });
});
