import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Drag and drop with the pointer sensor.
 *
 * dnd-kit needs a real pointer sequence (down → move past the activation
 * distance → move onto the target → up), so these tests drive the mouse
 * directly. A tall viewport keeps every row on screen, which makes the
 * coordinates stable for the whole gesture.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

async function addTask(page: Page, title: string, plannedDate?: string) {
  await page.getByLabel("New task title").fill(title);
  if (plannedDate) await page.getByLabel("Planned date").fill(plannedDate);
  await page.getByLabel("New task title").press("Enter");
  await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeVisible();
}

/** Drag a row's handle onto a point inside `target`. */
async function dragHandleOnto(
  page: Page,
  handleLabel: string,
  target: Locator,
  offsetY = 8,
) {
  await page.evaluate(() => window.scrollTo(0, 0));

  const handle = page.getByRole("button", { name: handleLabel });
  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error(`Handle "${handleLabel}" has no bounding box.`);

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move past the 6px activation distance before looking at the target.
  await page.mouse.move(startX + 10, startY + 10, { steps: 4 });

  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error("Drop target has no bounding box.");
  await page.mouse.move(targetBox.x + 60, targetBox.y + offsetY, { steps: 15 });
  await page.mouse.up();
}

/** Visible row texts for the given titles, in document order. */
function rowTexts(page: Page, titles: string[]) {
  return page
    .getByRole("listitem")
    .filter({ hasText: new RegExp(titles.join("|")) })
    .allInnerTexts();
}

test("reorders tasks by dragging and persists the new order", async ({ page }) => {
  const alpha = "Drag alpha task";
  const beta = "Drag beta task";

  await page.goto("/tasks");
  await addTask(page, alpha);
  await addTask(page, beta);

  const before = await rowTexts(page, [alpha, beta]);
  expect(before.findIndex((text) => text.includes(alpha))).toBeLessThan(
    before.findIndex((text) => text.includes(beta)),
  );

  // Drag "beta" onto the row above it, inside the same (Unscheduled) group.
  await dragHandleOnto(
    page,
    `Reorder task ${beta}`,
    page.getByRole("listitem").filter({ hasText: alpha }),
    10,
  );

  await expect
    .poll(async () => (await rowTexts(page, [alpha, beta]))[0] ?? "")
    .toContain(beta);

  // The order came from the database, not just the DOM.
  await page.reload();
  await expect
    .poll(async () => (await rowTexts(page, [alpha, beta]))[0] ?? "")
    .toContain(beta);
});

test("dropping a task into a date group changes its planned date", async ({ page }) => {
  const moved = "Drag move me";
  const later = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Upcoming groups by planned date, so both rows are next to each other.
  await page.goto("/upcoming");
  await addTask(page, moved, later);

  const row = page.getByRole("listitem").filter({ hasText: moved });
  await expect(row.getByText("Tomorrow")).toBeHidden();

  const tomorrowHeading = page.getByRole("heading", { name: "Tomorrow", exact: true }).first();
  await expect(tomorrowHeading).toBeVisible();

  await dragHandleOnto(page, `Reorder task ${moved}`, tomorrowHeading, 56);

  // Moving between date groups changes scheduledDate (the day chip follows).
  await expect(
    page.getByRole("listitem").filter({ hasText: moved }).getByText("Tomorrow"),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("listitem").filter({ hasText: moved }).getByText("Tomorrow"),
  ).toBeVisible();
});
