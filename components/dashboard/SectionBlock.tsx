import type { ReactNode } from "react";
import { formatDate } from "@/lib/format";

/**
 * Overview-surface building blocks, shared by Home, My Work, and the
 * Management Dashboard so the three read as one product.
 *
 * Sections are a heading rule plus a list — not a card. DESIGN.md's decoration
 * level is "minimal — typography and spacing do the work", and four bordered
 * boxes of near-identical size is the layout that makes an ops dashboard look
 * generated rather than designed. Elevation is reserved for the one thing on a
 * page that genuinely sits above the rest.
 */
export function SectionBlock({
  title,
  meta,
  footer,
  className = "",
  children,
}: {
  title: string;
  /** Right-aligned count or qualifier on the heading rule. */
  meta?: ReactNode;
  /** A single onward link, sitting under the list rather than floating. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-ds-2xl gap-y-ds-xxs border-b border-border pb-ds-xs">
        <h2 className="text-heading-1 text-text-high">{title}</h2>
        {meta && (
          <p className="font-data text-body-1 tabular-nums text-muted-foreground">
            {meta}
          </p>
        )}
      </div>

      <div className="mt-ds-2xl">{children}</div>

      {footer && <div className="mt-ds-2xl">{footer}</div>}
    </section>
  );
}

/**
 * Empty state. Says what would appear here and how it gets here — an empty
 * panel that only says "None" teaches nothing to someone seeing the tool for
 * the first time. Dashed rule so it never reads as a real record.
 */
export function EmptyNote({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-border px-ds-2xl py-ds-2xl">
      <p className="max-w-[56ch] text-pretty text-body-1 text-muted-foreground">
        {children}
      </p>
      {action && <div className="mt-ds-md">{action}</div>}
    </div>
  );
}

/** Row shell for the overview lists — one hairline between items, no boxes. */
export const ROW_CLASS =
  "flex flex-wrap items-baseline gap-x-ds-md gap-y-ds-xxs border-b border-border py-ds-md text-body-1 last:border-0";

/**
 * Thin proportional bar under a list row: near-full at "due now"/overdue,
 * shrinking the further out a date sits. Makes "due tomorrow" and "due in six
 * weeks" distinguishable at a glance, without reading either date — the same
 * technique `RecentActivity` in the reference dashboard uses for call length.
 */
export function UrgencyBar({
  daysUntilDue,
  overdue = false,
  /** Days out at which the bar reaches its minimum width. */
  horizon = 21,
}: {
  daysUntilDue: number;
  overdue?: boolean;
  horizon?: number;
}) {
  const ratio = overdue ? 1 : Math.max(0, 1 - daysUntilDue / horizon);
  const width = Math.max(6, Math.min(100, ratio * 100));
  return (
    <div
      aria-hidden="true"
      className={`mt-ds-xs h-[2px] ${overdue ? "bg-danger-med" : "bg-primary-wash"}`}
      style={{ width: `${width}%` }}
    />
  );
}

/**
 * A date a reader is meant to compare against other dates: tabular figures in
 * the data face, and a real `<time>` element so the machine-readable value
 * survives copy-paste into a calendar or a screen reader.
 */
export function DueDate({
  iso,
  className = "text-muted-foreground",
}: {
  /** ISO-8601 date or timestamp. */
  iso: string;
  className?: string;
}) {
  const day = iso.slice(0, 10);
  return (
    <time dateTime={day} className={`font-data tabular-nums ${className}`}>
      {formatDate(day)}
    </time>
  );
}
