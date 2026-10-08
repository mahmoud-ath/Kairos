import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The Kairos mark — the same green "K" tile the app and the auth pages use, so
 * the marketing site reads as the same product rather than a separate one.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground",
        className,
      )}
    >
      K
    </span>
  );
}

/** The mark plus the wordmark, linking back to the top of the landing page. */
export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-sm font-semibold tracking-tight">Kairos</span>
    </Link>
  );
}
