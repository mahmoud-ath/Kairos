import type { Metadata } from "next";

/**
 * Canonical URL of this deployment.
 *
 * Kairos is self-hosted, so the domain is not known at build time: it comes from
 * the environment. The fallback matches the default Compose port so a fresh
 * checkout still produces valid absolute URLs for canonical links and the
 * sitemap.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export const SITE_NAME = "Kairos";

export const SITE_DESCRIPTION =
  "Kairos is an open-source, self-hosted task manager and habit tracker that organises work by category and date, with subtasks, drag and drop, a month grid for habits, statistics, an optional daily reminder and JSON backups.";

/**
 * Private deployments can opt out of search engines entirely with
 * `KAIROS_NO_INDEX=true` (see the README) — the default is to be indexable.
 *
 * Vercel preview builds are a special case: they are copies of a site that is
 * already public, so indexing them would only produce duplicate content under a
 * `*.vercel.app` hostname. On Vercel, a deployment that is not the production one
 * is therefore never indexable, whether or not the flag was set.
 */
export const SITE_INDEXABLE =
  process.env.KAIROS_NO_INDEX !== "true" &&
  (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production");

/**
 * Google Search Console ownership token.
 *
 * Rendered as `<meta name="google-site-verification" content="…">` in the root
 * layout. The token is public by nature — its only job is to prove that whoever
 * uploaded it controls this origin — so it is safe to keep as the default and
 * let another deployment override it with its own property.
 */
export const GOOGLE_SITE_VERIFICATION =
  process.env.GOOGLE_SITE_VERIFICATION?.trim() ||
  "ISK5XSX5hKWLgZjw4C4itBoKw7koWZI82Zaz6m5O5Nw";

/** Absolute URL for a path inside the app. */
export function siteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The social card, as metadata.
 *
 * `src/app/opengraph-image.tsx` satisfies every route that does not declare an
 * `openGraph` object of its own — but `/` does, because it needs its own title,
 * and Next merges metadata per field rather than in depth: a page that sets
 * `openGraph` replaces the inherited object, images included. So the card is
 * named here too, or the landing page — the only page this deployment
 * publishes — would be the one page without one.
 */
export const SOCIAL_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Kairos — organise your tasks, focus on what matters",
} as const;

/**
 * Metadata every view shares, so a page only has to state what makes it unique:
 * its title, its description and its path.
 */
export function viewMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const fullTitle = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: path,
      locale: "en_US",
    },
    twitter: { card: "summary", title: fullTitle, description },
  };
}
