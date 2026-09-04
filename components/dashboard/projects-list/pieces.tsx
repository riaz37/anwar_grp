import type { ProjectStage } from "@prisma/client";
import { STAGE_LABELS } from "@/components/projects/projectTone";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  DELIVERY_TONE_CLASS,
  STAGE_COUNT,
  describeDelivery,
  initials,
  stageIndex,
  type ProjectListItem,
} from "./types";

/**
 * Ten ticks, one per gate in the pipeline, so position in the funnel is
 * comparable down a column at a glance. This is a real measure of a real
 * ordinal field — not a decorative sparkline — and it is always paired with
 * the written stage name, which carries the meaning on its own.
 */
export function StageMeter({ stage }: { stage: ProjectStage }) {
  const index = stageIndex(stage);
  const done = stage === "COMPLETED";
  return (
    <div className="min-w-0">
      <div aria-hidden className="flex items-center gap-[2px]">
        {Array.from({ length: STAGE_COUNT }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-[3px] w-[6px] rounded-[1px] transition-colors duration-200 ease-[var(--ease-move)]",
              i > index && "bg-outline-high",
              i < index && (done ? "bg-success-med/50" : "bg-primary-med/40"),
              i === index && (done ? "bg-success-med" : "bg-primary-med"),
            )}
          />
        ))}
      </div>
      <div className="mt-ds-sm flex items-baseline gap-ds-sm">
        <span className="truncate text-body-1 text-text-med">
          {STAGE_LABELS[stage]}
        </span>
        <span className="font-data text-caption-1 tabular-nums text-text-low">
          {index + 1}/{STAGE_COUNT}
        </span>
      </div>
    </div>
  );
}

interface Member {
  name: string;
  role: string;
}

function members(project: ProjectListItem): Member[] {
  const list: Member[] = [{ name: project.ownerName, role: "Owner" }];
  if (project.analystName) list.push({ name: project.analystName, role: "Analyst" });
  if (project.developerName)
    list.push({ name: project.developerName, role: "Developer" });
  return list;
}

/**
 * Owner reads as text because accountability is a name, not a puzzle;
 * analyst and developer collapse into monograms behind it, with the full
 * roster exposed to assistive tech and on hover.
 */
export function PeopleStack({ project }: { project: ProjectListItem }) {
  const roster = members(project);
  const supporting = roster.slice(1);
  const unassigned = 2 - supporting.length;

  return (
    <div className="flex min-w-0 items-center gap-ds-lg">
      <div className="flex items-center">
        {supporting.map((member) => (
          <span
            key={member.role}
            title={`${member.role}: ${member.name}`}
            className="-ml-[6px] inline-flex size-6 items-center justify-center rounded-pill border border-surface-0 bg-surface-3 text-[10px] font-semibold leading-none text-text-med first:ml-0"
          >
            {initials(member.name)}
          </span>
        ))}
        {unassigned > 0 && (
          <span
            title={`${unassigned} role${unassigned === 1 ? "" : "s"} unassigned`}
            aria-hidden
            className="-ml-[6px] inline-flex size-6 items-center justify-center rounded-pill border border-dashed border-outline-high text-caption-2 leading-none text-text-low first:ml-0"
          >
            +
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-body-1 text-text-med">{project.ownerName}</p>
        <p className="annotation truncate">Owner</p>
      </div>
      <span className="sr-only">
        {roster.map((member) => `${member.role} ${member.name}`).join(", ")}
        {unassigned > 0 &&
          `, ${unassigned} role${unassigned === 1 ? "" : "s"} unassigned`}
      </span>
    </div>
  );
}

export function DeliveryReadout({
  project,
  todayIso,
  align = "right",
}: {
  project: ProjectListItem;
  todayIso: string;
  align?: "left" | "right";
}) {
  const { tone, label } = describeDelivery(project, todayIso);
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <p className="font-data text-body-1 tabular-nums text-text-high">
        {formatDate(project.expectedDeliveryDate)}
      </p>
      <p
        className={cn(
          "text-caption-2 font-medium tabular-nums",
          DELIVERY_TONE_CLASS[tone],
        )}
      >
        {label}
      </p>
    </div>
  );
}
