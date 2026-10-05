import { describe, expect, it } from "vitest";

import {
  ancestorIds,
  canAcceptSubtasks,
  isAncestorOf,
  subtaskProgress,
  subtasksToComplete,
  validateParentAssignment,
  type TaskParentLink,
} from "@/lib/task-rules";

const parent: TaskParentLink = { id: "parent", parentId: null, title: "Parent" };
const otherParent: TaskParentLink = { id: "other", parentId: null, title: "Other" };
const child: TaskParentLink = { id: "child", parentId: "parent", title: "Child" };
const grandchild: TaskParentLink = { id: "grandchild", parentId: "child", title: "Grandchild" };

const byId = new Map<string, TaskParentLink>(
  [parent, otherParent, child, grandchild].map((task) => [task.id, task]),
);

describe("parent assignment rules", () => {
  it("accepts attaching a task to a top-level parent", () => {
    expect(validateParentAssignment(byId, "other", "parent")).toEqual({ ok: true });
  });

  it("accepts detaching a subtask", () => {
    expect(validateParentAssignment(byId, "child", null)).toEqual({ ok: true });
  });

  it("rejects a task becoming its own parent", () => {
    const result = validateParentAssignment(byId, "parent", "parent");
    expect(result.ok).toBe(false);
  });

  it("rejects nesting deeper than one level", () => {
    const result = validateParentAssignment(byId, "other", "child");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/one level/);
  });

  it("rejects cycles", () => {
    const cyclic = new Map(byId);
    cyclic.set("parent", { id: "parent", parentId: "child" });
    const result = validateParentAssignment(cyclic, "parent", "child");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/cycle|one level/);
  });

  it("rejects unknown parents and tasks", () => {
    expect(validateParentAssignment(byId, "missing", "parent").ok).toBe(false);
    expect(validateParentAssignment(byId, "other", "missing").ok).toBe(false);
  });

  it("knows who is an ancestor", () => {
    expect(ancestorIds(byId, "grandchild")).toEqual(["child", "parent"]);
    expect(isAncestorOf(byId, "parent", "grandchild")).toBe(true);
    expect(isAncestorOf(byId, "grandchild", "parent")).toBe(false);
  });

  it("only lets top-level tasks accept subtasks", () => {
    expect(canAcceptSubtasks(byId, "parent")).toBe(true);
    expect(canAcceptSubtasks(byId, "child")).toBe(false);
  });
});

describe("subtask completion behaviour", () => {
  const subtasks = [
    { id: "a", status: "DONE" },
    { id: "b", status: "TODO" },
    { id: "c", status: "TODO" },
  ];

  it("reports progress as done/total", () => {
    expect(subtaskProgress(subtasks)).toEqual({ done: 1, total: 3, percent: 33 });
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("completes every unfinished subtask, never the finished ones", () => {
    expect(subtasksToComplete(subtasks)).toEqual(["b", "c"]);
    expect(subtasksToComplete([])).toEqual([]);
  });

  it("never reopens subtasks when a parent is reopened", () => {
    expect(subtasksToComplete([{ id: "a", status: "DONE" }])).toEqual([]);
  });
});
