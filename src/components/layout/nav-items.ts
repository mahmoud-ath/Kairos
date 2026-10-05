"use client";

import { CircleCheckBig, Inbox, ListTodo, CalendarDays, CalendarRange } from "lucide-react";

import type { ViewCounts } from "@/lib/views";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Inbox;
  countKey: Exclude<keyof ViewCounts, "byCategory">;
  /** Views whose counts can be zero without being hidden. */
  alwaysShow?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox, countKey: "inbox", alwaysShow: true },
  { href: "/today", label: "Today", icon: CalendarDays, countKey: "today", alwaysShow: true },
  {
    href: "/upcoming",
    label: "Upcoming",
    icon: CalendarRange,
    countKey: "upcoming",
    alwaysShow: true,
  },
  { href: "/tasks", label: "All Tasks", icon: ListTodo, countKey: "all", alwaysShow: true },
  {
    href: "/completed",
    label: "Completed",
    icon: CircleCheckBig,
    countKey: "completed",
  },
];
