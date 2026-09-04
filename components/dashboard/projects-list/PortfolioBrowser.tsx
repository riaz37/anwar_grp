"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PortfolioCards } from "./PortfolioCards";
import { PortfolioTable } from "./PortfolioTable";
import { PortfolioToolbar, type HealthCount } from "./PortfolioToolbar";
import {
  EMPTY_FILTERS,
  HEALTH_FACETS,
  filterProjects,
  hasActiveFilters,
  sortProjects,
  toggleSort,
  type PortfolioFilters,
  type ProjectListItem,
  type SortKey,
  type SortState,
} from "./types";

/**
 * The portfolio browser: one page of already-loaded rows, filtered and
 * sorted on the client so a facet click is instant. If the portfolio ever
 * outgrows a single page these same controls can push to search params
 * without changing shape.
 *
 * Default sort is by expected delivery, ascending — the portfolio's first
 * question is "what lands next", not "what starts with A".
 */
export function PortfolioBrowser({
  projects,
  todayIso,
}: {
  projects: readonly ProjectListItem[];
  todayIso: string;
}) {
  const [filters, setFilters] = useState<PortfolioFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({
    key: "delivery",
    direction: "asc",
  });

  const healthCounts: HealthCount[] = useMemo(
    () =>
      HEALTH_FACETS.map((health) => ({
        health,
        count: projects.filter((project) => project.health === health).length,
      })),
    [projects],
  );

  const completedCount = useMemo(
    () => projects.filter((project) => project.currentStage === "COMPLETED").length,
    [projects],
  );

  const rows = useMemo(
    () => sortProjects(filterProjects(projects, filters), sort),
    [projects, filters, sort],
  );

  const filtered = hasActiveFilters(filters);

  function handleSort(key: SortKey) {
    setSort((current) => toggleSort(current, key));
  }

  return (
    <div className="flex flex-col gap-ds-5xl">
      <PortfolioToolbar
        filters={filters}
        onChange={setFilters}
        healthCounts={healthCounts}
        totalCount={projects.length}
        completedCount={completedCount}
      />

      <div>
        {/* The result count is the only signal that a filter did what you
            expected, so it is announced rather than left purely visual. */}
        <div className="mb-ds-md flex flex-wrap items-center gap-ds-md">
          <p aria-live="polite" className="text-caption-2 text-text-low">
            <span className="font-data tabular-nums text-text-high">
              {rows.length}
            </span>
            {rows.length === 1 ? " project" : " projects"}
            {filtered && (
              <>
                {" of "}
                <span className="font-data tabular-nums">{projects.length}</span>
              </>
            )}
          </p>
          {filtered && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="rounded-sm text-caption-2 font-semibold text-primary-high underline decoration-1 underline-offset-2 transition-colors duration-100 ease-[var(--ease-move)] hover:text-primary-med"
            >
              Reset filters
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <NoMatches
            total={projects.length}
            onReset={() => setFilters(EMPTY_FILTERS)}
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <PortfolioTable
                projects={rows}
                todayIso={todayIso}
                sort={sort}
                onSort={handleSort}
              />
            </div>
            <div className="lg:hidden">
              <PortfolioCards projects={rows} todayIso={todayIso} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NoMatches({ total, onReset }: { total: number; onReset: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-outline-med px-ds-5xl py-ds-9xl text-center">
      <p className="text-body-2 font-semibold text-text-high">
        Nothing matches these filters
      </p>
      <p className="mx-auto mt-ds-xs max-w-[48ch] text-para text-text-low">
        <span className="font-data tabular-nums">{total}</span>{" "}
        {total === 1 ? "project is" : "projects are"} in the portfolio. Widen the
        search, or clear the stage and health filters to see them all.
      </p>
      <Button variant="secondary" onClick={onReset} className="mt-ds-2xl">
        Reset filters
      </Button>
    </div>
  );
}
