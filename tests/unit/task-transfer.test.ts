import { describe, expect, it } from "vitest";

import {
  buildTaskTransferFile,
  parseTaskTransferText,
  TASK_TRANSFER_FORMAT,
  TASK_TRANSFER_VERSION,
  validateTaskTransfer,
} from "@/lib/task-transfer";

const FILE = {
  format: TASK_TRANSFER_FORMAT,
  version: TASK_TRANSFER_VERSION,
  exportedAt: "2026-11-13T09:00:00.000Z",
  tasks: [
    {
      title: "Plan the week",
      notes: "Three priorities",
      status: "TODO",
      category: "Work",
      scheduledDate: "2026-11-13",
      dueDate: null,
      subtasks: [
        { title: "Collect inputs", status: "TODO" },
        { title: "Draft plan", status: "DONE", completedAt: "2026-11-12T10:00:00.000Z" },
      ],
    },
    {
      title: "Buy milk",
      status: "DONE",
      completedAt: "2026-11-12T18:00:00.000Z",
      subtasks: [],
    },
  ],
};

describe("the task transfer file", () => {
  it("accepts a well formed file and summarises it", () => {
    const result = validateTaskTransfer(FILE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary.tasks).toBe(2);
    expect(result.summary.subtasks).toBe(2);
    // One completed top-level task plus one completed subtask.
    expect(result.summary.completed).toBe(2);
    expect(result.summary.categories).toEqual(["Work"]);
    expect(result.summary.exportedAt).toBe("2026-11-13T09:00:00.000Z");
  });

  it("refuses a file that is not a Kairos task file", () => {
    const result = validateTaskTransfer({ format: "something-else", version: 1, tasks: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("refuses an empty task list", () => {
    const result = validateTaskTransfer({ ...FILE, tasks: [] });
    expect(result.ok).toBe(false);
  });

  it("refuses a title that is blank after trimming", () => {
    const result = validateTaskTransfer({
      ...FILE,
      tasks: [{ title: "   " }],
    });
    expect(result.ok).toBe(false);
  });

  it("refuses a date that is not a calendar day", () => {
    const result = validateTaskTransfer({
      ...FILE,
      tasks: [{ title: "Task", scheduledDate: "2026-02-30" }],
    });
    expect(result.ok).toBe(false);
  });

  it("refuses text that is not JSON", () => {
    const result = parseTaskTransferText("{ not json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/not valid JSON/i);
  });

  it("round-trips through its own text form", () => {
    const file = buildTaskTransferFile(
      [{ title: "Only task", status: "TODO" }],
      "2026-11-13T09:00:00.000Z",
    );
    const result = parseTaskTransferText(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.tasks).toBe(1);
    expect(result.summary.completed).toBe(0);
  });
});
