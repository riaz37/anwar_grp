"use client";

import type { ReactNode } from "react";
import { CloseIcon } from "@/components/shell/icons";
import { TONE_PILL, type Tone } from "./tone";

/**
 * Non-blocking inline message rendered *on the record it concerns* — the
 * treatment BUILD_PLAN.md Sec 5 decision #4 locks in for optimistic-locking
 * conflicts, and reused for the duplicate-candidate warning (spec Sec 4,
 * "Duplicate-candidate warnings").
 *
 * Deliberately not a modal: DESIGN.md's calm register plus the decision that
 * a conflict "doesn't block the rest of the UI". The surrounding form stays
 * interactive while the banner is shown.
 *
 * Announcement: callers render this *inside* a persistent `aria-live` region
 * (see `LiveRegion` below) so the message is announced when it arrives rather
 * than when the region mounts.
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
    /* No `role="status"` here: the wrapping `LiveRegion` already owns the
       announcement, and nesting two live roles double-announces. */
    <div
      className={`flex items-start gap-md rounded-md border px-md py-sm ${TONE_PILL[tone]} motion-safe:animate-[fade-in_200ms_var(--ease-enter)]`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold">{title}</p>
        {children && (
          <div className="mt-2xs max-w-[68ch] text-body-sm">{children}</div>
        )}
        {actions && (
          <div className="mt-sm flex flex-wrap items-center gap-sm">
            {actions}
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="-m-sm inline-flex size-11 shrink-0 items-center justify-center rounded-sm opacity-70 transition-opacity duration-100 ease-move hover:opacity-100"
        >
          <CloseIcon aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/**
 * Always-mounted polite live region. Keep one of these near the top of any
 * form or record view that can surface a banner, and render the banner into
 * it — mounting the region together with its message means most screen
 * readers never announce it (DESIGN.md > Accessibility).
 */
export function LiveRegion({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="empty:hidden">
      {children}
    </div>
  );
}
