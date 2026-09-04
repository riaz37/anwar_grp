import Link from "next/link";
import type { ProjectStage } from "@prisma/client";
import { STAGE_LABELS } from "@/components/projects/projectTone";
import { formatDate } from "@/lib/format";
import { ListEmpty, LIST_ROW } from "./Panel";

export type DeliveryRow = {
  id: string;
  name: string;
  currentStage: ProjectStage;
  expectedDeliveryDate: Date;
};

/**
 * Projects with an expected delivery date inside the current month, soonest
 * first. The stage sits under the name because "due in nine days, still in
 * Requirements" is the pairing that starts a conversation.
 */
export function DeliveryList({ projects }: { projects: readonly DeliveryRow[] }) {
  if (projects.length === 0) {
    return (
      <ListEmpty>
        No project is expected to land this month. A project appears here as
        soon as its expected delivery date falls inside the current month.
      </ListEmpty>
    );
  }

  return (
    <ul>
      {projects.map((p) => {
        const day = p.expectedDeliveryDate.toISOString().slice(0, 10);
        return (
          <li key={p.id} className={LIST_ROW}>
            <span className="min-w-0 flex-1">
              <Link
                href={`/projects/${p.id}`}
                className="block truncate text-body-1 text-text-high underline-offset-2 hover:text-primary-high hover:underline"
              >
                {p.name}
              </Link>
              <span className="mt-ds-xxs block truncate text-caption-2 text-text-low">
                {STAGE_LABELS[p.currentStage]}
              </span>
            </span>
            <time
              dateTime={day}
              className="shrink-0 font-data text-caption-2 tabular-nums text-text-med"
            >
              {formatDate(day)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
