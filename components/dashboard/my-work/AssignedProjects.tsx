import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Pill } from "@/components/ui/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { Panel, PanelEmpty, PanelFooter, PanelHeader } from "./Panel";
import type { AssignedProject } from "./types";

/**
 * The projects the signed-in user is named on, as a reference rail beside the
 * queue: this is context for the queue, not a second worklist, so each row
 * carries only what tells you whether to go and look — health, how far through
 * the lifecycle it is, and the delivery date.
 *
 * Stage is drawn as a filled step count rather than a nine-segment pipeline;
 * the full stepper belongs on the project workspace, and repeating it here at
 * rail width would shrink every label below legibility.
 */
export function AssignedProjects({
  projects,
}: {
  projects: readonly AssignedProject[];
}) {
  return (
    <Panel>
      <PanelHeader
        title="Projects you're on"
        meta={projects.length > 0 ? `${projects.length} active` : undefined}
      />

      {projects.length === 0 ? (
        <PanelEmpty
          icon={<FolderOpen size={16} strokeWidth={2} aria-hidden="true" />}
          title="You're not named on an active project"
          action={
            <ButtonLink href="/projects" variant="ghost">
              Browse the portfolio
            </ButtonLink>
          }
        >
          Projects appear here once you are set as the owner, analyst, or
          developer on one. Until then you can still read everything the group
          is running.
        </PanelEmpty>
      ) : (
        <>
          <ul className="divide-y divide-outline-low">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="group block px-ds-5xl py-ds-2xl transition-colors duration-150 ease-move hover:bg-surface-1"
                >
                  <span className="flex items-start justify-between gap-ds-md">
                    <span className="min-w-0 flex-1 text-body-2 font-semibold text-text-high underline-offset-4 group-hover:underline">
                      {project.name}
                    </span>
                    <span className="shrink-0">
                      <Pill
                        tone={project.healthTone}
                        label={project.healthLabel}
                      />
                    </span>
                  </span>

                  <span className="mt-ds-md flex items-center gap-ds-md">
                    <StageMeter
                      step={project.stageStep}
                      count={project.stageCount}
                    />
                    <span className="min-w-0 truncate text-caption-2 text-text-med">
                      {project.stageLabel}
                    </span>
                    <span className="sr-only">
                      , stage {project.stageStep} of {project.stageCount}
                    </span>
                  </span>

                  <span className="mt-ds-sm block text-caption-2 text-text-low">
                    Delivery{" "}
                    <time
                      dateTime={project.dueIso}
                      className="font-data tabular-nums"
                    >
                      {formatDate(project.dueIso)}
                    </time>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <PanelFooter>
            <ButtonLink href="/projects" variant="ghost">
              View the full portfolio
            </ButtonLink>
          </PanelFooter>
        </>
      )}
    </Panel>
  );
}

/** Lifecycle position as filled ticks — `4/10` in shape as well as figures. */
function StageMeter({ step, count }: { step: number; count: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center gap-[2px]"
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={
            i < step
              ? "h-[6px] w-[3px] rounded-[1px] bg-primary-med"
              : "h-[6px] w-[3px] rounded-[1px] bg-outline-high"
          }
        />
      ))}
    </span>
  );
}
