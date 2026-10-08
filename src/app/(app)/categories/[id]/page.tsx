import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkspacePage } from "@/components/tasks/workspace-page";
import { viewMetadata } from "@/lib/site";
import { requireUserId } from "@/server/auth";
import { getCategory } from "@/server/services/taxonomy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const userId = await requireUserId();
  const category = await getCategory(userId, id);
  const name = category?.name ?? "Category";
  if (!category) return { title: name, robots: { index: false, follow: false } };

  return viewMetadata({
    title: name,
    description: `Overdue, today, upcoming and unscheduled tasks in the “${name}” category of your Kairos workspace.`,
    // Category pages are the user's own data: reachable, but never listed.
    path: `/categories/${id}`,
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const category = await getCategory(userId, id);
  if (!category) notFound();

  return (
    <WorkspacePage
      scope={{ kind: "category", categoryId: category.id }}
      title={category.name}
      subtitle="Overdue, today, upcoming and unscheduled work in this category."
      emptyTitle={`No tasks in ${category.name}`}
      emptyDescription="New tasks you add here are assigned to this category by default."
      showCategory={false}
    />
  );
}
