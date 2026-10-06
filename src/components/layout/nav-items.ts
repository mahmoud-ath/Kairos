"use client";

import { CircleCheckBig, ListTodo, CalendarDays } from "lucide-react";

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
 * There is no Inbox and no separate Upcoming view: every day — past, today and
 * future — is listed in All Tasks, and anything without a date shows up there as
 * "Unscheduled".
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarDays, countKey: "today" },
  { href: "/tasks", label: "All Tasks", icon: ListTodo, countKey: "all" },
  { href: "/completed", label: "Completed", icon: CircleCheckBig, countKey: "completed" },
];
