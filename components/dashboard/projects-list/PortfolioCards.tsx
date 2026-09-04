"use client";

import Link from "next/link";
import { Pill } from "@/components/ui/StatusPill";
import { HEALTH_LABELS, HEALTH_TONE } from "@/components/projects/projectTone";
import { DeliveryReadout, PeopleStack, StageMeter } from "./pieces";
import type { ProjectListItem } from "./types";

/**
 * Below the table breakpoint the portfolio is re-cut, not shrunk: each
 * project becomes one tappable record with the same five facts stacked in
 * reading order, since a five-column grid at 380px is a scroll bar, not a
 * table.
 */
export function PortfolioCards({
  projects,
  todayIso,
}: {
  projects: readonly ProjectListItem[];
  todayIso: string;
}) {
  return (
    <ul className="divide-y divide-outline-base overflow-hidden rounded-xl border border-outline-low bg-surface-0">
      {projects.map((project) => (
        <li key={project.id} className="relative">
          <div className="flex flex-col gap-ds-2xl p-ds-5xl transition-colors duration-100 ease-[var(--ease-move)] hover:bg-surface-1 focus-within:bg-surface-1">
            <div className="flex items-start justify-between gap-ds-2xl">
              <div className="min-w-0">
                <Link
                  href={`/projects/${project.id}`}
                  /* Stretched over the whole row: on touch the entire record
                     is the target, while the accessible name stays the
                     project title alone. */
                  className="text-title-1 font-semibold text-text-high after:absolute after:inset-0 after:content-['']"
                >
                  {project.name}
                </Link>
                <p className="mt-ds-xxs truncate text-caption-2 text-text-low">
                  {project.businessUnitName}
                  <span aria-hidden className="mx-ds-xs text-outline-high">
                    /
                  </span>
                  {project.departmentName}
                </p>
              </div>
              <Pill
                tone={HEALTH_TONE[project.health]}
                label={HEALTH_LABELS[project.health]}
              />
            </div>

            <StageMeter stage={project.currentStage} />

            <div className="flex flex-wrap items-end justify-between gap-ds-2xl">
              <PeopleStack project={project} />
              <DeliveryReadout project={project} todayIso={todayIso} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
