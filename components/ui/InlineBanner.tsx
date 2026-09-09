"use client";

import type { ReactNode } from "react";
import { CloseIcon } from "@/components/shell/icons";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/primitives/alert";
import { Button } from "@/components/ui/primitives/button";
import { cn } from "@/lib/utils";
import { TONE_PILL, type Tone } from "./tone";

/**
 * Non-blocking inline message rendered *on the record it concerns* — the
 * treatment PROJECT_PLAN.md Sec 5 decision #4 locks in for optimistic-locking
 * conflicts, and reused for duplicate-record warnings.
 *
 * Deliberately not a modal: DESIGN.md's calm register plus the decision that a
 * conflict "doesn't block the rest of the UI". The surrounding form stays
 * interactive while the banner is shown.
 *
 * Built on shadcn/ui's `Alert`; its `variant` prop is bypassed for the same
 * reason `StatusPill` bypasses Badge's — `tone.ts` owns semantic colour.
 *
 * Announcement: callers render this *inside* a persistent `aria-live` region
 * (`LiveRegion` below) so the message is announced when it arrives rather than
 * when the region mounts.
 */
export function InlineBanner({
  tone,
  title,
  children,
  actions,
  onDismiss,
  dismissLabel = "Dismiss this message",
}: {
  tone: Exclude<Tone, "neutral" | "accent">;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  return (
    /* `role="alert"` is stripped: the wrapping `LiveRegion` already owns the
       announcement, and nesting two live roles double-announces. */
    <Alert
      role={undefined}
      className={cn(
        "grid-cols-[1fr_auto] items-start gap-ds-md rounded-xl border px-ds-md py-ds-sm",
        TONE_PILL[tone],
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200",
      )}
    >
      <div className="col-start-1 min-w-0">
        <AlertTitle className="line-clamp-none text-balance text-body-1 font-semibold">
          {title}
        </AlertTitle>
        {children && (
          <AlertDescription className="mt-ds-xxs max-w-[68ch] text-pretty text-body-1 text-current">
            {children}
          </AlertDescription>
        )}
        {actions && (
          <div className="mt-ds-sm flex flex-wrap items-center gap-ds-sm">
            {actions}
          </div>
        )}
      </div>

      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label={dismissLabel}
          /* Hover lifts to `bg-surface-1` rather than a grey wash: on a tinted
             banner the base surface reads as a clean cut-out in whichever tone
             is showing, and needs no colour-mixing to stay legible. */
          className="col-start-2 -m-ds-sm row-span-full self-start text-current opacity-70 hover:bg-surface-1 hover:opacity-100 active:bg-surface-1"
        >
          <CloseIcon aria-hidden="true" />
        </Button>
      )}
    </Alert>
  );
}

/**
 * Always-mounted polite live region. Keep one of these near the top of any form
 * or record view that can surface a banner, and render the banner into it —
 * mounting the region together with its message means most screen readers never
 * announce it (DESIGN.md > Accessibility).
 */
export function LiveRegion({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="empty:hidden">
      {children}
    </div>
  );
}
