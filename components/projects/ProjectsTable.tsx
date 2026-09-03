"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectHealth, ProjectStage } from "@prisma/client";
import { Pill } from "@/components/ui/StatusPill";
import { SearchInput, FilterSelect } from "@/components/ui/Filters";
import { formatDate } from "@/lib/format";
import {
  HEALTH_LABELS,
  HEALTH_TONE,
  STAGE_LABELS,
  STAGE_ORDER,
} from "./projectTone";

export interface ProjectRow {
  id: string;
  name: string;
  currentStage: ProjectStage;
  health: ProjectHealth;
  ownerName: string;
  analystName: string | null;
  developerName: string | null;
  businessUnitName: string;
  departmentName: string;
  expectedDeliveryDate: string;
}

const STAGE_OPTIONS = STAGE_ORDER.map((stage) => ({
  value: stage,
  label: STAGE_LABELS[stage],
}));

const HEALTH_OPTIONS = (Object.keys(HEALTH_LABELS) as ProjectHealth[]).map((h) => ({
  value: h,
  label: HEALTH_LABELS[h],
}));

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [health, setHealth] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (stage && p.currentStage !== stage) return false;
      if (health && p.health !== health) return false;
      return true;
    });
  }, [projects, search, stage, health]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-sm">
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Search projects"
          placeholder="Search by project name…"
        />
        <FilterSelect
          value={stage}
          onChange={setStage}
          label="Stage"
          allLabel="All stages"
          options={STAGE_OPTIONS}
        />
        <FilterSelect
          value={health}
          onChange={setHealth}
          label="Health"
          allLabel="All health"
          options={HEALTH_OPTIONS}
        />
      </div>

      <div className="mt-md overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[860px] border-collapse text-body-sm">
          <thead>
            <tr className="border-b border-border bg-surface-sunken text-left text-caption font-medium uppercase tracking-[0.06em] text-muted">
              <th className="px-md py-sm">Project</th>
              <th className="px-md py-sm">Stage</th>
              <th className="px-md py-sm">Health</th>
              <th className="px-md py-sm">Owner</th>
              <th className="px-md py-sm">Analyst</th>
              <th className="px-md py-sm">Developer</th>
              <th className="px-md py-sm">Expected delivery</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-md py-xl text-center text-body-sm text-muted">
                  {projects.length === 0
                    ? "No projects yet — create the first one."
                    : "No projects match these filters."}
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-sunken">
                <td className="px-md py-sm">
                  <Link
                    href={`/projects/${p.id}`}
                    className="font-medium text-text hover:text-accent-ink"
                  >
                    {p.name}
                  </Link>
                  <div className="text-caption text-muted">
                    {p.businessUnitName} / {p.departmentName}
                  </div>
                </td>
                <td className="px-md py-sm text-text">{STAGE_LABELS[p.currentStage]}</td>
                <td className="px-md py-sm">
                  <Pill tone={HEALTH_TONE[p.health]} label={HEALTH_LABELS[p.health]} />
                </td>
                <td className="px-md py-sm text-text">{p.ownerName}</td>
                <td className="px-md py-sm text-muted">{p.analystName ?? "—"}</td>
                <td className="px-md py-sm text-muted">{p.developerName ?? "—"}</td>
                <td className="px-md py-sm font-data tabular-nums text-text">
                  {formatDate(p.expectedDeliveryDate.slice(0, 10))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
