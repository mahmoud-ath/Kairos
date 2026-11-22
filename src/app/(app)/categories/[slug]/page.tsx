import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkspacePage } from "@/components/tasks/workspace-page";
import { viewMetadata } from "@/lib/site";
import { requireUserId } from "@/server/auth";
import { resolveCategory } from "@/server/services/taxonomy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const userId = await requireUserId();
  const resolved = await resolveCategory(userId, slug);
  const name = resolved?.category.name ?? "Category";
  if (!resolved) return { title: name, robots: { index: false, follow: false } };

  return viewMetadata({
    title: name,
    description: `Every task in the “${name}” category of your Kairos workspace: dated groups, unscheduled work and the category's completed history.`,
    // The readable address stays canonical even when the visitor arrived on a
    // legacy `/categories/<id>` link.
    path: `/categories/${resolved.slug}`,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const userId = await requireUserId();
  // A readable slug (`work`) and an older id link both resolve to one category.
  const resolved = await resolveCategory(userId, slug);
  if (!resolved) notFound();

  return (
    <WorkspacePage
      scope={{ kind: "category", categoryId: resolved.category.id }}
      title={resolved.category.name}
      emptyTitle={`No tasks in ${resolved.category.name}`}
      emptyDescription="New tasks you add here are assigned to this category by default."
      showCategory={false}
    />
  );
}
