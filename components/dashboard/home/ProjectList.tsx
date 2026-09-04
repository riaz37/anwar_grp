import Link from "next/link";
import type { ProjectHealth, ProjectStage } from "@prisma/client";
import { formatDate } from "@/lib/format";
import { Pill } from "@/components/ui/StatusPill";
import {
  HEALTH_LABELS,
  HEALTH_TONE,
  STAGE_LABELS,
} from "@/components/projects/projectTone";
import { HOME_ROW_CLASS, HomeCardList } from "./HomeCard";

export type HomeProject = {
  id: string;
  name: string;
  health: ProjectHealth;
  currentStage: ProjectStage;
  /** Omitted on the attention list, which shows stage rather than a date. */
  expectedDeliveryDate?: Date;
};

/**
 * Two-letter monogram from the project name. A project has no avatar image, so
 * the initials are the identity mark — they give each row a fixed-width anchor
 * in the scan column and make a list of similarly-worded project names
 * distinguishable without reading them.
 */
function initials(name: string): string {
  // Punctuation is stripped first so a bracketed or quoted prefix doesn't
  // become the monogram (a project called "[Phase 2] Forecasting" reads PF).
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function Monogram({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-md border border-outline-low bg-surface-2 text-caption-2 font-semibold tracking-[0.02em] text-text-med"
    >
      {initials(name)}
    </span>
  );
}

export function ProjectList({ projects }: { projects: readonly HomeProject[] }) {
  return (
    <HomeCardList>
      {projects.map((project) => (
        <li key={project.id} className={HOME_ROW_CLASS}>
          <Monogram name={project.name} />

          <div className="min-w-0 flex-1">
            <Link
              href={`/projects/${project.id}`}
              className="block truncate text-body-2 font-semibold text-text-high underline-offset-2 hover:text-primary-high hover:underline"
            >
              {project.name}
            </Link>
            <p className="mt-ds-xxs truncate text-caption-2 text-text-low">
              {STAGE_LABELS[project.currentStage]}
              {project.expectedDeliveryDate && (
                <>
                  {" · due "}
                  <time
                    dateTime={project.expectedDeliveryDate
                      .toISOString()
                      .slice(0, 10)}
                    className="font-data tabular-nums"
                  >
                    {formatDate(
                      project.expectedDeliveryDate.toISOString().slice(0, 10),
                    )}
                  </time>
                </>
              )}
            </p>
          </div>

          <span className="shrink-0">
            <Pill
              tone={HEALTH_TONE[project.health]}
              label={HEALTH_LABELS[project.health]}
            />
          </span>
        </li>
      ))}
    </HomeCardList>
  );
}
