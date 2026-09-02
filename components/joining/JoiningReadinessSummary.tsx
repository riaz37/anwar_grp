import { SegmentedTrack, type TrackSegment } from "@/components/ui/SegmentedTrack";
import { TONE_DOT, TONE_TEXT, joiningReadinessTone } from "@/components/ui/tone";
import { dueLabel } from "@/components/tasks/types";
import { formatDate } from "@/lib/format";
import {
  isOverdue,
  sortChecklist,
  type JoiningChecklistItem,
  type JoiningReadiness,
} from "@/lib/types/joining";

/**
 * "Show readiness for joining" (spec Sec 11, Scenario 5) — the header of the
 * Joining tab.
 *
 * It answers three questions in the order they get asked: how much is left, is
 * any of it late, and when does this person actually start. Nothing else. In
 * particular there is no readiness *score*, no percentage badge and no
 * traffic-light verdict: readiness is "what is outstanding and what is late",
 * and a single number would hide which of the two you are looking at.
 *
 * The track is one segment per item, reusing the same component the stage
 * pipeline and the approval chain already use rather than inventing a third
 * progress shape on the same screen. It carries real information at a glance —
 * how many items there are, and how the outstanding ones are distributed — so
 * it is not decoration; its visible labels are off because thirteen truncated
 * labels are worse than none, and every label is still spoken.
 */

function segmentFill(item: JoiningChecklistItem, today: string): string {
  if (item.status === "DONE") return "bg-success";
  if (item.status === "BLOCKED" || isOverdue(item, today)) return "bg-warning";
  return "bg-border-strong";
}

function spokenState(item: JoiningChecklistItem, today: string): string {
  if (item.status === "DONE") return "done";
  if (item.status === "BLOCKED") return "blocked";
  return isOverdue(item, today) ? "overdue" : "pending";
}

export function JoiningReadinessSummary({
  items,
  readiness,
  today,
  targetJoiningDate,
}: {
  items: readonly JoiningChecklistItem[];
  readiness: JoiningReadiness;
  /** `YYYY-MM-DD`, threaded from the server so "overdue" is stable on hydration. */
  today: string;
  /** The requisition's target joining date, or null when it could not be read. */
  targetJoiningDate: string | null;
}) {
  const tone = joiningReadinessTone(readiness);

  const segments: readonly TrackSegment[] = sortChecklist(items).map(
    (item) => ({
      key: item.id,
      label: item.label,
      fill: segmentFill(item, today),
      spokenState: spokenState(item, today),
    }),
  );

  const problems = [
    readiness.overdueCount > 0 &&
      `${readiness.overdueCount} overdue`,
    readiness.blockedCount > 0 && `${readiness.blockedCount} blocked`,
  ].filter((entry): entry is string => typeof entry === "string");

  return (
    <section
      aria-labelledby="joining-readiness-heading"
      className="flex flex-col gap-md"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-lg gap-y-sm">
        <h3
          id="joining-readiness-heading"
          className="flex items-baseline gap-sm text-section text-text"
        >
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 translate-y-[-3px] rounded-full ${TONE_DOT[tone]}`}
          />
          <span>
            <span className="font-data tabular-nums">
              {readiness.doneCount}
            </span>
            <span className="text-muted"> of </span>
            <span className="font-data tabular-nums">{readiness.total}</span>
            <span> complete</span>
          </span>
        </h3>

        {targetJoiningDate && (
          <p className="text-body-sm text-muted">
            Target joining date{" "}
            <span className="font-data tabular-nums text-text">
              {formatDate(targetJoiningDate)}
            </span>
            <span className="text-muted">
              {" · "}
              {dueLabel(targetJoiningDate, new Date(`${today}T12:00:00Z`))}
            </span>
          </p>
        )}
      </div>

      <SegmentedTrack
        segments={segments}
        labelsFrom="never"
        ariaLabel="Joining checklist progress"
      />

      {/* One sentence, and only when it says something. A permanently-present
          "0 overdue · 0 blocked" line trains people to stop reading the row
          that matters. */}
      {readiness.complete ? (
        <p className={`text-body-sm font-medium ${TONE_TEXT.success}`}>
          Every checklist item is done. Nothing is outstanding for this joining.
        </p>
      ) : problems.length > 0 ? (
        <p className={`text-body-sm font-medium ${TONE_TEXT.warning}`}>
          {problems.join(" · ")} — these need chasing before the start date.
        </p>
      ) : (
        <p className="text-body-sm text-muted">
          {readiness.total - readiness.doneCount} item
          {readiness.total - readiness.doneCount === 1 ? "" : "s"} outstanding,
          none of them late.
        </p>
      )}
    </section>
  );
}
