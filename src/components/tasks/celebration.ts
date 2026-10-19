"use client";

import { toast } from "sonner";

import { completionMessage, type CompletionKind } from "@/lib/celebrate";

/**
 * The little "well done" that appears when something is finished.
 *
 * Deliberately one function rather than a `toast.success` at each call site: the
 * wording, the duration and the motion live in one place, so every completion —
 * a row, a subtask, a habit day — feels like the same product.
 *
 * Callers must fire this **after** the server accepted the change. Celebrating an
 * optimistic patch would be a lie the rollback then contradicts.
 */
export function celebrateCompletion(kind: CompletionKind, title: string): void {
  const message = completionMessage(kind, title);
  toast.success(message.title, {
    description: message.description,
    duration: 2600,
    // Defined in globals.css; the global prefers-reduced-motion rule neutralises
    // the animation for anybody who asked for less motion.
    className: "animate-pop-in",
  });
}
