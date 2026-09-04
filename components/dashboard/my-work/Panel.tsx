import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Panel shell for the My Work surface.
 *
 * My Work is a queue you work *through*, so its two panels are containers with
 * a fixed internal rhythm — header rule, body, footer rule — on `surface-0`
 * over a hairline (`outline-low`) with `rounded-xl` and `shadow-e1`, per
 * DESIGN.md §4–§5. Scoped to this folder rather than shared: the working views
 * each own their own shell so one page's layout change can't ripple.
 */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        // `overflow-hidden` so a row's full-bleed hover fill is clipped by the
        // panel's own radius instead of squaring off its bottom corners.
        "flex flex-col overflow-hidden rounded-xl border border-outline-low bg-surface-0 shadow-e1",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  meta,
  children,
}: {
  title: string;
  /** Right-aligned qualifier — a count or horizon. */
  meta?: ReactNode;
  /** Controls placed on the row below the title (filters, toggles). */
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-outline-low px-ds-5xl py-ds-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-x-ds-2xl gap-y-ds-xs">
        <h2 className="min-w-0 text-title-1 font-semibold text-text-high">
          {title}
        </h2>
        {meta && (
          <p className="font-data text-caption-2 tabular-nums text-text-low">
            {meta}
          </p>
        )}
      </div>
      {children && <div className="mt-ds-2xl">{children}</div>}
    </header>
  );
}

export function PanelFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="mt-auto border-t border-outline-low px-ds-2xl py-ds-md">
      {children}
    </footer>
  );
}

/**
 * Empty state. Names what would appear here and the action that puts it there
 * — a panel that only says "Nothing" teaches a first-time reader nothing.
 */
export function PanelEmpty({
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
    <div className="flex flex-col items-start gap-ds-md px-ds-5xl py-ds-7xl">
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
