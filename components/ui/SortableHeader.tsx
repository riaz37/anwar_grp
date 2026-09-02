"use client";

import type { ReactNode } from "react";
import { SortIcon } from "./icons";
import { TH_BASE } from "./table";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

/**
 * Toggles ascending/descending and reports it. Kept as a hook-free helper so
 * both tables share one sorting convention: clicking a new column starts
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
 * button inside it, and the direction arrow is decorative — the accessible
 * name already carries the state.
 */
export function SortableHeader<K extends string>({
  columnKey,
  sort,
  onSort,
  children,
  align = "left",
  className = "",
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
    <th
      scope="col"
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={`${TH_BASE} ${align === "right" ? "text-right" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={`-mx-xs inline-flex min-h-11 items-center gap-xs rounded-sm px-xs transition-colors duration-100 ease-move hover:text-text ${
          active ? "text-text" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {children}
        <SortIcon
          direction={direction}
          className={active ? "text-accent" : "text-border-strong"}
        />
      </button>
    </th>
  );
}
