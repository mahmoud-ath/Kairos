import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { scopedPrisma } from "@/server/db";
import { createCategory, resolveCategory } from "@/server/services/taxonomy";

/**
 * Category addresses are readable (`/categories/work`) but resolved per account:
 * two people may both have a "Work" category, and a URL must never cross that
 * boundary.
 *
 * Like the isolation suite, both tenants use random ids, so this can run against
 * any database and cleans up after itself.
 */
const alice = `test-alice-${randomUUID()}`;
const bob = `test-bob-${randomUUID()}`;

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

describe("readable category URLs", () => {
  it("resolves a slug inside its own account only", async () => {
    const aliceCategory = await createCategory(alice, { name: "Reading" });
    const bobCategory = await createCategory(bob, { name: "Reading" });

    const aliceResolved = await resolveCategory(alice, "reading");
    const bobResolved = await resolveCategory(bob, "reading");

    expect(aliceResolved?.category.id).toBe(aliceCategory.id);
    expect(bobResolved?.category.id).toBe(bobCategory.id);
    expect(aliceResolved?.slug).toBe("reading");
  });

  it("keeps legacy id links working, for their owner only", async () => {
    const aliceCategory = await createCategory(alice, { name: "Archive" });

    expect((await resolveCategory(alice, aliceCategory.id))?.category.id).toBe(
      aliceCategory.id,
    );
    expect(await resolveCategory(bob, aliceCategory.id)).toBeNull();
    expect(await resolveCategory(alice, "no-such-category")).toBeNull();
  });
});
