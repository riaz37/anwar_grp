"use client";

import type { ReactNode } from "react";
import { SortIcon } from "./icons";
import { TH_BASE } from "./table";
import { TableHead } from "@/components/ui/primitives/table";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * Toggles ascending/descending and reports it. Kept as a hook-free helper so
 * every table shares one sorting convention: clicking a new column starts
 * ascending; clicking the active column flips direction.
 */
export function nextSort<K extends string>(
  current: SortState<K>,
  key: K,
): SortState<K> {
  if (current.key !== key) return { key, direction: "asc" };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

/**
 * `aria-sort` lives on the `<th>` (correct per ARIA), the toggle is a real
 * button inside it, and the direction arrow is decorative — the accessible name
 * already carries the state.
 *
 * The cell is shadcn/ui's `TableHead`; `TH_BASE` overrides its default height
 * and padding with DESIGN.md's denser header treatment.
 */
export function SortableHeader<K extends string>({
  columnKey,
  sort,
  onSort,
  children,
  align = "left",
  className,
}: {
  columnKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === columnKey;
  const direction = active ? sort.direction : "none";

  return (
    <TableHead
      scope="col"
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={cn(TH_BASE, align === "right" && "text-right", className)}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        /* Only the colour and the glyph change on hover, so the header row
           never shifts. `uppercase` is restated rather than inherited from
           `TH_BASE`: Tailwind's preflight resets `text-transform: none` on
           `button`, which overrides the inherited value from the `<th>`, so a
           sortable column silently rendered in sentence case next to its
           uppercase static neighbours. */
        className={cn(
          "group -mx-ds-xs inline-flex min-h-11 cursor-pointer items-center gap-ds-xs rounded-sm px-ds-xs uppercase",
          "transition-colors duration-100 ease-[var(--ease-move)]",
          "hover:bg-surface-2 hover:text-foreground active:bg-surface-2",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          active && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        {children}
        <SortIcon
          direction={direction}
          className={cn(
            "transition-colors duration-100 ease-[var(--ease-move)]",
            active
              ? "text-primary-med"
              : "text-outline-high group-hover:text-muted-foreground",
          )}
        />
      </button>
    </TableHead>
  );
}
