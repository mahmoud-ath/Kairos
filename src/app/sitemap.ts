import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * The pages a crawler may index: the landing page, and nothing else.
 *
 * The workspace views are deliberately absent. They belong to whoever is signed
 * in, so there is no public URL to advertise: a crawler following one would only
 * collect a redirect to `/login` — exactly the indexing the `noindex` in
 * `(app)/layout.tsx` prevents. `/register` is left out too, so the sitemap
 * matches what this deployment actually publishes: one marketing page.
 *
 * No `lastModified` on purpose. It can only be "whenever this function ran", and
 * a `<lastmod>` that changes on every request is a signal crawlers learn to
 * ignore — worse than saying nothing and letting them decide for themselves.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl("/"), changeFrequency: "weekly", priority: 1 }];
}
