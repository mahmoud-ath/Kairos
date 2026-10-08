import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * The pages a crawler may index.
 *
 * Only the public site is listed. The workspace views are deliberately absent:
 * they require a session, so a crawler following them would only collect a
 * redirect to `/login`, and listing a private URL in a public sitemap invites
 * exactly the indexing the `noindex` in `(app)/layout.tsx` prevents.
 */
const VIEWS: MetadataRoute.Sitemap = [
  { url: siteUrl("/"), changeFrequency: "weekly", priority: 1 },
  { url: siteUrl("/register"), changeFrequency: "monthly", priority: 0.9 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return VIEWS.map((view) => ({ ...view, lastModified }));
}
