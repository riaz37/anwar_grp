import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Portfolio-overview panel: the one container shape the Management Dashboard
 * uses. A `surface-1` card on the black shell, hairline `outline-low` border,
 * `rounded-xl` per DESIGN.md §4 (cards), `shadow-e1` per §5.
 *
 * The header rule is part of the panel rather than floating above it, so a
 * chart panel and a list panel line up on the same baseline when they sit
 * side by side in the grid.
 *
 * Scoped to `app/(dashboard)/dashboard` — Home and My Work have their own
 * section chrome; sharing one abstraction across all three is what previously
 * forced every page into the same rhythm.
 */
export function Panel({
  title,
  description,
  meta,
  action,
  /** Set false for list panels whose rows carry their own horizontal padding. */
  padded = true,
  className,
  children,
}: {
  title: string;
  description?: string;
  /** Right-aligned count or qualifier, set in the data face. */
  meta?: ReactNode;
  /** A single onward link, sitting on the header rule. */
  action?: ReactNode;
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-outline-low bg-surface-1 shadow-e1",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-ds-2xl gap-y-ds-xs border-b border-outline-low px-ds-5xl py-ds-2xl">
        <div className="min-w-0">
          <h2 className="text-title-1 font-semibold text-text-high">{title}</h2>
          {description && (
            <p className="mt-ds-xxs text-para text-text-low">{description}</p>
          )}
        </div>
        {(meta || action) && (
          <div className="flex shrink-0 items-center gap-ds-2xl">
            {meta && (
              <span className="font-data text-caption-2 tabular-nums text-text-low">
                {meta}
              </span>
            )}
            {action}
          </div>
        )}
      </header>

      <div className={cn("flex-1", padded && "p-ds-5xl")}>{children}</div>
    </section>
  );
}

/**
 * Empty state. Says what would appear here and what puts it there — a panel
 * that only says "None" teaches nothing to someone opening the tool for the
 * first time.
 */
export function PanelEmpty({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "max-w-[52ch] text-pretty text-para text-text-low",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Empty state for a zero-padding list panel, which has no inset of its own. */
export function ListEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="px-ds-5xl py-ds-7xl">
      <PanelEmpty>{children}</PanelEmpty>
    </div>
  );
}

/** Row shell for the list panels: full-bleed hover, hairline between items. */
export const LIST_ROW =
  "flex items-center gap-ds-2xl border-b border-outline-base px-ds-5xl py-ds-xl last:border-b-0 transition-colors duration-100 hover:bg-surface-2";
