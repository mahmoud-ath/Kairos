import type { MetadataRoute } from "next";

import { SITE_INDEXABLE, SITE_URL } from "@/lib/site";

/**
 * Crawler rules.
 *
 * The landing page and `/register` are indexable. Everything behind the sign-in
 * gate is not: the workspace views redirect a signed-out visitor to `/login`, so
 * indexing them would produce nothing but redirects, and the JSON API returns
 * task data.
 *
 * Set `KAIROS_NO_INDEX=true` to keep the whole site out of search engines.
 */
export default function robots(): MetadataRoute.Robots {
  if (!SITE_INDEXABLE) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Returns task data.
          "/api/",
          // Sign-in is not a destination; `/register` is the one we want found.
          "/login",
          "/auth/",
          // Private workspace views.
          "/today",
          "/tasks",
          "/completed",
          "/categories",
          "/statistics",
          "/settings",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
