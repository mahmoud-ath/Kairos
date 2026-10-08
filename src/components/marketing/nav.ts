/**
 * Public-site navigation and links.
 *
 * Kept in a plain module rather than beside a component so both the (client)
 * header and the (server) footer can read it without either one pulling the
 * other across the client boundary.
 */

/** Anchors into the landing page itself. */
export const MARKETING_NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
] as const;

/** Taken from `git remote -v`, so it points at the real repository. */
export const REPOSITORY_URL = "https://github.com/mahmoud-ath/Kairos";

export const LICENSE_URL = "https://opensource.org/license/mit";
