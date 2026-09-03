import { TONE_DOT, TONE_PILL, type Tone } from "./tone";

const SIZES = {
  sm: "px-sm py-[1px] text-caption",
  md: "px-sm py-2xs text-body-sm",
} as const;

/**
 * Generic status pill. Domain-specific wrappers (e.g. a `ProjectHealthPill`
 * mapping `Health -> tone/label`) compose this rather than duplicating the
 * markup — see ApplicationStage-era StagePill/ApprovalStatusPill (removed
 * with the TalentFlow domain) for the pattern to follow.
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
    <span
      className={`inline-flex items-center gap-xs whitespace-nowrap rounded-full border font-medium ${TONE_PILL[tone]} ${SIZES[size]}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`}
      />
      <span className={struck ? "line-through decoration-1" : undefined}>
        {label}
      </span>
    </span>
  );
}
