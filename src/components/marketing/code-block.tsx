"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A read-only terminal snippet with a copy button.
 *
 * The only interactive part of the self-hosting page, so it is a Client
 * Component; everything around it stays static. The text remains selectable, so
 * the button is a convenience rather than the only way to get the commands.
 */
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  /** Small caption above the snippet, e.g. "Terminal". */
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (insecure context, or a denied prompt).
      // The snippet is still on screen and selectable, so there is nothing to
      // report — the old "copied" state would be a lie either way.
    }
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border bg-muted/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">{label ?? "Terminal"}</span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-foreground">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
