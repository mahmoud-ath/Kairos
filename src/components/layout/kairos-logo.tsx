import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * The official Kairos mark.
 *
 * The artwork ships as flat black and flat white, so both are rendered and CSS
 * shows whichever contrasts with the active theme (the dark surfaces are the
 * only place the white one is visible). Unoptimised on purpose: the image
 * optimiser refuses SVG.
 *
 * Sizing comes from `className`; the mark is square, so `h-* w-*` is enough.
 */
export function KairosLogo({
  className,
  label = "Kairos",
}: {
  className?: string;
  /** Accessible name; pass `null` when an adjacent label already says it. */
  label?: string | null;
}) {
  return (
    <span
      role="img"
      aria-label={label ?? undefined}
      aria-hidden={label === null ? true : undefined}
      className={cn("relative inline-block h-7 w-7 shrink-0", className)}
    >
      <Image
        src="/kairos-logo/kairos-black.svg"
        alt=""
        fill
        unoptimized
        sizes="96px"
        className="object-contain dark:hidden"
      />
      <Image
        src="/kairos-logo/kairos-white.svg"
        alt=""
        fill
        unoptimized
        sizes="96px"
        className="hidden object-contain dark:block"
      />
    </span>
  );
}
