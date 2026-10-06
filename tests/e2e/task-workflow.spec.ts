import { expect, test, type Page } from "@playwright/test";

/**
 * The core task workflow: capture, complete, reopen, split into subtasks,
 * survive a reload, and delete with undo.
 *
 * The spec starts by resetting all data, so it is deterministic no matter what
 * other specs left behind (they share one database for the whole run).
 */
/**
 * The current page's quick-add input.
 *
 * A client-side navigation can briefly keep the previous route's tree in the
 * DOM (hidden), so wait until exactly one is present.
 */
async function quickAdd(page: Page) {
  const input = page.getByLabel("New task title");
  await expect(input).toHaveCount(1);
  return input;
}

/**
 * A `YYYY-MM-DD` date offset from today in the machine's timezone (the app
 * resolves "today" with the timezone in Settings, not from a UTC timestamp).
 */
function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

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
      page.getByRole("button", { name: "Open task Draft the Q4 roadmap" }),
    ).toBeVisible();

    // There is no Inbox, and All Tasks lists yesterday separately.
    await expect(page.getByRole("link", { name: /Inbox/ })).toBeHidden();
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: "Today", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Unscheduled", exact: true })).toBeVisible();

    const yesterday = localDate(-1);
    const overdueInput = await quickAdd(page);
    await overdueInput.fill("Left over from yesterday");
    const overdueDate = page.getByLabel("Planned date");
    await expect(overdueDate).toHaveCount(1);
    await overdueDate.fill(yesterday);
    await overdueInput.press("Enter");
    await expect(
      page.getByRole("button", { name: "Open task Left over from yesterday" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Yesterday", exact: true })).toBeVisible();

    // --- capture: Enter only, no button -------------------------------------
    await page.goto("/today");
    const quickAddInput = await quickAdd(page);
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeHidden();
    await quickAddInput.fill(title);
    await quickAddInput.press("Enter");
    await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeVisible();

    // Persistence: the task is in the database, not just in memory.
    await page.reload();
    await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeVisible();

    // --- clicking a task opens its notes ------------------------------------
    await page.getByRole("button", { name: `Notes for ${title}` }).click();
    const sheet = page.getByRole("dialog").first();
    await expect(sheet.getByText("Task details")).toBeVisible();
    await sheet.getByLabel("Notes").fill("Keep it short: three bullets and a link.");
    await sheet.getByRole("button", { name: "Close" }).first().click();
    // The note is saved when the field loses focus and shows on the row.
    await expect(page.getByRole("listitem").filter({ hasText: title })).toContainText(
      "Keep it short: three bullets and a link.",
    );

    // --- subtasks ----------------------------------------------------------
    await page.getByRole("button", { name: `Open task ${title}` }).click();
    const detailSheet = page.getByRole("dialog").first();
    await detailSheet.getByRole("button", { name: "Add" }).click();
    await detailSheet.getByLabel("New subtask title").fill("Draft the changelog");
    await detailSheet.getByLabel("New subtask title").press("Enter");
    await expect(detailSheet.getByText("0 of 1 done")).toBeVisible();

    // Completing every subtask does not complete the parent.
    await detailSheet.getByLabel("Complete Draft the changelog").click();
    await expect(detailSheet.getByText("1 of 1 done")).toBeVisible();
    await expect(detailSheet.getByLabel("Complete task")).toBeVisible();

    await detailSheet.getByRole("button", { name: "Close" }).first().click();
    await expect(page.getByLabel("1 of 1 subtasks completed")).toBeVisible();

    // --- complete and reopen ----------------------------------------------
    // Clicking the checkbox toggles the task without opening its details.
    await page.getByLabel(`Complete ${title}`).click();
    await expect(page.getByLabel(`Reopen ${title}`)).toBeVisible();

    await page.getByLabel(`Reopen ${title}`).click();
    await expect(page.getByLabel(`Complete ${title}`)).toBeVisible();
    await expect(page.getByLabel("1 of 1 subtasks completed")).toBeVisible();

    // --- delete with undo --------------------------------------------------
    await page.getByRole("button", { name: `Open task ${title}` }).click();
    await page
      .getByRole("dialog")
      .first()
      .getByRole("button", { name: "Delete task" })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete task" }).click();

    await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeHidden();
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    await undo.click();
    await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeVisible();
  });

  test("categories can be created quickly from the sidebar", async ({ page }) => {
    await page.goto("/today");

    const name = `Quick cat ${Date.now().toString(36).slice(-4)}`;
    await page.getByRole("button", { name: "Add category" }).click();
    await page.getByLabel("New category name").fill(name);
    await page.getByLabel("New category name").press("Enter");

    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();

    // The new category can be used straight away from the quick-add field.
    await page.reload();
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  });

  test("a category can be created inline while adding a task", async ({ page }) => {
    const name = `Inline cat ${Date.now().toString(36).slice(-4)}`;

    await page.goto("/today");
    await expect(page.getByRole("button", { name: "No category" })).toHaveCount(1);
    await page.getByRole("button", { name: "No category" }).click();
    await page.getByRole("button", { name: "New category" }).click();
    await page.getByLabel("New category name").fill(name);
    await page.getByLabel("New category name").press("Enter");

    // The picker selects the new category straight away.
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();

    const input = await quickAdd(page);
    await input.fill("Filed under a new category");
    await input.press("Enter");

    await page.goto("/tasks");
    await expect(
      page.getByRole("listitem").filter({ hasText: "Filed under a new category" }),
    ).toContainText(name);
  });

  test("a new task is dated the day it is created, in any view", async ({ page }) => {
    const iso = localDate(0);

    // All Tasks is where an undated task used to disappear: the field is
    // pre-filled with today and the new task is listed under Today.
    await page.goto("/tasks");
    const date = page.getByLabel("Planned date");
    await expect(date).toHaveCount(1);
    await expect(date).toHaveValue(iso);

    const input = await quickAdd(page);
    await input.fill("Created from All Tasks");
    await input.press("Enter");

    await expect(
      page.getByRole("button", { name: "Open task Created from All Tasks" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today", exact: true }).first()).toBeVisible();
  });

  test("the sidebar and progress panel stay fixed while the list scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 500 });
    await page.goto("/tasks");

    const input = await quickAdd(page);
    for (let index = 0; index < 6; index += 1) {
      const title = `Scroll filler ${index}`;
      await input.fill(title);
      await input.press("Enter");
      // Each create is a server round-trip: wait for the row and for the form to
      // reset before typing the next title.
      await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeVisible();
      await expect(input).toHaveValue("");
    }

    const sidebarLink = page.getByRole("link", { name: /Today/ }).first();
    const panel = page.getByRole("complementary", { name: "Progress" });
    await expect(panel).toBeVisible();

    const beforeSidebar = await sidebarLink.boundingBox();
    const beforePanel = await panel.boundingBox();

    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const afterSidebar = await sidebarLink.boundingBox();
    const afterPanel = await panel.boundingBox();
    expect(afterSidebar?.y).toBe(beforeSidebar?.y);
    expect(afterPanel?.y).toBe(beforePanel?.y);
  });

  test("statistics, settings and the export endpoint work", async ({ page }) => {
    await page.goto("/statistics");
    const stats = page.getByRole("main");
    await expect(page.getByRole("heading", { name: "Statistics", level: 1 })).toBeVisible();
    // Current state...
    await expect(stats.getByRole("heading", { name: "Right now" })).toBeVisible();
    await expect(stats.getByText("In scope")).toBeVisible();
    // ...and history are separate cards.
    await expect(stats.getByRole("heading", { name: "Completion" })).toBeVisible();
    await expect(stats.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(stats.getByRole("heading", { name: "Categories" })).toBeVisible();

    // The activity window is a plain query parameter.
    await stats.getByRole("link", { name: "30 days" }).click();
    await expect(page).toHaveURL(/range=30/);
    await expect(stats.getByRole("heading", { name: "History" })).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Export JSON" })).toBeVisible();

    const response = await page.request.get("/api/backup");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.format).toBe("kairos-backup");
    expect(body.version).toBe(2);
    expect(Array.isArray(body.data.tasks)).toBe(true);
    expect(body.data.settings.timezone).toBeTruthy();
    expect(body.data.tasks[0]).not.toHaveProperty("priority");
    expect(body.data).not.toHaveProperty("labels");

    const health = await page.request.get("/api/health");
    expect(health.status()).toBe(200);
    expect((await health.json()).ok).toBe(true);
  });
});
