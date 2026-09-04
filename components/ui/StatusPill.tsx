import { Badge } from "@/components/ui/primitives/badge";
import { cn } from "@/lib/utils";
import { TONE_DOT, TONE_PILL, type Tone } from "./tone";

const SIZES = {
  sm: "px-ds-sm py-[1px] text-caption-2",
  md: "px-ds-sm py-ds-xxs text-body-1",
} as const;

/**
 * Generic status pill, built on shadcn/ui's `Badge`.
 *
 * Badge's own `variant` set (default/secondary/destructive/…) is deliberately
 * bypassed: DESIGN.md > Color reserves semantic colour for *status meaning*,
 * and the tone→class map in `tone.ts` is the single place that meaning is
 * declared. Using `variant` here would create a second, parallel palette.
 *
 * Domain-specific tone/label maps (e.g. `projectTone.ts`'s `HEALTH_TONE`)
 * compose this rather than duplicating the markup.
 */
export function Pill({
  tone,
  label,
  size = "sm",
  struck = false,
}: {
  tone: Tone;
  label: string;
  size?: keyof typeof SIZES;
  struck?: boolean;
}) {
  return (
    <Badge
      variant="ghost"
      className={cn(
        "gap-ds-xs whitespace-nowrap border font-medium",
        TONE_PILL[tone],
        SIZES[size],
      )}
    >
      {/* The dot carries the tone at full saturation while the fill stays soft,
          so the status is still separable for users who can't rely on the
          background tint alone. */}
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
      />
      <span className={struck ? "line-through decoration-1" : undefined}>
        {label}
      </span>
    </Badge>
  );
}
