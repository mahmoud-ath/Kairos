import { expect, test, type Page } from "@playwright/test";

/**
 * Backup round-trip.
 *
 * Kairos ships no sample data, so the workspace this spec round-trips is built
 * here, through the UI: a category, a task with a subtask and notes, one
 * completed task and one habit. Everything the export has to carry is therefore
 * something the spec created itself.
 */
const FIXTURE = {
  task: "Plan the sprint",
  subtask: "Outline the work",
  completed: "Archive last month",
  habit: "Read for 20 minutes",
  category: "Work",
  notes: "Keep it short: three bullets and a link.",
} as const;

/** The current page's quick-add input (one, even mid-navigation). */
async function quickAdd(page: Page) {
  const input = page.getByLabel("New task title");
  await expect(input).toHaveCount(1);
  return input;
}

/** Reset every task, category and event through the settings UI. */
async function resetAllData(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Reset everything" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Type RESET to confirm").fill("RESET");
  await dialog.getByRole("button", { name: "Delete all data" }).click();
  await expect(page.getByText("All data deleted")).toBeVisible();
}

/** Create the rows the round-trip has to preserve. */
async function buildWorkspace(page: Page) {
  // A habit, with its generated instance in Today.
  await page.goto("/habits");
  await page.getByRole("button", { name: "New habit" }).first().click();
  const habitDialog = page.getByRole("dialog").first();
  await habitDialog.getByLabel("Title").fill(FIXTURE.habit);
  await habitDialog.getByRole("button", { name: "Create habit" }).click();
  await expect(page.getByText(`Habit “${FIXTURE.habit}” created`)).toBeVisible();

  await page.goto("/today");
  // A category created inline: its name, colour and icon travel too.
  await page.getByRole("button", { name: "No category" }).click();
  await page.getByRole("button", { name: "New category" }).click();
  await page.getByLabel("New category name").fill(FIXTURE.category);
  await page.getByLabel("New category name").press("Enter");
  await expect(page.getByRole("button", { name: FIXTURE.category, exact: true })).toBeVisible();

  const input = await quickAdd(page);
  await input.fill(FIXTURE.task);
  await input.press("Enter");
  await expect(page.getByRole("button", { name: `Open task ${FIXTURE.task}` })).toBeVisible();

  // Notes and a subtask, so both are checked after the restore.
  await page.getByRole("button", { name: `Open task ${FIXTURE.task}` }).click();
  const details = page.getByRole("dialog").first();
  await details.getByLabel("Notes").fill(FIXTURE.notes);
  await details.getByRole("button", { name: "Add" }).click();
  await details.getByLabel("New subtask title").fill(FIXTURE.subtask);
  await details.getByLabel("New subtask title").press("Enter");
  await expect(details.getByText("0 of 1 done")).toBeVisible();
  await details.getByRole("button", { name: "Close" }).first().click();

  // One completed task, so the Completed view has something to bring back.
  const second = await quickAdd(page);
  await second.fill(FIXTURE.completed);
  await second.press("Enter");
  await page.getByLabel(`Complete ${FIXTURE.completed}`).click();
  await expect(page.getByLabel(`Reopen ${FIXTURE.completed}`)).toBeVisible();
}

/** What the workspace must look like after a successful restore. */
async function expectWorkspaceRestored(page: Page) {
  await page.goto("/today");
  await expect(page.getByRole("button", { name: `Open task ${FIXTURE.task}` })).toBeVisible();
  await expect(page.getByLabel("0 of 1 subtasks completed")).toBeVisible();
  // The category is back in the sidebar as well as on the task.
  await expect(
    page.getByRole("link", { name: new RegExp(`^${FIXTURE.category}`) }).first(),
  ).toBeVisible();

  await page.goto("/completed");
  await expect(
    page.getByRole("button", { name: `Open task ${FIXTURE.completed}` }),
  ).toBeVisible();

  await page.goto("/habits");
  await expect(page.getByRole("heading", { name: "Habits", level: 1 })).toBeVisible();
  await expect(page.getByText(FIXTURE.habit).first()).toBeVisible();
}

test("JSON export and import round-trips tasks, subtasks and categories", async ({ page }) => {
  // Start from an empty workspace, then build the known one.
  await resetAllData(page);
  await buildWorkspace(page);
  await expectWorkspaceRestored(page);

  // Export: the browser downloads a versioned backup file chosen in a dialog.
  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    (async () => {
      await page.getByRole("button", { name: "Export JSON" }).click();
      await expect(page.getByText("Export a JSON backup")).toBeVisible();
      await page.getByRole("button", { name: "Download" }).click();
    })(),
  ]);
  const file = await download.path();
  expect(file).toBeTruthy();
  expect(download.suggestedFilename()).toMatch(/^kairos-backup-\d{4}-\d{2}-\d{2}\.json$/);

  // Wipe everything, so a successful import cannot be a coincidence.
  await resetAllData(page);
  await page.goto("/today");
  await expect(page.getByRole("button", { name: `Open task ${FIXTURE.task}` })).toBeHidden();

  // Import: validated, summarised, confirmed, then applied in one transaction.
  await page.goto("/settings");
  await page.locator('input[type="file"]').setInputFiles(file as string);
  await expect(page.getByText("Import this backup?")).toBeVisible();
  await expect(page.getByText("Format version")).toBeVisible();
  await page.getByRole("button", { name: "Import data" }).click();
  await expect(page.getByText("Backup imported")).toBeVisible();

  // Everything came back: tasks, subtask, category, habit and completed work.
  await expectWorkspaceRestored(page);

  await page.goto("/today");
  await page.getByRole("button", { name: `Open task ${FIXTURE.task}` }).click();
  const sheet = page.getByRole("dialog").first();
  await expect(sheet.getByLabel("Category")).toContainText(FIXTURE.category);
  await expect(sheet.getByLabel("Notes")).toHaveValue(FIXTURE.notes);
});

test("import rejects an invalid file without touching the data", async ({ page }) => {
  await page.goto("/settings");

  await page.locator('input[type="file"]').setInputFiles({
    name: "broken-kairos.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "kairos-backup", version: 2, data: { tasks: [] } }),
      "utf8",
    ),
  });

  await expect(page.getByText("This file could not be imported")).toBeVisible();
  await expect(page.getByText(/Required/).first()).toBeVisible();

  // The workspace is untouched.
  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: `Open task ${FIXTURE.task}` })).toBeVisible();
});
