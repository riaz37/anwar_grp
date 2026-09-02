import {
  COMMUNICATION_STATUS_LABELS,
  INTERVIEW_STATUS_LABELS,
  REQUISITION_STATUS_LABELS,
  STAGE_LABELS,
  type ApplicationStage,
  type CommunicationStatus,
  type InterviewStatus,
  type RequisitionStatus,
} from "@/lib/types/domain";
import {
  COMMUNICATION_STATUS_TONE,
  INTERVIEW_STATUS_TONE,
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

export function InterviewStatusPill({
  status,
  size,
}: {
  status: InterviewStatus;
  size?: keyof typeof SIZES;
}) {
  return (
    <Pill
      tone={INTERVIEW_STATUS_TONE[status]}
      label={INTERVIEW_STATUS_LABELS[status]}
      size={size}
      struck={status === "CANCELLED"}
    />
  );
}

/**
 * Communication pipeline status (BUILD_PLAN.md Sec 2.8). Defaults to `md`
 * rather than `sm`: a message's status is the primary thing a recruiter reads
 * off the communications list, not a row annotation.
 */
export function CommunicationStatusPill({
  status,
  size = "md",
}: {
  status: CommunicationStatus;
  size?: keyof typeof SIZES;
}) {
  return (
    <Pill
      tone={COMMUNICATION_STATUS_TONE[status]}
      label={COMMUNICATION_STATUS_LABELS[status]}
      size={size}
    />
  );
}
