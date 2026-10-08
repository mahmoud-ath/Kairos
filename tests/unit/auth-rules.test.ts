import { afterEach, describe, expect, it, vi } from "vitest";

import { allowedEmails, isEmailAllowed, safeNextPath } from "@/lib/auth-rules";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("allowedEmails", () => {
  it("is empty when nothing is configured", () => {
    vi.stubEnv("KAIROS_ALLOWED_EMAILS", "");
    expect(allowedEmails()).toEqual([]);
  });

  it("splits, trims and lowercases the list", () => {
    vi.stubEnv("KAIROS_ALLOWED_EMAILS", " Me@Example.com , other@example.com ");
    expect(allowedEmails()).toEqual(["me@example.com", "other@example.com"]);
  });
});

describe("isEmailAllowed", () => {
  it("allows anyone when no allowlist is configured", () => {
    vi.stubEnv("KAIROS_ALLOWED_EMAILS", "");
    expect(isEmailAllowed("anyone@example.com")).toBe(true);
  });

  it("matches an allowlisted email case-insensitively", () => {
    vi.stubEnv("KAIROS_ALLOWED_EMAILS", "me@example.com,second@example.com");
    expect(isEmailAllowed("ME@EXAMPLE.COM")).toBe(true);
    expect(isEmailAllowed("second@example.com")).toBe(true);
  });

  it("rejects unknown and missing emails once an allowlist is set", () => {
    vi.stubEnv("KAIROS_ALLOWED_EMAILS", "me@example.com");
    expect(isEmailAllowed("intruder@example.com")).toBe(false);
    expect(isEmailAllowed(null)).toBe(false);
    expect(isEmailAllowed(undefined)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a path on this app", () => {
    expect(safeNextPath("/today")).toBe("/today");
    expect(safeNextPath("/categories/abc?x=1")).toBe("/categories/abc?x=1");
  });

  it("falls back to /today when nothing was asked for", () => {
    expect(safeNextPath(undefined)).toBe("/today");
    expect(safeNextPath(null)).toBe("/today");
    expect(safeNextPath("")).toBe("/today");
  });

  it("refuses to become an open redirect", () => {
    expect(safeNextPath("https://evil.example.com")).toBe("/today");
    expect(safeNextPath("//evil.example.com")).toBe("/today");
    expect(safeNextPath("javascript:alert(1)")).toBe("/today");
  });
});
