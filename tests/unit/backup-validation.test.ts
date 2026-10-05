import { describe, expect, it } from "vitest";

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  buildBackupFile,
  parseBackupText,
  validateBackup,
} from "@/lib/backup";

function validBackup() {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: "2026-10-04T12:00:00.000Z",
    data: {
      settings: { theme: "dark", timezone: "Europe/Berlin", weekStartsOn: 1 },
      categories: [
        { id: "cat-1", name: "Work", color: "#3b82f6", position: 0 },
        { id: "cat-2", name: "Home", color: "#22c55e", position: 1 },
      ],
      labels: [{ id: "label-1", name: "Deep work", color: "#f97316" }],
      tasks: [
        {
          id: "task-1",
          title: "Write the report",
          notes: null,
          status: "TODO",
          priority: "HIGH",
          categoryId: "cat-1",
          parentId: null,
          scheduledDate: "2026-10-04",
          dueDate: "2026-10-06",
          position: 0,
          createdAt: "2026-10-01T08:00:00.000Z",
          updatedAt: "2026-10-01T08:00:00.000Z",
          completedAt: null,
        },
        {
          id: "task-2",
          title: "Outline",
          status: "DONE",
          priority: "NONE",
          categoryId: "cat-1",
          parentId: "task-1",
          scheduledDate: null,
          dueDate: null,
          position: 0,
          completedAt: "2026-10-03T08:00:00.000Z",
        },
      ],
      taskLabels: [{ taskId: "task-1", labelId: "label-1" }],
      events: [
        {
          id: "event-1",
          taskId: "task-2",
          action: "completed",
          timestamp: "2026-10-03T08:00:00.000Z",
          metadata: null,
        },
      ],
    },
  };
}

describe("backup validation", () => {
  it("accepts a complete, consistent file and summarises it", () => {
    const result = validateBackup(validBackup());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.tasks).toBe(1);
    expect(result.summary.subtasks).toBe(1);
    expect(result.summary.completedTasks).toBe(1);
    expect(result.summary.categories).toBe(2);
    expect(result.summary.labels).toBe(1);
    expect(result.summary.events).toBe(1);
    expect(result.summary.timezone).toBe("Europe/Berlin");
    expect(result.summary.warnings).toEqual([]);
  });

  it("rejects an unsupported format", () => {
    const result = validateBackup({ ...validBackup(), format: "something-else" });
    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported version", () => {
    const result = validateBackup({ ...validBackup(), version: 99 });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid JSON", () => {
    const result = parseBackupText("{ not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/JSON/);
  });

  it("rejects a task that references a missing category", () => {
    const backup = validBackup();
    backup.data.tasks[0].categoryId = "cat-missing";
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/missing category/);
  });

  it("rejects a subtask whose parent does not exist", () => {
    const backup = validBackup();
    backup.data.tasks[1].parentId = "task-missing";
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/missing parent/);
  });

  it("rejects nesting deeper than one level", () => {
    const backup = validBackup();
    backup.data.tasks[1].parentId = "task-1";
    backup.data.tasks.push({
      ...backup.data.tasks[1],
      id: "task-3",
      title: "Too deep",
      parentId: "task-2",
    } as (typeof backup.data.tasks)[number]);
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/one nesting level/);
  });

  it("rejects parent cycles", () => {
    const backup = validBackup();
    backup.data.tasks[0].parentId = "task-2";
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate ids", () => {
    const backup = validBackup();
    backup.data.tasks.push({ ...backup.data.tasks[1] });
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/Duplicate task id/);
  });

  it("rejects label assignments to missing tasks or labels", () => {
    const backup = validBackup();
    backup.data.taskLabels.push({ taskId: "task-1", labelId: "label-missing" });
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/missing label/);
  });

  it("warns about a subtask category mismatch and a completed task without a time", () => {
    const backup = validBackup();
    backup.data.tasks[1].categoryId = "cat-2";
    backup.data.tasks[1].completedAt = null as unknown as string;
    const result = validateBackup(backup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary.warnings.length).toBeGreaterThan(0);
  });

  it("warns when an event points at a missing task but keeps the file valid", () => {
    const backup = validBackup();
    backup.data.events.push({
      id: "event-2",
      taskId: "task-missing",
      action: "completed",
      timestamp: "2026-10-03T08:00:00.000Z",
      metadata: null,
    });
    const result = validateBackup(backup);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.summary.warnings.length).toBeGreaterThan(0);
  });
});

describe("backup export shape", () => {
  it("is versioned and contains every entity the app can hold", () => {
    const file = buildBackupFile({
      settings: { theme: "system", timezone: "UTC", weekStartsOn: 1 },
      categories: [
        {
          id: "cat-1",
          name: "Work",
          color: "#3b82f6",
          position: 0,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
      labels: [{ id: "label-1", name: "Deep work", color: "#f97316" }],
      tasks: [
        {
          id: "task-1",
          title: "Task",
          notes: "Notes",
          status: "TODO",
          priority: "LOW",
          categoryId: "cat-1",
          parentId: null,
          scheduledDate: new Date("2026-10-04T00:00:00.000Z"),
          dueDate: null,
          position: 0,
          createdAt: new Date("2026-10-01T00:00:00.000Z"),
          updatedAt: new Date("2026-10-02T00:00:00.000Z"),
          completedAt: null,
        },
      ],
      taskLabels: [{ taskId: "task-1", labelId: "label-1" }],
      events: [],
      now: new Date("2026-10-04T12:00:00.000Z"),
    });

    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.exportedAt).toBe("2026-10-04T12:00:00.000Z");
    expect(file.data.tasks[0].scheduledDate).toBe("2026-10-04");
    expect(file.data.settings.timezone).toBe("UTC");
  });

  it("round-trips through validation", () => {
    const file = buildBackupFile({
      settings: { theme: "light", timezone: "UTC", weekStartsOn: 0 },
      categories: [],
      labels: [],
      tasks: [],
      taskLabels: [],
      events: [],
    });
    const result = validateBackup(JSON.parse(JSON.stringify(file)));
    expect(result.ok).toBe(true);
  });
});
