"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pill } from "@/components/ui/StatusPill";
import { HEALTH_LABELS, HEALTH_TONE } from "@/components/projects/projectTone";
import { SortIcon } from "@/components/ui/icons";
import { ChevronRightIcon } from "@/components/shell/icons";
import { cn } from "@/lib/utils";
import { DeliveryReadout, PeopleStack, StageMeter } from "./pieces";
import type { ProjectListItem, SortKey, SortState } from "./types";

const CELL = "px-ds-5xl py-ds-2xl align-middle";

export function PortfolioTable({
  projects,
  todayIso,
  sort,
  onSort,
}: {
  projects: readonly ProjectListItem[];
  todayIso: string;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-xl border border-outline-low bg-surface-0">
      <table className="w-full min-w-[900px] border-collapse text-left">
        <caption className="sr-only">
          Projects with pipeline stage, delivery health, assigned people, and
          expected delivery date. Column headers sort the list.
        </caption>
        <thead>
          <tr className="border-b border-outline-low">
            <SortHeader
              columnKey="name"
              sort={sort}
              onSort={onSort}
              className="w-[30%]"
            >
              Project
            </SortHeader>
            <SortHeader columnKey="stage" sort={sort} onSort={onSort} className="w-[20%]">
              Pipeline stage
            </SortHeader>
            <SortHeader columnKey="health" sort={sort} onSort={onSort}>
              Health
            </SortHeader>
            <th scope="col" className={cn(CELL, "annotation font-semibold")}>
              Team
            </th>
            <SortHeader
              columnKey="delivery"
              sort={sort}
              onSort={onSort}
              align="right"
            >
              Expected delivery
            </SortHeader>
            <th scope="col" className="w-ds-9xl">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="group cursor-pointer border-b border-outline-base transition-colors duration-100 ease-[var(--ease-move)] last:border-0 hover:bg-surface-1 focus-within:bg-surface-1"
            >
              <td className={cn(CELL, "max-w-0")}>
                <Link
                  href={`/projects/${project.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block truncate text-title-1 font-semibold text-text-high transition-colors duration-100 ease-[var(--ease-move)] hover:text-primary-high"
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
              </td>
              <td className={CELL}>
                <StageMeter stage={project.currentStage} />
              </td>
              <td className={CELL}>
                <Pill
                  tone={HEALTH_TONE[project.health]}
                  label={HEALTH_LABELS[project.health]}
                />
              </td>
              <td className={CELL}>
                <PeopleStack project={project} />
              </td>
              <td className={CELL}>
                <DeliveryReadout project={project} todayIso={todayIso} />
              </td>
              <td className={cn(CELL, "pl-0 text-right")}>
                <ChevronRightIcon
                  aria-hidden
                  className="inline-block size-4 text-text-low opacity-0 transition-opacity duration-100 ease-[var(--ease-move)] group-hover:opacity-100 group-focus-within:opacity-100"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  columnKey,
  sort,
  onSort,
  children,
  align = "left",
  className,
}: {
  columnKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  children: string;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === columnKey;
  return (
    <th
      scope="col"
      aria-sort={
        active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={cn(
        CELL,
        "annotation font-semibold",
        align === "right" && "text-right",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          "inline-flex items-center gap-ds-xs rounded-sm transition-colors duration-100 ease-[var(--ease-move)] hover:text-text-high",
          active && "text-text-high",
          align === "right" && "flex-row-reverse",
        )}
      >
        {children}
        <SortIcon
          aria-hidden
          direction={active ? sort.direction : "none"}
          className={cn("size-3", active ? "text-primary-high" : "text-text-low")}
        />
      </button>
    </th>
  );
}
