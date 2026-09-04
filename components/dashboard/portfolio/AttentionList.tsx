import Link from "next/link";
import type { ProjectHealth, ProjectStage } from "@prisma/client";
import { Pill } from "@/components/ui/StatusPill";
import {
  HEALTH_LABELS,
  HEALTH_TONE,
  STAGE_LABELS,
} from "@/components/projects/projectTone";
import { ChevronRightIcon } from "@/components/shell/icons";
import { ListEmpty } from "./Panel";

export type AttentionItem = {
  id: string;
  name: string;
  health: ProjectHealth;
  currentStage: ProjectStage;
  /** Blocker description, or the name of the milestone that slipped. */
  reason: string | null;
  needsDelayReason: boolean;
};

/**
 * The decision queue: every project that is blocked or delayed, with the
 * reason attached and a one-click route into the project.
 *
 * The whole row is the link (not just the title) so the target is a 44px-tall
 * band rather than a few words of text, and the reason line sits under the
 * title instead of in a column — reasons are free text and would wrap into a
 * ragged second column at any realistic width.
 */
export function AttentionList({
  items,
}: {
  items: readonly AttentionItem[];
}) {
  if (items.length === 0) {
    return (
      <ListEmpty>
        Nothing is blocked or delayed. A project lands here the moment a blocker
        is raised or one of its milestones passes its due date, with the reason
        attached.
      </ListEmpty>
    );
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id} className="border-b border-outline-base last:border-b-0">
          <Link
            href={`/projects/${item.id}`}
            className="group flex items-start gap-ds-2xl px-ds-5xl py-ds-2xl transition-colors duration-100 hover:bg-surface-2"
          >
            <span className="mt-[3px] shrink-0">
              <Pill
                tone={HEALTH_TONE[item.health]}
                label={HEALTH_LABELS[item.health]}
              />
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-ds-md gap-y-ds-xxs">
                <span className="text-body-1 font-semibold text-text-high group-hover:text-primary-high">
                  {item.name}
                </span>
                <span className="text-caption-2 text-text-low">
                  {STAGE_LABELS[item.currentStage]}
                </span>
                {item.needsDelayReason && (
                  <Pill tone="warning" label="Delay reason needed" />
                )}
              </span>
              {item.reason && (
                <span className="mt-ds-xxs block max-w-[68ch] text-pretty text-para text-text-low">
                  {item.reason}
                </span>
              )}
            </span>

            <ChevronRightIcon
              size={16}
              className="mt-[3px] shrink-0 text-text-low opacity-0 transition-opacity duration-100 group-hover:opacity-100"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
