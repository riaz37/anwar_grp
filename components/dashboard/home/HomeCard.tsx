import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Panel shell for the Home surface.
 *
 * Home is the one view in the app that is read at a glance rather than worked
 * in, so it uses a contained panel (surface-0 on a hairline, `rounded-xl`,
 * `shadow-e1` per DESIGN.md §5) instead of the heading-rule-plus-list
 * `SectionBlock` the working views use. The panel is deliberately scoped to
 * this folder: My Work / Portfolio / Management keep the flatter treatment.
 *
 * Structure is fixed — header rule, body, optional footer rule — so every
 * panel on the page has the same internal rhythm and only its content varies.
 */
export function HomeCard({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section
      style={style}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-outline-low bg-surface-0 shadow-e1",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function HomeCardHeader({
  title,
  meta,
  icon,
  action,
}: {
  title: string;
  /** Right-aligned qualifier — a count, a horizon, a status pill. */
  meta?: ReactNode;
  /** Small leading glyph, sized by the caller to 16px. */
  icon?: ReactNode;
  /** Trailing control, placed after `meta`. */
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-ds-2xl gap-y-ds-xs border-b border-outline-low px-ds-5xl py-ds-2xl">
      <h2 className="flex min-w-0 items-center gap-ds-md text-title-1 font-semibold text-text-high">
        {icon}
        <span className="truncate">{title}</span>
      </h2>
      {(meta || action) && (
        <div className="flex shrink-0 items-center gap-ds-md">
          {meta}
          {action}
        </div>
      )}
    </header>
  );
}

/** Hairline-separated rows. Padding lives on the row so hover fills edge-to-edge. */
export function HomeCardList({ children }: { children: ReactNode }) {
  return (
    <ul className="flex-1 divide-y divide-outline-low">{children}</ul>
  );
}

/** Row shell: full-bleed hover, baseline-consistent vertical rhythm. */
export const HOME_ROW_CLASS =
  "flex items-center gap-ds-2xl px-ds-5xl py-ds-xl transition-colors duration-150 hover:bg-surface-1";

export function HomeCardFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="mt-auto border-t border-outline-low px-ds-2xl py-ds-md">
      {children}
    </footer>
  );
}

/**
 * Empty state. Names the thing that would appear here and the action that
 * puts it there — a panel that only says "None" teaches nothing to someone
 * opening the tool for the first time.
 */
export function HomeEmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-start gap-ds-md px-ds-5xl py-ds-7xl">
      {icon && (
        <span className="mb-ds-xs flex size-8 items-center justify-center rounded-md border border-dashed border-outline-med text-text-low">
          {icon}
        </span>
      )}
      <p className="text-body-2 font-semibold text-text-high">{title}</p>
      <p className="max-w-[52ch] text-pretty text-para text-muted-foreground">
        {children}
      </p>
      {action && <div className="mt-ds-xs -ml-ds-lg">{action}</div>}
    </div>
  );
}
