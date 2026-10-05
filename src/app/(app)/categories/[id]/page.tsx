import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkspacePage } from "@/components/tasks/workspace-page";
import { getCategory } from "@/server/services/taxonomy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const category = await getCategory(id);
  return { title: category?.name ?? "Category" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getCategory(id);
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
