import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * The app views a crawler may index.
 *
 * Category pages are deliberately left out: their URLs and names come from the
 * user's own data, so they are not advertised in a public sitemap.
 */
const VIEWS: MetadataRoute.Sitemap = [
  { url: siteUrl("/today"), changeFrequency: "daily", priority: 1 },
  { url: siteUrl("/upcoming"), changeFrequency: "daily", priority: 0.8 },
  { url: siteUrl("/tasks"), changeFrequency: "daily", priority: 0.8 },
  { url: siteUrl("/completed"), changeFrequency: "weekly", priority: 0.5 },
  { url: siteUrl("/statistics"), changeFrequency: "weekly", priority: 0.5 },
  { url: siteUrl("/settings"), changeFrequency: "monthly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return VIEWS.map((view) => ({ ...view, lastModified }));
}
