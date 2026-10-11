import { categoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

/**
 * A category's Lucide icon, tinted with the category's colour.
 *
 * Deliberately has no hooks, so it can render inside both Server and Client
 * Components (the sidebar is a client tree, the settings page is not).
 */
export function CategoryGlyph({
  icon,
  color,
  className,
}: {
  icon: string;
  color?: string;
  className?: string;
}) {
  const Icon = categoryIcon(icon);
  return (
    <Icon
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
      style={color ? { color } : undefined}
    />
  );
}
