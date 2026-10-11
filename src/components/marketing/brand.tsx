import Link from "next/link";

import { KairosLogo } from "@/components/layout/kairos-logo";
import { cn } from "@/lib/utils";

/**
 * The official Kairos mark, so the marketing site reads as the same product
 * rather than a separate one.
 */
export function BrandMark({ className }: { className?: string }) {
  return <KairosLogo className={cn("h-8 w-8", className)} label={null} />;
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
