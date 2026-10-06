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
  "Kairos is an open-source, self-hosted task manager that organises work by category and date, with subtasks, drag and drop, statistics and JSON backups.";

/**
 * Private deployments can opt out of search engines entirely with
 * `KAIROS_NO_INDEX=true` (see the README) — the default is to be indexable.
 */
export const SITE_INDEXABLE = process.env.KAIROS_NO_INDEX !== "true";

/** Absolute URL for a path inside the app. */
export function siteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

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
