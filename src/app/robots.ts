import type { MetadataRoute } from "next";

import { SITE_INDEXABLE, SITE_URL } from "@/lib/site";

/**
 * Crawler rules.
 *
 * The views are indexable (`is-crawlable`), but the JSON API is not: it returns
 * task data and must never end up in a search index. Set `KAIROS_NO_INDEX=true`
 * to keep the whole app out of search engines.
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
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
