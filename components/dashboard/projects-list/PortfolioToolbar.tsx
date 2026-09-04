"use client";

import { useId } from "react";
import type { ProjectHealth } from "@prisma/client";
import { CloseIcon } from "@/components/shell/icons";
import { SearchIcon } from "@/components/ui/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import {
  HEALTH_LABELS,
  HEALTH_TONE,
  STAGE_LABELS,
  STAGE_ORDER,
} from "@/components/projects/projectTone";
import { TONE_DOT } from "@/components/ui/tone";
import { cn } from "@/lib/utils";
import type { PortfolioFilters } from "./types";

/** Radix reserves `value=""` for "nothing selected", so the all-option needs
 *  a real token of its own. */
const ALL = "__all__";

export interface HealthCount {
  health: ProjectHealth;
  count: number;
}

export function PortfolioToolbar({
  filters,
  onChange,
  healthCounts,
  totalCount,
  completedCount,
}: {
  filters: PortfolioFilters;
  onChange: (next: PortfolioFilters) => void;
  healthCounts: readonly HealthCount[];
  totalCount: number;
  completedCount: number;
}) {
  const searchId = useId();
  const stageId = useId();

  function set<K extends keyof PortfolioFilters>(
    key: K,
    value: PortfolioFilters[K],
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <section aria-label="Filter the portfolio" className="flex flex-col gap-ds-2xl">
      <div className="flex flex-wrap items-center gap-ds-md">
        <div className="relative min-w-0 flex-1 sm:max-w-96">
          <label htmlFor={searchId} className="sr-only">
            Search projects
          </label>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute left-ds-xl top-1/2 size-4 -translate-y-1/2 text-text-low"
          />
          <input
            id={searchId}
            /* Plain `text`, not `search`: WebKit's built-in clear control is
               unstyleable and absent in Firefox, so the button below is the
               one consistent affordance. */
            type="text"
            role="searchbox"
            value={filters.query}
            placeholder="Project, owner, unit…"
            onChange={(event) => set("query", event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && filters.query !== "") {
                event.preventDefault();
                set("query", "");
              }
            }}
            className="h-9 w-full rounded-md border border-outline-low bg-surface-2 pl-[38px] pr-11 text-body-2 text-text-high shadow-input-inner outline-none transition-[border-color,box-shadow] duration-100 ease-[var(--ease-move)] placeholder:text-text-low hover:border-outline-high focus-visible:border-primary-med focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-wash"
          />
          {filters.query !== "" && (
            <button
              type="button"
              onClick={() => set("query", "")}
              aria-label="Clear search"
              className="absolute right-ds-xs top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-text-low transition-colors duration-100 ease-[var(--ease-move)] hover:bg-surface-3 hover:text-text-high"
            >
              <CloseIcon aria-hidden className="size-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-ds-sm">
          <label htmlFor={stageId} className="annotation whitespace-nowrap">
            Stage
          </label>
          <Select
            value={filters.stage === "" ? ALL : filters.stage}
            onValueChange={(next) =>
              set("stage", next === ALL ? "" : (next as PortfolioFilters["stage"]))
            }
          >
            <SelectTrigger id={stageId} aria-label="Filter by stage">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All stages</SelectItem>
              {STAGE_ORDER.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {STAGE_LABELS[stage]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {completedCount > 0 && (
          <button
            type="button"
            aria-pressed={filters.hideCompleted}
            onClick={() => set("hideCompleted", !filters.hideCompleted)}
            className={cn(
              "h-9 shrink-0 rounded-md border px-ds-xl text-caption-2 font-semibold transition-colors duration-100 ease-[var(--ease-move)]",
              filters.hideCompleted
                ? "border-primary-wash bg-primary-wash text-primary-high"
                : "border-outline-low text-text-med hover:border-outline-high hover:text-text-high",
            )}
          >
            Hide completed
            <span className="ml-ds-sm font-data tabular-nums font-medium opacity-70">
              {completedCount}
            </span>
          </button>
        )}
      </div>

      {/* Health as facets rather than another dropdown: the distribution is
          itself the answer management wants, and each count is the fastest
          route into the subset it describes. */}
      <div className="flex flex-wrap items-center gap-ds-xs">
        <FacetChip
          label="All"
          count={totalCount}
          selected={filters.health === ""}
          onSelect={() => set("health", "")}
        />
        {healthCounts.map(({ health, count }) => (
          <FacetChip
            key={health}
            label={HEALTH_LABELS[health]}
            count={count}
            dotClass={TONE_DOT[HEALTH_TONE[health]]}
            selected={filters.health === health}
            onSelect={() => set("health", filters.health === health ? "" : health)}
          />
        ))}
      </div>
    </section>
  );
}

function FacetChip({
  label,
  count,
  dotClass,
  selected,
  onSelect,
}: {
  label: string;
  count: number;
  dotClass?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      disabled={count === 0 && !selected}
      className={cn(
        "inline-flex h-8 items-center gap-ds-sm rounded-pill border px-ds-xl text-caption-2 font-semibold transition-colors duration-100 ease-[var(--ease-move)]",
        selected
          ? "border-outline-high bg-surface-3 text-text-high"
          : "border-transparent text-text-med hover:bg-surface-2 hover:text-text-high",
        count === 0 && !selected && "opacity-40",
      )}
    >
      {dotClass && (
        <span aria-hidden className={cn("size-1.5 rounded-full", dotClass)} />
      )}
      {label}
      <span className="font-data tabular-nums font-medium text-text-low">
        {count}
      </span>
    </button>
  );
}
