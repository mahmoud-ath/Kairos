import { afterEach, describe, expect, it, vi } from "vitest";

import { allowedEmails, isEmailAllowed } from "@/lib/auth-rules";

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
