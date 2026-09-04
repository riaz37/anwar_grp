import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "danger";

export type Stat = {
  key: string;
  /** Uppercase micro-label, e.g. "Open tasks". */
  label: string;
  value: number;
  /** One line of context under the figure — what the number is counting. */
  hint: string;
  icon: ReactNode;
  /** `danger` only when the figure is non-zero and means "act now". */
  tone?: StatTone;
};

/**
 * The page's opening reading: four figures in one bordered strip, divided by
 * hairlines, rather than four floating cards.
 *
 * One container is the point — these numbers describe a single workload, and
 * separate boxes would read as four unrelated widgets. Figures are set in the
 * data face with tabular figures (DESIGN.md §2) so the column of numbers stays
 * comparable at a glance.
 */
export function StatStrip({ stats }: { stats: readonly Stat[] }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-outline-low bg-surface-0 shadow-e1 lg:grid-cols-4">
      {stats.map((stat, i) => {
        const alarming = stat.tone === "danger" && stat.value > 0;
        return (
          <div
            key={stat.key}
            className={cn(
              "flex flex-col gap-ds-2xl p-ds-5xl",
              // Hairlines between cells only: 2-up below lg, 4-up from lg.
              i % 2 === 0 && "border-r border-outline-low",
              i < 2 && "border-b border-outline-low",
              "lg:border-b-0",
              i === stats.length - 1 ? "lg:border-r-0" : "lg:border-r",
            )}
          >
            <div className="flex items-center gap-ds-md">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-sm border",
                  alarming
                    ? "border-danger-outline bg-danger-wash text-danger-high"
                    : "border-outline-low bg-surface-2 text-text-low",
                )}
              >
                {stat.icon}
              </span>
              {/* No truncation: at 2-up on a phone these labels have ~100px,
                  and a clipped "OPEN MILEST…" is worse than a second line. */}
              <dt className="annotation min-w-0">{stat.label}</dt>
            </div>

            <div>
              <dd
                className={cn(
                  "font-data text-metric font-semibold tabular-nums",
                  alarming ? "text-danger-high" : "text-text-high",
                )}
              >
                {stat.value}
              </dd>
              <p className="mt-ds-xs text-pretty text-caption-2 text-text-low">
                {stat.hint}
              </p>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
