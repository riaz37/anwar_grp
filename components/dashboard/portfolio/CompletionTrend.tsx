import { formatDate } from "@/lib/format";
import { PanelEmpty } from "./Panel";

export type CompletionBucket = {
  /** `YYYY-MM-DD`. */
  date: string;
  onTime: number;
  late: number;
};

/**
 * Milestone completions per day over the trailing window, split on-time vs
 * late.
 *
 * Two stacked segments rather than two separate charts: the question a manager
 * asks is "are we finishing work, and is it finishing on time?", and stacking
 * keeps both answers in one silhouette. The accent lime is spent here (on-time
 * work) because this is the one graphic on the page reporting a good outcome.
 */
export function CompletionTrend({
  buckets,
}: {
  buckets: readonly CompletionBucket[];
}) {
  const totalOnTime = buckets.reduce((sum, b) => sum + b.onTime, 0);
  const totalLate = buckets.reduce((sum, b) => sum + b.late, 0);
  const max = Math.max(1, ...buckets.map((b) => b.onTime + b.late));

  if (totalOnTime + totalLate === 0) {
    return (
      <PanelEmpty>
        No milestone has been completed in this window. Each completion adds a
        mark on the day it was closed, shaded by whether it beat its due date.
      </PanelEmpty>
    );
  }

  const first = buckets[0];
  const last = buckets[buckets.length - 1];

  return (
    <div>
      <div
        className="flex h-28 items-end gap-[3px]"
        role="img"
        aria-label={`${totalOnTime + totalLate} milestones completed over ${buckets.length} days: ${totalOnTime} on time, ${totalLate} late.`}
      >
        {buckets.map((b) => {
          const total = b.onTime + b.late;
          return (
            <div
              key={b.date}
              title={`${formatDate(b.date)} — ${total} completed`}
              className="flex h-full flex-1 flex-col justify-end gap-[2px] rounded-sm bg-surface-2 p-[2px]"
            >
              {b.late > 0 && (
                <span
                  className="block rounded-[3px] bg-warn-med"
                  style={{ height: `${(b.late / max) * 100}%` }}
                />
              )}
              {b.onTime > 0 && (
                <span
                  className="block rounded-[3px] bg-primary-med"
                  style={{ height: `${(b.onTime / max) * 100}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-ds-md flex items-center justify-between font-data text-caption-1 tabular-nums text-text-low">
        <span>{first ? formatDate(first.date) : ""}</span>
        <span>{last ? formatDate(last.date) : ""}</span>
      </div>

      <ul className="mt-ds-2xl flex flex-wrap items-center gap-x-ds-5xl gap-y-ds-md border-t border-outline-base pt-ds-2xl text-body-1">
        <Legend
          swatch="bg-primary-med"
          label="On time"
          value={totalOnTime}
        />
        <Legend swatch="bg-warn-med" label="Late" value={totalLate} />
      </ul>
    </div>
  );
}

function Legend({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: string;
  value: number;
}) {
  return (
    <li className="flex items-center gap-ds-md">
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${swatch}`}
      />
      <span className="text-text-med">{label}</span>
      <span className="font-data font-semibold tabular-nums text-text-high">
        {value}
      </span>
    </li>
  );
}
