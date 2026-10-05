"use client";

import { CircleCheckBig, ListTodo, CalendarDays, CalendarRange } from "lucide-react";

import type { ViewCounts } from "@/lib/views";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof ListTodo;
  countKey: Exclude<keyof ViewCounts, "byCategory">;
};

/**
 * Sidebar navigation.
 *
 * There is no Inbox: anything without a date shows up as "Unscheduled" in All
 * Tasks, which is also where past days are listed.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarDays, countKey: "today" },
  { href: "/upcoming", label: "Upcoming", icon: CalendarRange, countKey: "upcoming" },
  { href: "/tasks", label: "All Tasks", icon: ListTodo, countKey: "all" },
  { href: "/completed", label: "Completed", icon: CircleCheckBig, countKey: "completed" },
];
