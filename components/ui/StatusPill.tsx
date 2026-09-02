import {
  REQUISITION_STATUS_LABELS,
  STAGE_LABELS,
  type ApplicationStage,
  type RequisitionStatus,
} from "@/lib/types/domain";
import {
  REQUISITION_STATUS_TONE,
  STAGE_TONE,
  STRUCK_STAGES,
  TONE_DOT,
  TONE_PILL,
  type Tone,
} from "./tone";

const SIZES = {
  sm: "px-sm py-[1px] text-caption",
  md: "px-sm py-2xs text-body-sm",
} as const;

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

export function RequisitionStatusPill({
  status,
  size,
}: {
  status: RequisitionStatus;
  size?: keyof typeof SIZES;
}) {
  return (
    <Pill
      tone={REQUISITION_STATUS_TONE[status]}
      label={REQUISITION_STATUS_LABELS[status]}
      size={size}
    />
  );
}

export function StagePill({
  stage,
  size,
}: {
  stage: ApplicationStage;
  size?: keyof typeof SIZES;
}) {
  return (
    <Pill
      tone={STAGE_TONE[stage]}
      label={STAGE_LABELS[stage]}
      size={size}
      struck={STRUCK_STAGES.has(stage)}
    />
  );
}
