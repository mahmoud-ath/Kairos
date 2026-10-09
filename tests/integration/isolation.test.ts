import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedPrisma } from "@/server/db";
import { exportBackup, importBackup, resetAllData } from "@/server/services/backup";
import { getSettingsRecord, updateSettings } from "@/server/services/settings";
import { createCategory, listCategories } from "@/server/services/taxonomy";
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  setTaskStatus,
  updateTask,
} from "@/server/services/tasks";

/**
 * The security boundary of a multi-user Kairos: one account must never reach
 * another account's rows.
 *
 * Both tenants use random ids, so this can run against any database without
 * colliding with real data, and it cleans up after itself.
 */
const alice = `test-alice-${randomUUID()}`;
const bob = `test-bob-${randomUUID()}`;

/** Remove everything the two test tenants own. */
async function wipe(userId: string) {
  const db = scopedPrisma(userId);
  await db.taskEvent.deleteMany();
  await db.task.deleteMany();
  await db.category.deleteMany();
  await db.settings.deleteMany();
}

beforeAll(async () => {
  await wipe(alice);
  await wipe(bob);
});

afterAll(async () => {
  await wipe(alice);
  await wipe(bob);
});

describe("multi-user isolation", () => {
  it("keeps task lists separate", async () => {
    const aliceTask = await createTask(alice, { title: "Alice's task" });
    const bobTask = await createTask(bob, { title: "Bob's task" });

    expect((await listTasks(alice)).map((task) => task.id)).toEqual([aliceTask.id]);
    expect((await listTasks(bob)).map((task) => task.id)).toEqual([bobTask.id]);
  });

  it("cannot read another user's task by id", async () => {
    const aliceTask = await createTask(alice, { title: "Private" });

    expect(await getTask(bob, aliceTask.id)).toBeNull();
    expect(await getTask(alice, aliceTask.id)).not.toBeNull();
  });

  it("cannot update another user's task", async () => {
    const aliceTask = await createTask(alice, { title: "Untouchable" });

    await expect(
      updateTask(bob, { id: aliceTask.id, title: "Hijacked" }),
    ).rejects.toThrow();

    expect((await getTask(alice, aliceTask.id))?.title).toBe("Untouchable");
  });

  it("cannot complete another user's task", async () => {
    const aliceTask = await createTask(alice, { title: "Not yours" });

    await expect(setTaskStatus(bob, aliceTask.id, "DONE")).rejects.toThrow();

    expect((await getTask(alice, aliceTask.id))?.status).toBe("TODO");
  });

  it("cannot delete another user's task", async () => {
    const aliceTask = await createTask(alice, { title: "Keep me" });

    await expect(deleteTask(bob, aliceTask.id)).rejects.toThrow();

    expect(await getTask(alice, aliceTask.id)).not.toBeNull();
  });

  it("lets two users each own a category with the same name", async () => {
    const aliceCategory = await createCategory(alice, { name: "Work" });
    const bobCategory = await createCategory(bob, { name: "Work" });

    expect(aliceCategory.id).not.toBe(bobCategory.id);

    const aliceIds = (await listCategories(alice)).map((category) => category.id);
    const bobIds = (await listCategories(bob)).map((category) => category.id);

    expect(aliceIds).toContain(aliceCategory.id);
    expect(bobIds).toContain(bobCategory.id);
    expect(bobIds).not.toContain(aliceCategory.id);
  });

  it("cannot file a task under another user's category", async () => {
    const aliceCategory = await createCategory(alice, {
      name: `Private ${randomUUID()}`,
    });

    await expect(
      createTask(bob, { title: "Sneaky", categoryId: aliceCategory.id }),
    ).rejects.toThrow();
  });

  it("keeps settings independent", async () => {
    await updateSettings(alice, { theme: "dark", weekStartsOn: 0 });
    await updateSettings(bob, { theme: "light", weekStartsOn: 1 });

    expect((await getSettingsRecord(alice)).theme).toBe("dark");
    expect((await getSettingsRecord(alice)).weekStartsOn).toBe(0);
    expect((await getSettingsRecord(bob)).theme).toBe("light");
    expect((await getSettingsRecord(bob)).weekStartsOn).toBe(1);
  });

  it("exports only the requesting user's data", async () => {
    const marker = `bob-only-${randomUUID()}`;
    await createTask(bob, { title: marker });

    expect(JSON.stringify(await exportBackup(alice))).not.toContain(marker);
    expect(JSON.stringify(await exportBackup(bob))).toContain(marker);
  });

  /**
   * The import path is the only place the scoped client *upserts* (it re-creates
   * the settings row). A regression here is silent until someone restores a
   * backup, so it is pinned explicitly.
   */
  it("round-trips a backup, including the settings upsert", async () => {
    await createTask(alice, { title: `round-trip-${randomUUID()}` });
    await updateSettings(alice, {
      theme: "dark",
      timezone: "Europe/Berlin",
      weekStartsOn: 1,
    });

    const before = (await listTasks(alice)).map((task) => task.id).sort();
    const file = await exportBackup(alice);

    const { summary } = await importBackup(alice, file);

    expect(summary.tasks).toBeGreaterThan(0);
    expect((await listTasks(alice)).map((task) => task.id).sort()).toEqual(before);
    expect((await getSettingsRecord(alice)).timezone).toBe("Europe/Berlin");
    expect((await getSettingsRecord(alice)).theme).toBe("dark");
  });

  it("resets only the requesting user's data", async () => {
    const bobTask = await createTask(bob, { title: `survives-${randomUUID()}` });

    await resetAllData(alice);

    expect(await listTasks(alice)).toEqual([]);
    expect((await listTasks(bob)).map((task) => task.id)).toContain(bobTask.id);
    // Resetting re-creates the row through the same upsert.
    expect((await getSettingsRecord(alice)).timezone).toBeTruthy();
  });

  it("refuses to run without an owner", () => {
    expect(() => scopedPrisma("")).toThrow(/without a userId/);
  });
});
