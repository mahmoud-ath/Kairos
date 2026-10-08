import { afterEach, describe, expect, it, vi } from "vitest";

import {
  allowedEmails,
  AUTH_PATHS,
  isAuthPath,
  isEmailAllowed,
  isPublicPath,
  LANDING_PATH,
  PUBLIC_PATHS,
  safeNextPath,
} from "@/lib/auth-rules";

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

  it("refuses the backslash form, which browsers normalise to //host", () => {
    expect(safeNextPath("/\\evil.example.com")).toBe("/today");
  });

  it("keeps a nested path on this app", () => {
    expect(safeNextPath("/categories/abc")).toBe("/categories/abc");
    expect(safeNextPath("/settings")).toBe("/settings");
  });
});

/**
 * The access matrix the middleware applies — whether a request is served,
 * bounced to sign-in, or sent on to the workspace. Pure, so it is testable
 * without standing up Supabase.
 */
describe("isPublicPath", () => {
  it("serves the landing page to anyone, signed in or out", () => {
    expect(LANDING_PATH).toBe("/");
    expect(isPublicPath(LANDING_PATH)).toBe(true);
  });

  it("serves the routes that exist before a session does", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("serves the sign-in pages, so they cannot redirect to themselves", () => {
    for (const path of AUTH_PATHS) {
      expect(isPublicPath(path)).toBe(true);
    }
  });

  it("recognises every path it declares public", () => {
    for (const path of PUBLIC_PATHS) {
      expect(isPublicPath(path)).toBe(true);
    }
  });

  it("does not serve the workspace", () => {
    for (const path of [
      "/today",
      "/tasks",
      "/completed",
      "/categories/abc",
      "/statistics",
      "/settings",
      "/api/backup",
    ]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("fails closed for a path that does not exist", () => {
    expect(isPublicPath("/admin")).toBe(false);
    expect(isPublicPath("/whatever")).toBe(false);
  });

  it("matches exactly, so a lookalike does not inherit the exemption", () => {
    expect(isPublicPath("/api/healthy-looking")).toBe(false);
    expect(isPublicPath("/auth/callback-extra")).toBe(false);
    expect(isPublicPath("/login-help")).toBe(false);
  });

  it("ignores a trailing slash, which Next redirects anyway", () => {
    expect(isPublicPath("/api/health/")).toBe(true);
    expect(isPublicPath("/login/")).toBe(true);
    expect(isPublicPath("/today/")).toBe(false);
  });
});

describe("isAuthPath", () => {
  it("recognises exactly the sign-in pages", () => {
    expect(AUTH_PATHS).toEqual(["/login", "/register"]);
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/register")).toBe(true);
  });

  it("does not treat lookalikes as sign-in pages", () => {
    expect(isAuthPath("/registering")).toBe(false);
    expect(isAuthPath("/login-help")).toBe(false);
    expect(isAuthPath("/")).toBe(false);
  });

  it("ignores a trailing slash", () => {
    expect(isAuthPath("/login/")).toBe(true);
    expect(isAuthPath("/register/")).toBe(true);
  });
});
