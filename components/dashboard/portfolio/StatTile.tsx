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
/** Fill for the share gauge, per tone. Deliberately full-saturation `-med`
 *  inks rather than the `-high` text inks: this is a 6px bar, not type. */
const GAUGE_FILL: Record<Tone, string> = {
  neutral: "bg-primary-med",
  accent: "bg-primary-med",
  info: "bg-info-med",
  warning: "bg-warn-med",
  success: "bg-success-med",
  error: "bg-danger-med",
};

/** A real ratio this figure is part of. Never a synthetic target — every
 *  denominator here is a count the page already queried. */
export type StatShare = {
  total: number;
  /** Spoken form of the ratio, for assistive tech. */
  label: string;
};

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
  share,
  index = 0,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ComponentType<IconProps>;
  /** Applied to the figure only when the count is non-zero. */
  tone?: Tone;
  href?: string;
  /** Draws a gauge under the figure, showing it against its own whole. */
  share?: StatShare;
  /** Stagger position for the page-load reveal. */
  index?: number;
}) {
  const emphasised = tone !== "neutral" && value > 0;
  const ratio =
    share && share.total > 0 ? Math.min(value / share.total, 1) : null;

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

      <p className="mt-ds-5xl flex items-baseline gap-ds-md">
        <span
          className={cn(
            "font-data text-metric font-semibold tabular-nums",
            emphasised ? TONE_TEXT[tone] : "text-text-high",
          )}
        >
          {value}
        </span>
        {share && (
          <span className="font-data text-caption-2 tabular-nums text-text-low">
            of {share.total}
          </span>
        )}
      </p>

      {ratio !== null && (
        <span
          role="img"
          aria-label={share?.label}
          className="mt-ds-lg block h-1.5 overflow-hidden rounded-pill bg-surface-3"
        >
          <span
            className={cn("block h-full rounded-pill", GAUGE_FILL[tone])}
            style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%` }}
          />
        </span>
      )}

      <p className="mt-ds-lg text-para text-text-low">{hint}</p>
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
