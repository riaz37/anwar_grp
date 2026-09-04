import { PanelEmpty } from "./Panel";

export type WorkloadRow = { userId: string; name: string; count: number };

/**
 * Active projects carried per person, heaviest first.
 *
 * Sorted by load rather than alphabetically, because the only question this
 * answers is "who is carrying too much". Bars are drawn against the busiest
 * person in the column, so the comparison stays inside the role — an analyst
 * with four projects and a developer with four are not the same load.
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

  return (
    <div>
      <h3 className="annotation">{heading}</h3>

      {rows.length === 0 ? (
        <div className="mt-ds-2xl">
          <PanelEmpty>{emptyNote}</PanelEmpty>
        </div>
      ) : (
        <ol className="mt-ds-2xl flex flex-col gap-ds-xl">
          {rows.map((r) => (
            <li key={r.userId} className="flex items-center gap-ds-2xl">
              <span className="w-[14ch] shrink-0 truncate text-body-1 text-text-med">
                {r.name}
              </span>
              <span
                aria-hidden="true"
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2"
              >
                <span
                  className="block h-full rounded-pill bg-text-low"
                  style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }}
                />
              </span>
              <span className="w-5 shrink-0 text-right font-data text-body-1 tabular-nums text-text-high">
                {r.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
