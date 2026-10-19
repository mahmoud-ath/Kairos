import { describe, expect, it } from "vitest";

import {
  CELEBRATION_TITLE_MAX_LENGTH,
  COMPLETION_TITLE,
  completionMessage,
  shortTitle,
} from "@/lib/celebrate";

describe("the completion message", () => {
  it("congratulates on a task and names it", () => {
    const message = completionMessage("task", "Send the invoice");
    expect(message.title).toBe(COMPLETION_TITLE.task);
    expect(message.description).toBe("You completed “Send the invoice”.");
  });

  it("has its own headline for a subtask", () => {
    const message = completionMessage("subtask", "Buy stamps");
    expect(message.title).toBe(COMPLETION_TITLE.subtask);
    expect(message.description).toContain("“Buy stamps”");
  });

  it("speaks about today for a habit", () => {
    const message = completionMessage("habit", "Read 20 pages");
    expect(message.title).toBe(COMPLETION_TITLE.habit);
    expect(message.description).toContain("today");
  });

  it("uses a distinct headline per kind", () => {
    const headlines = new Set(Object.values(COMPLETION_TITLE));
    expect(headlines.size).toBe(3);
  });
});

describe("the short title", () => {
  it("trims and collapses whitespace so the toast stays one line", () => {
    expect(shortTitle("task", "  Send\n\nthe   invoice  ")).toBe("Send the invoice");
  });

  it("caps a long title and marks the cut", () => {
    const long = "a".repeat(CELEBRATION_TITLE_MAX_LENGTH + 20);
    const short = shortTitle("task", long);
    expect(short).toHaveLength(CELEBRATION_TITLE_MAX_LENGTH);
    expect(short.endsWith("…")).toBe(true);
  });

  it("leaves a title at the limit untouched", () => {
    const exact = "b".repeat(CELEBRATION_TITLE_MAX_LENGTH);
    expect(shortTitle("task", exact)).toBe(exact);
  });

  it("never truncates a short title", () => {
    expect(shortTitle("habit", "Read")).toBe("Read");
  });

  it("falls back per kind when there is no title", () => {
    expect(shortTitle("task", "   ")).toBe("a task");
    expect(shortTitle("subtask", "")).toBe("a subtask");
    expect(shortTitle("habit", "")).toBe("a habit");
  });

  it("still produces a readable description for an empty title", () => {
    expect(completionMessage("task", "").description).toBe("You completed “a task”.");
  });
});
