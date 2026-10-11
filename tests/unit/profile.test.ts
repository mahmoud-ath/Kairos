import { describe, expect, it } from "vitest";

import { displayName, initialsFor } from "@/lib/profile";

describe("displayName", () => {
  it("prefers a chosen nickname", () => {
    expect(displayName("Boss", "ada@example.com")).toBe("Boss");
  });

  it("trims and ignores a blank nickname", () => {
    expect(displayName("   ", "ada@example.com")).toBe("Ada");
    expect(displayName("", null)).toBe("Chief");
  });

  it("derives a name from the email when there is no nickname", () => {
    expect(displayName(null, "ada.lovelace@example.com")).toBe("Ada");
    expect(displayName(undefined, "grace_hopper@example.com")).toBe("Grace");
    expect(displayName(null, "linus+work@example.com")).toBe("Linus");
  });

  it("falls back to the friendly default", () => {
    expect(displayName(null, null)).toBe("Chief");
    expect(displayName(null, "@example.com")).toBe("Chief");
  });
});

describe("initialsFor", () => {
  it("uses two letters of a single name", () => {
    expect(initialsFor("Boss", null)).toBe("BO");
  });

  it("uses the first letter of the first two words", () => {
    expect(initialsFor("Ada Lovelace", null)).toBe("AL");
    expect(initialsFor(null, "grace.hopper@example.com")).toBe("GH");
  });

  it("falls back to the brand mark", () => {
    expect(initialsFor(null, null)).toBe("K");
  });
});
