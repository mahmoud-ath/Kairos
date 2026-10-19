import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isTenantModel, TENANT_MODEL_NAMES } from "@/lib/tenancy";

/**
 * The tenancy list is a security boundary: `scopedPrisma` only filters models it
 * recognises, so a model that has a `userId` column but is missing from the list
 * would be readable across accounts.
 *
 * Rather than trusting the list, derive the expectation from the schema itself.
 */
function modelsWithUserId(): string[] {
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  const models: string[] = [];

  // `^model Name {` … `^}` — attribute lines and comments stay inside the body.
  for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, name, body] = match;
    // A field declaration at the start of a line, not a mention in a comment.
    if (/^\s*userId\s+String/m.test(body)) models.push(name);
  }

  return models.sort();
}

describe("tenant models", () => {
  it("lists every model that has a userId column", () => {
    const expected = modelsWithUserId();
    // Sanity: the parser found the models we know about, so an empty list here
    // would mean the regex broke rather than the list being complete.
    expect(expected).toContain("Task");
    expect([...TENANT_MODEL_NAMES].sort()).toEqual(expected);
  });

  it("answers the same way as the list", () => {
    expect(isTenantModel("Task")).toBe(true);
    expect(isTenantModel("PushSubscription")).toBe(true);
    // Prisma's own bookkeeping table is not a model, but guard the negative too.
    expect(isTenantModel("_prisma_migrations")).toBe(false);
  });

  it("has no duplicates", () => {
    expect(new Set(TENANT_MODEL_NAMES).size).toBe(TENANT_MODEL_NAMES.length);
  });
});
