import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Chrome for the single-project workspace.
 *
 * The workspace is a *dossier*, not a dashboard: one record read closely, with
 * a fixed rail of facts beside a working area. So the shapes here are flat —
 * an eyebrow, a heading, a hairline, then content — rather than the contained
 * panels Home uses. Nothing is nested inside a card twice, and the only filled
 * surfaces are the ones you can act on (forms, open blockers).
 *
 * Scoped to this folder on purpose: the portfolio, my-work, and management
 * surfaces keep their own chrome.
 */

/** Section shell: eyebrow + title + hairline + body. */
export function Block({
  id,
  eyebrow,
  title,
  count,
  description,
  action,
  children,
}: {
  /** Used to wire `aria-labelledby`; the heading gets `${id}-title`. */
  id: string;
  eyebrow?: string;
  title: string;
  /** Rendered beside the title in the mono numeral face when non-zero. */
  count?: number;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-x-ds-2xl gap-y-ds-md border-b border-outline-low pb-ds-lg">
        <div className="min-w-0">
          {eyebrow && <span className="annotation block">{eyebrow}</span>}
          <h2
            id={`${id}-title`}
            className="mt-ds-xxs flex items-baseline gap-ds-md text-heading-1 font-semibold text-text-high"
          >
            {title}
            {typeof count === "number" && count > 0 && (
              <span className="font-data text-body-1 font-normal tabular-nums text-text-low">
                {count}
              </span>
            )}
          </h2>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {description && (
        <p className="mt-ds-xl max-w-[64ch] text-pretty text-para text-muted-foreground">
          {description}
        </p>
      )}
      <div className="mt-ds-5xl">{children}</div>
    </section>
  );
}

/** Sub-heading inside a `Block`, for a second grouping under one title. */
export function Subhead({
  children,
  count,
}: {
  children: ReactNode;
  count?: number;
}) {
  return (
    <h3 className="annotation flex items-baseline gap-ds-sm">
      {children}
      {typeof count === "number" && (
        <span className="font-data tabular-nums normal-case tracking-normal">
          {count}
        </span>
      )}
    </h3>
  );
}

/**
 * Record row. A hairline-separated list, not a stack of little cards: these
 * rows are scanned as a column of facts, and a border on all four sides of
 * each one would fight that reading.
 */
export const ROW =
  "group/row relative flex flex-wrap items-center gap-x-ds-2xl gap-y-ds-md " +
  "px-ds-md py-ds-xl text-body-1 transition-colors duration-100 " +
  "hover:bg-surface-1 focus-within:bg-surface-1";

/**
 * Block-shaped row, for entries whose content stacks (a log entry with a
 * title, a body, and an attribution line) rather than sitting on one line.
 */
export const LOG_ROW =
  "px-ds-md py-ds-2xl text-body-1 transition-colors duration-100 " +
  "hover:bg-surface-1 focus-within:bg-surface-1";

export function RowList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "-mx-ds-md divide-y divide-outline-low border-y border-outline-low",
        className,
      )}
    >
      {children}
    </ul>
  );
}

/** Ordered variant of `RowList`, for logs where sequence is the point. */
export function LogList({ children }: { children: ReactNode }) {
  return (
    <ol className="-mx-ds-md divide-y divide-outline-low border-y border-outline-low">
      {children}
    </ol>
  );
}

/**
 * Empty state. It teaches the rule the section enforces and names the move
 * that fills it — "Nothing here" would tell a first-time owner nothing about
 * why the section exists.
 */
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-ds-md border-y border-outline-low py-ds-9xl">
      <p className="text-body-2 font-semibold text-text-high">{title}</p>
      <p className="max-w-[58ch] text-pretty text-para text-muted-foreground">
        {children}
      </p>
      {action && <div className="mt-ds-xs">{action}</div>}
    </div>
  );
}

/**
 * Inline form surface. Raised one step off the page and marked with an accent
 * edge so it reads as "this is the thing you are filling in now", without
 * becoming a modal that hides the record it belongs to.
 */
export function FormPanel({
  children,
  tone = "accent",
  onSubmit,
  className,
}: {
  children: ReactNode;
  tone?: "accent" | "warning";
  onSubmit: (event: React.FormEvent) => void;
  className?: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "flex max-w-[36rem] flex-col gap-ds-2xl rounded-xl border border-outline-low bg-surface-1 p-ds-5xl shadow-e1",
        "border-t-2",
        tone === "accent" ? "border-t-primary-med" : "border-t-warn-med",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200",
        className,
      )}
    >
      {children}
    </form>
  );
}

/** Right-aligned action row for a `FormPanel`. */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-ds-md pt-ds-xs">
      {children}
    </div>
  );
}

/** Numeral run inside prose — every figure compared to another is mono. */
export function Num({ children }: { children: ReactNode }) {
  return <span className="font-data tabular-nums">{children}</span>;
}

/** Monogram for a named person. Initials only; no photo store exists. */
export function Monogram({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-surface-3 text-caption-2 font-semibold text-text-med"
    >
      {initials}
    </span>
  );
}
