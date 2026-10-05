import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Backup round-trip.
 *
 * A client-side navigation can briefly keep the previous route's tree in the
 * DOM (hidden), so locators that exist on several routes are awaited with
 * `expectSingle` before being asserted on.
 */
async function expectSingle(locator: Locator): Promise<Locator> {
  await expect(locator).toHaveCount(1);
  return locator;
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

/** The counts and rows the example data should produce after a restore. */
async function expectExampleDataRestored(page: Page) {
  await expect(
    page.getByRole("button", { name: "Open task Draft the Q3 roadmap" }),
  ).toBeVisible();
  await expect(await expectSingle(page.getByLabel("0 of 3 subtasks completed"))).toBeVisible();
  await expect(await expectSingle(page.getByRole("link", { name: "Today 3" }))).toBeVisible();
  await expect(await expectSingle(page.getByRole("link", { name: "Completed 1" }))).toBeVisible();
}

test("JSON export and import round-trips tasks, subtasks and categories", async ({ page }) => {
  // Start from an empty workspace, then load the known example data set.
  await resetAllData(page);
  await page.goto("/today");
  await page.getByRole("button", { name: "Load example tasks" }).click();
  await expectExampleDataRestored(page);

  // Export: the browser downloads a versioned backup file.
  await page.goto("/settings");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export JSON" }).click(),
  ]);
  const file = await download.path();
  expect(file).toBeTruthy();
  expect(download.suggestedFilename()).toMatch(/^kairos-backup-\d{4}-\d{2}-\d{2}\.json$/);

  // Wipe everything, so a successful import cannot be a coincidence.
  await resetAllData(page);
  await page.goto("/today");
  await expect(page.getByRole("button", { name: "Open task Draft the Q3 roadmap" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Load example tasks" })).toBeVisible();

  // Import: validated, summarised, confirmed, then applied in one transaction.
  await page.goto("/settings");
  await page.locator('input[type="file"]').setInputFiles(file as string);
  await expect(page.getByText("Replace all data with this backup?")).toBeVisible();
  await expect(page.getByText("Format version")).toBeVisible();
  await page.getByRole("button", { name: "Replace data" }).click();
  await expect(page.getByText("Backup imported")).toBeVisible();

  // Everything came back: tasks, subtasks, categories, notes and counters.
  await page.goto("/today");
  await expectExampleDataRestored(page);
  await expect(page.getByRole("link", { name: /^Work/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "Open task Draft the Q3 roadmap" }).click();
  const sheet = page.getByRole("dialog").first();
  await expect(sheet.getByLabel("Category")).toContainText("Work");
  await expect(sheet.getByLabel("Notes")).toHaveValue(/retention/);
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
  await expect(
    page.getByRole("button", { name: "Open task Draft the Q3 roadmap" }),
  ).toBeVisible();
});
