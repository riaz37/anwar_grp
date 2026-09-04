import Link from "next/link";
import type { ComponentType, CSSProperties } from "react";
import type { IconProps } from "@/components/shell/icons";
import { cn } from "@/lib/utils";
import { TONE_TEXT, type Tone } from "@/components/ui/tone";

/**
 * Headline figure for the portfolio strip.
 *
 * The number is set in the data face with tabular figures (DESIGN.md §2: any
 * numeral compared against another numeral), because these four tiles are read
 * against each other. `tone` colours the figure only when the number carries a
 * warning — a tile is otherwise neutral, so the one red count on the row is the
 * thing the eye lands on.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
  index = 0,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ComponentType<IconProps>;
  /** Applied to the figure only when the count is non-zero. */
  tone?: Tone;
  href?: string;
  /** Stagger position for the page-load reveal. */
  index?: number;
}) {
  const emphasised = tone !== "neutral" && value > 0;

  const body = (
    <>
      <div className="flex items-start justify-between gap-ds-2xl">
        <span className="annotation">{label}</span>
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md border border-outline-low bg-surface-2",
            emphasised ? TONE_TEXT[tone] : "text-text-low",
          )}
        >
          <Icon size={14} />
        </span>
      </div>

      <p
        className={cn(
          "mt-ds-5xl font-data text-metric font-semibold tabular-nums",
          emphasised ? TONE_TEXT[tone] : "text-text-high",
        )}
      >
        {value}
      </p>
      <p className="mt-ds-xs text-para text-text-low">{hint}</p>
    </>
  );

  const shell =
    "block rounded-xl border border-outline-low bg-surface-1 p-ds-5xl shadow-e1 rise-in";

  if (!href) {
    return (
      <div className={shell} style={{ "--i": index } as CSSProperties}>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        shell,
        "transition-colors duration-100 hover:border-outline-high hover:bg-surface-2",
      )}
      style={{ "--i": index } as CSSProperties}
    >
      {body}
    </Link>
  );
}
