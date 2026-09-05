import { PanelEmpty } from "./Panel";
import { BarRow } from "./BarRow";

export type WorkloadRow = { userId: string; name: string; count: number };

/**
 * Active projects carried per person, heaviest first.
 *
 * Sorted by load rather than alphabetically, because the only question this
 * answers is "who is carrying too much". Bars are drawn against the busiest
 * person in the column, so the comparison stays inside the role — an analyst
 * with four projects and a developer with four are not the same load — and the
 * heaviest bar in each column is the one at full accent.
 */
export function WorkloadList({
  heading,
  rows,
  emptyNote,
}: {
  heading: string;
  rows: readonly WorkloadRow[];
  emptyNote: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 0);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-ds-2xl">
        <h3 className="annotation">{heading}</h3>
        {rows.length > 0 && (
          <p className="font-data text-caption-2 tabular-nums text-text-low">
            {total} across {rows.length}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-ds-2xl">
          <PanelEmpty>{emptyNote}</PanelEmpty>
        </div>
      ) : (
        <ol className="mt-ds-2xl flex flex-col gap-ds-md">
          {rows.map((r) => (
            <BarRow
              key={r.userId}
              label={r.name}
              value={r.count}
              max={max}
              leading={r.count === max}
              labelWidth="w-[11ch] sm:w-[15ch]"
            />
          ))}
        </ol>
      )}
    </div>
  );
}
