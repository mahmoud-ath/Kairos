import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Drag and drop with the pointer sensor.
 *
 * dnd-kit needs a real pointer sequence (down → move past the activation
 * distance → move onto the target → up), so these tests drive the mouse
 * directly. A tall viewport keeps every row on screen, which makes the
 * coordinates stable for the whole gesture.
 *
 * The horizontal offset matters: dragging right onto a task nests it, while a
 * neutral drag reorders.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

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
 * A `YYYY-MM-DD` date offset from today in the machine's timezone.
 *
 * The app resolves "today" with the timezone in Settings (the server's), so
 * tests must not compute dates from a UTC timestamp.
 */
function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function addTask(page: Page, title: string, plannedDate?: string) {
  // Creating a task re-renders the view from the saved data. Wait for any
  // in-flight round-trip to settle first, so the next title is never typed into
  // a field the refresh is about to replace.
  await page.waitForLoadState("networkidle");
  const input = await quickAdd(page);
  await input.fill(title);
  if (plannedDate) {
    const date = page.getByLabel("Planned date");
    await expect(date).toHaveCount(1);
    await date.fill(plannedDate);
  }
  await input.press("Enter");
  await expect(page.getByRole("button", { name: `Open task ${title}` })).toBeVisible();
  // The form only clears once the server accepted the task...
  await expect(input).toHaveValue("");
  // ...and the re-render that follows has to finish before the next create.
  await page.waitForLoadState("networkidle");
}

/** Drag a row's handle to the given row, offset horizontally by `dx`. */
async function dragHandleOnto(
  page: Page,
  handleLabel: string,
  target: Locator,
  { dx = 0, dy = 8 }: { dx?: number; dy?: number } = {},
) {
  await page.evaluate(() => window.scrollTo(0, 0));

  const handle = page.getByRole("button", { name: handleLabel });
  await handle.scrollIntoViewIfNeeded();
  await expect(handle).toBeVisible();
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error(`Handle "${handleLabel}" has no bounding box.`);

  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move past the 6px activation distance before heading for the target.
  await page.mouse.move(startX + 8, startY + 8, { steps: 4 });

  const targetBox = await target.boundingBox();
  if (!targetBox) throw new Error("Drop target has no bounding box.");
  // The horizontal offset from the drag start decides nest vs. reorder.
  await page.mouse.move(startX + dx, targetBox.y + dy, { steps: 15 });
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
  await dragHandleOnto(page, `Reorder task ${beta}`, page.getByRole("listitem").filter({ hasText: alpha }), {
    dy: 10,
  });

  await expect
    .poll(async () => (await rowTexts(page, [alpha, beta]))[0] ?? "")
    .toContain(beta);

  await page.reload();
  await expect
    .poll(async () => (await rowTexts(page, [alpha, beta]))[0] ?? "")
    .toContain(beta);
});

test("dropping a task into a date group changes its planned date", async ({ page }) => {
  const moved = "Drag move me";
  const anchor = "Drag tomorrow anchor";
  const tomorrow = localDate(1);
  const later = localDate(2);

  // Upcoming groups by planned date: one task creates a "Tomorrow" group for the
  // other one to be dropped into.
  await page.goto("/upcoming");
  await addTask(page, anchor, tomorrow);
  await addTask(page, moved, later);

  const row = page.getByRole("listitem").filter({ hasText: moved });
  await expect(row.getByText("Tomorrow")).toBeHidden();

  const tomorrowHeading = page.getByRole("heading", { name: "Tomorrow", exact: true }).first();
  await expect(tomorrowHeading).toBeVisible();

  await dragHandleOnto(page, `Reorder task ${moved}`, tomorrowHeading, { dy: 56 });

  await expect(
    page.getByRole("listitem").filter({ hasText: moved }).getByText("Tomorrow"),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("listitem").filter({ hasText: moved }).getByText("Tomorrow"),
  ).toBeVisible();
});

test("dragging a task right onto another makes it a subtask", async ({ page }) => {
  const parent = "Drag nest parent";
  const child = "Drag nest child";

  await page.goto("/tasks");
  await addTask(page, parent);
  await addTask(page, child);

  const parentRow = page.getByRole("listitem").filter({ hasText: parent });
  await expect(parentRow.getByLabel("0 of 1 subtasks completed")).toBeHidden();

  // Drag the child to the right, onto the parent row.
  await dragHandleOnto(page, `Reorder task ${child}`, parentRow, { dx: 90, dy: 12 });

  // The parent now reports one subtask, and the child is nested under it.
  await expect(
    page.getByRole("listitem").filter({ hasText: parent }).getByLabel("0 of 1 subtasks completed"),
  ).toBeVisible();
  await expect(page.getByLabel(`Complete ${child}`).first()).toBeVisible();

  // It is nested in the database too, not only in the DOM.
  await page.reload();
  await expect(
    page.getByRole("listitem").filter({ hasText: parent }).getByLabel("0 of 1 subtasks completed"),
  ).toBeVisible();
});

test("a subtask can be pulled back out to the top level", async ({ page }) => {
  const parent = "Drag nest parent";
  const child = "Drag nest child";

  await page.goto("/tasks");
  const parentRow = page.getByRole("listitem").filter({ hasText: parent });
  await expect(parentRow.getByLabel("0 of 1 subtasks completed")).toBeVisible();

  // Keyboard/click alternative to dragging left.
  await page.getByRole("button", { name: `Move ${child} to the top level` }).first().click();

  await expect(
    page.getByRole("listitem").filter({ hasText: parent }).getByLabel("0 of 1 subtasks completed"),
  ).toBeHidden();

  await page.reload();
  await expect(page.getByRole("button", { name: `Open task ${child}` })).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: parent }).getByLabel("1 of 1 subtasks completed"),
  ).toBeHidden();
});
