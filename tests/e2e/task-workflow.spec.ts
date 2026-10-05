import { expect, test } from "@playwright/test";

/**
 * The core task workflow: capture, complete, reopen, split into subtasks,
 * survive a reload, and delete with undo.
 *
 * The spec starts by resetting all data, so it is deterministic no matter what
 * other specs left behind (they share one database for the whole run).
 */
test.describe("task workflow", () => {
  test("reset to the first-run state, load examples, then work a task", async ({ page }) => {
    const title = "Write the Kairos release notes";

    // --- first run ---------------------------------------------------------
    await page.goto("/settings");
    await page.getByRole("button", { name: "Reset everything" }).click();
    const resetDialog = page.getByRole("alertdialog");
    await resetDialog.getByLabel("Type RESET to confirm").fill("RESET");
    await resetDialog.getByRole("button", { name: "Delete all data" }).click();
    await expect(page.getByText("All data deleted")).toBeVisible();

    await page.goto("/today");
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
    // Nothing is created silently: the example data is an explicit choice.
    const loadExamples = page.getByRole("button", { name: "Load example tasks" });
    await expect(loadExamples).toBeVisible();
    await loadExamples.click();
    await expect(
      page.getByRole("button", { name: "Open task Draft the Q3 roadmap" }),
    ).toBeVisible();

    // --- capture -----------------------------------------------------------
    // Enter in the quick-add field creates a task; Today plans it for today.
    await page.getByLabel("New task title").fill(title);
    await page.getByLabel("New task title").press("Enter");
    await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeVisible();

    // Persistence: the task is in the database, not just in memory.
    await page.reload();
    await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeVisible();

    // --- subtasks ----------------------------------------------------------
    await page.getByRole("button", { name: `Open task ${title}` }).click();
    const sheet = page.getByRole("dialog").first();
    await expect(sheet.getByText("Task details")).toBeVisible();

    await sheet.getByRole("button", { name: "Add" }).click();
    await sheet.getByLabel("New subtask title").fill("Draft the changelog");
    await sheet.getByLabel("New subtask title").press("Enter");
    await expect(sheet.getByText("0 of 1 done")).toBeVisible();

    // Completing every subtask does not complete the parent.
    await sheet.getByLabel("Complete Draft the changelog").click();
    await expect(sheet.getByText("1 of 1 done")).toBeVisible();
    await expect(sheet.getByLabel("Complete task")).toBeVisible();

    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(page.getByLabel("1 of 1 subtasks completed")).toBeVisible();

    // --- complete and reopen ----------------------------------------------
    // Clicking the checkbox toggles the task without opening its details.
    await page.getByLabel(`Complete ${title}`).click();
    await expect(page.getByLabel(`Reopen ${title}`)).toBeVisible();

    // Reopening never reopens subtasks (this one is already done).
    await page.getByLabel(`Reopen ${title}`).click();
    await expect(page.getByLabel(`Complete ${title}`)).toBeVisible();
    await expect(page.getByLabel("1 of 1 subtasks completed")).toBeVisible();

    // --- delete with undo --------------------------------------------------
    await page.getByRole("button", { name: `Open task ${title}` }).click();
    await page.getByRole("dialog").first().getByRole("button", { name: "Delete task" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete task" }).click();

    await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeHidden();
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    await undo.click();
    await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeVisible();
  });

  test("statistics, settings and the export endpoint work", async ({ page }) => {
    await page.goto("/statistics");
    await expect(page.getByRole("heading", { name: "Statistics", level: 1 })).toBeVisible();
    await expect(page.getByText("Current status")).toBeVisible();
    await expect(page.getByText("Completion activity")).toBeVisible();
    await expect(page.getByText("Category breakdown")).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Export JSON" })).toBeVisible();

    const response = await page.request.get("/api/backup");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.format).toBe("kairos-backup");
    expect(body.version).toBe(1);
    expect(Array.isArray(body.data.tasks)).toBe(true);
    expect(body.data.settings.timezone).toBeTruthy();

    const health = await page.request.get("/api/health");
    expect(health.status()).toBe(200);
    expect((await health.json()).ok).toBe(true);
  });
});
