/**
 * Lucide icons offered for categories, and the name → component map.
 *
 * Categories store the icon *name* (a plain string in the database) rather than
 * a component, so the catalogue can grow without a migration. Anything unknown
 * falls back to `Folder`, which also keeps old backups importable.
 *
 * Import from here (never `lucide-react` directly for category icons) so the
 * whole set stays in one place and `optimizePackageImports` can tree-shake it.
 */

import {
  Bell,
  BookOpen,
  Bookmark,
  Briefcase,
  Bug,
  Calendar,
  Camera,
  Car,
  Cloud,
  Code,
  Coffee,
  Compass,
  Cpu,
  CreditCard,
  Dumbbell,
  Feather,
  Film,
  Flame,
  Flag,
  Folder,
  Gift,
  Globe,
  GraduationCap,
  Handshake,
  Heart,
  Home,
  Key,
  Laptop,
  Leaf,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Music,
  Palette,
  PartyPopper,
  PenTool,
  Phone,
  PiggyBank,
  Plane,
  Rocket,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Stethoscope,
  Target,
  Timer,
  Trash2,
  Trophy,
  Umbrella,
  Users,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Name → component. The keys are what gets stored in `Category.icon`. */
export const CATEGORY_ICONS = {
  Folder,
  Briefcase,
  Home,
  Heart,
  Star,
  Zap,
  Sparkles,
  Rocket,
  Target,
  Trophy,
  Flame,
  Leaf,
  Lightbulb,
  BookOpen,
  GraduationCap,
  Feather,
  PenTool,
  Palette,
  Music,
  Camera,
  Film,
  Mic,
  Dumbbell,
  Stethoscope,
  ShoppingCart,
  Coffee,
  PiggyBank,
  Wallet,
  CreditCard,
  Gift,
  PartyPopper,
  Users,
  Handshake,
  MessageCircle,
  Phone,
  Mail,
  Calendar,
  Timer,
  MapPin,
  Plane,
  Car,
  Umbrella,
  Globe,
  Compass,
  Code,
  Cpu,
  Laptop,
  Bug,
  Cloud,
  Bell,
  Bookmark,
  Flag,
  Shield,
  Lock,
  Key,
  Wrench,
  Trash2,
} as const satisfies Record<string, LucideIcon>;

export type CategoryIconName = keyof typeof CATEGORY_ICONS;

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS) as CategoryIconName[];

export const DEFAULT_CATEGORY_ICON: CategoryIconName = "Folder";

/** Resolve a stored name to a component; unknown/absent names become `Folder`. */
export function categoryIcon(name: string | null | undefined): LucideIcon {
  if (name && name in CATEGORY_ICONS) {
    return CATEGORY_ICONS[name as CategoryIconName];
  }
  return Folder;
}

export function isCategoryIconName(value: unknown): value is CategoryIconName {
  return typeof value === "string" && value in CATEGORY_ICONS;
}
