import type { Metadata } from "next";

import { HabitsView } from "@/components/habits/habits-view";
import { viewMetadata } from "@/lib/site";
import { getRequestContext } from "@/server/context";
import {
  ensureHabitInstances,
  getHabitBoard,
  listHabits,
} from "@/server/services/habits";
import { listCategories } from "@/server/services/taxonomy";

export const metadata: Metadata = viewMetadata({
  title: "Habits",
  description:
    "Repeating tasks Kairos generates for you each day they are due, with a monthly grid, streaks and completion history.",
  path: "/habits",
});

/**
 * The habits page: a tracker for what is repeating, and the panel that configures
 * it.
 *
 * Today's instances are generated before anything is read, so the page always
 * agrees with what Today shows. The month comes from `?month=` (clamped in the
 * service), which keeps navigation server-rendered and shareable — the same
 * pattern the statistics page uses for `?range=`.
 */
export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; range?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getRequestContext();

  await ensureHabitInstances(ctx);

  const [habits, categories] = await Promise.all([
    listHabits(ctx),
    listCategories(ctx.userId),
  ]);
  const board = await getHabitBoard(ctx, habits, {
    month: params.month,
    trendWindow: params.range ? Number(params.range) : undefined,
  });

  return (
    <HabitsView
      habits={habits}
      progress={board.progress}
      trend={board.trend}
      trendWindow={board.trendWindow}
      grid={board.grid}
      month={board.month}
      categories={categories}
      today={ctx.today}
    />
  );
}
