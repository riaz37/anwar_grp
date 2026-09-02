"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { RadioGroupField } from "@/components/ui/Choice";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextInputField,
} from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { ApiRequestError } from "@/lib/api-client";
import {
  ASSESSMENT_ATTENDANCE,
  ASSESSMENT_ATTENDANCE_LABELS,
  ASSESSMENT_TYPE_LABELS,
  ASSESSMENT_TYPES,
  ELIGIBILITY_LABELS,
  ELIGIBILITY_OUTCOMES,
  EVALUATOR_RECOMMENDATION_LABELS,
  EVALUATOR_RECOMMENDATIONS,
  SCREENING_RECOMMENDATION_LABELS,
  SCREENING_RECOMMENDATIONS,
  TELEPHONE_OUTCOME_LABELS,
  TELEPHONE_OUTCOMES,
  type AssessmentAttendance,
  type AssessmentType,
  type DocumentRef,
  type EligibilityOutcome,
  type EvaluatorRecommendation,
  type ScreeningAssessment,
  type ScreeningRecommendation,
  type TelephoneOutcome,
} from "@/lib/types/domain";

/**
 * Records the ten fields spec Sec 6 > Screening and Assessment lists.
 *
 * The form is split into three fieldsets that match how the work actually
 * happens rather than the order the spec prints them in: the eligibility call
 * and the phone screen happen in one sitting, the paper assessment happens
 * days later, and the evaluator signs off after that. Recruiters save
 * partially-filled records between those sittings, so only the two fields a
 * stage decision genuinely rests on are required.
 */

const ELIGIBILITY_DESCRIPTIONS: Record<EligibilityOutcome, string> = {
  ELIGIBLE: "Meets the requisition's stated criteria.",
  ELIGIBLE_WITH_RESERVATION: "Proceeding, with a gap the panel should probe.",
  NOT_ELIGIBLE: "Does not meet a hard criterion.",
};

function options<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
) {
  return values.map((value) => ({ value, label: labels[value] }));
}

/* ──────────────────────────────────────────────────────────────────────────
 * SWAP POINT — screening record write
 *
 * TODO(backend): replace this with the real call once the routes exist:
 *
 *   first save   POST  /api/v1/applications/{applicationId}/screening
 *   later edits  PATCH /api/v1/applications/{applicationId}/screening
 *
 * Body is the `ScreeningInput` shape below verbatim, plus `version` on the
 * PATCH (optimistic locking, BUILD_PLAN.md Sec 2.4 — a screening record is
 * edited by whichever of the recruiter and the assessment evaluator gets there
 * first, so the 409 path is not theoretical here).
 *
 * `lib/api-client.ts` exposes `postJson` only; add `patchJson` when wiring.
 * The 409 branch in `handleSubmit` already reads `ApiRequestError.status`.
 * ────────────────────────────────────────────────────────────────────────── */
interface ScreeningInput {
  applicationId: string;
  eligibility: EligibilityOutcome;
  screeningComments: string;
  telephoneOutcome: TelephoneOutcome;
  availability: string;
  recommendation: ScreeningRecommendation;
  assessmentType: AssessmentType;
  assessmentScore: number | null;
  assessmentMaxScore: number;
  attendance: AssessmentAttendance;
  evaluatorRecommendation: EvaluatorRecommendation | null;
  evaluatorComments: string;
  version: number | null;
}

async function submitScreening(
  input: ScreeningInput,
): Promise<{ id: string; version: number }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    id: `scr_local_${input.applicationId}`,
    version: (input.version ?? 0) + 1,
  };
}

type Status =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "conflict" }
  | { phase: "error"; message: string };

export function ScreeningForm({
  applicationId,
  existing,
  onSaved,
  onCancel,
}: {
  applicationId: string;
  existing: ScreeningAssessment | null;
  onSaved: (record: ScreeningAssessment) => void;
  onCancel: () => void;
}) {
  const prefix = useId();

  const [eligibility, setEligibility] = useState<string>(
    existing?.eligibility ?? "",
  );
  const [screeningComments, setScreeningComments] = useState(
    existing?.screeningComments ?? "",
  );
  const [telephoneOutcome, setTelephoneOutcome] = useState<string>(
    existing?.telephoneOutcome ?? "NOT_ATTEMPTED",
  );
  const [availability, setAvailability] = useState(existing?.availability ?? "");
  const [recommendation, setRecommendation] = useState<string>(
    existing?.recommendation ?? "",
  );
  const [assessmentType, setAssessmentType] = useState<string>(
    existing?.assessmentType ?? "NONE",
  );
  const [score, setScore] = useState(
    existing?.assessmentScore === null || existing?.assessmentScore === undefined
      ? ""
      : String(existing.assessmentScore),
  );
  const [maxScore, setMaxScore] = useState(
    String(existing?.assessmentMaxScore ?? 100),
  );
  const [attendance, setAttendance] = useState<string>(
    existing?.attendance ?? "NOT_APPLICABLE",
  );
  const [evaluatorRecommendation, setEvaluatorRecommendation] =
    useState<string>(existing?.evaluatorRecommendation ?? "");
  const [evaluatorComments, setEvaluatorComments] = useState(
    existing?.evaluatorComments ?? "",
  );
  const [documents] = useState<DocumentRef[]>(existing?.documents ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ phase: "idle" });

  const submitting = status.phase === "submitting";
  const noAssessment = assessmentType === "NONE";

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    if (!eligibility) {
      found.eligibility =
        "Record whether this candidate meets the requisition's criteria.";
    }
    if (!recommendation) {
      found.recommendation = "Say what should happen to this application next.";
    }
    if (!noAssessment) {
      const max = Number(maxScore);
      if (!maxScore || Number.isNaN(max) || max <= 0) {
        found.maxScore = "Give the total the assessment is marked out of.";
      }
      if (score !== "") {
        const value = Number(score);
        if (Number.isNaN(value) || value < 0) {
          found.score = "Scores cannot be negative.";
        } else if (!Number.isNaN(max) && value > max) {
          found.score = `That is higher than the ${max}-point total.`;
        }
      }
    }
    return found;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setStatus({ phase: "idle" });
      return;
    }

    setStatus({ phase: "submitting" });
    try {
      const result = await submitScreening({
        applicationId,
        eligibility: eligibility as EligibilityOutcome,
        screeningComments: screeningComments.trim(),
        telephoneOutcome: telephoneOutcome as TelephoneOutcome,
        availability: availability.trim(),
        recommendation: recommendation as ScreeningRecommendation,
        assessmentType: assessmentType as AssessmentType,
        assessmentScore: noAssessment || score === "" ? null : Number(score),
        assessmentMaxScore: noAssessment ? 100 : Number(maxScore),
        attendance: attendance as AssessmentAttendance,
        evaluatorRecommendation:
          evaluatorRecommendation === ""
            ? null
            : (evaluatorRecommendation as EvaluatorRecommendation),
        evaluatorComments: evaluatorComments.trim(),
        version: existing?.version ?? null,
      });

      const now = new Date().toISOString();
      onSaved({
        id: existing?.id ?? result.id,
        applicationId,
        eligibility: eligibility as EligibilityOutcome,
        screeningComments: screeningComments.trim(),
        telephoneOutcome: telephoneOutcome as TelephoneOutcome,
        availability: availability.trim(),
        recommendation: recommendation as ScreeningRecommendation,
        assessmentType: assessmentType as AssessmentType,
        assessmentScore: noAssessment || score === "" ? null : Number(score),
        assessmentMaxScore: noAssessment ? 100 : Number(maxScore),
        attendance: attendance as AssessmentAttendance,
        documents,
        evaluatorRecommendation:
          evaluatorRecommendation === ""
            ? null
            : (evaluatorRecommendation as EvaluatorRecommendation),
        evaluatorComments: evaluatorComments.trim(),
        recordedBy: existing?.recordedBy ?? { id: "", name: "You" },
        recordedAt: existing?.recordedAt ?? now,
        updatedAt: now,
        version: result.version,
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setStatus({ phase: "conflict" });
        return;
      }
      setStatus({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "The screening record wasn’t saved. Try again.",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex max-w-[var(--container-form)] flex-col gap-xl"
    >
      <LiveRegion>
        {status.phase === "conflict" && (
          <InlineBanner
            tone="warning"
            title="Someone else updated this screening record"
            onDismiss={() => setStatus({ phase: "idle" })}
          >
            Your edit wasn’t saved and nothing was overwritten. Reload the
            application, then re-apply anything still missing.
          </InlineBanner>
        )}
        {status.phase === "error" && (
          <InlineBanner
            tone="error"
            title="That screening record wasn’t saved"
            onDismiss={() => setStatus({ phase: "idle" })}
          >
            {status.message}
          </InlineBanner>
        )}
      </LiveRegion>

      <section className="flex flex-col gap-md">
        <h4 className="text-body font-semibold text-text">Screening</h4>

        <RadioGroupField
          legend="Eligibility"
          name={`${prefix}-eligibility`}
          required
          columns={3}
          disabled={submitting}
          value={eligibility}
          onChange={setEligibility}
          error={errors.eligibility}
          options={ELIGIBILITY_OUTCOMES.map((value) => ({
            value,
            label: ELIGIBILITY_LABELS[value],
            description: ELIGIBILITY_DESCRIPTIONS[value],
          }))}
        />

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <SelectField
            id={`${prefix}-telephone`}
            label="Telephone-assessment outcome"
            disabled={submitting}
            value={telephoneOutcome}
            onChange={setTelephoneOutcome}
            options={options(TELEPHONE_OUTCOMES, TELEPHONE_OUTCOME_LABELS)}
          />
          <TextInputField
            id={`${prefix}-availability`}
            label="Availability"
            disabled={submitting}
            value={availability}
            onChange={setAvailability}
            hint="Notice period or earliest start, in the candidate’s own words."
          />
        </div>

        <TextAreaField
          id={`${prefix}-comments`}
          label="Screening comments"
          rows={4}
          disabled={submitting}
          value={screeningComments}
          onChange={setScreeningComments}
          hint="Internal. Never merged into a candidate message — see the note on the Messages tab."
        />

        <SelectField
          id={`${prefix}-recommendation`}
          label="Recommendation"
          required
          disabled={submitting}
          value={recommendation}
          onChange={setRecommendation}
          error={errors.recommendation}
          placeholder="Choose what happens next…"
          options={options(
            SCREENING_RECOMMENDATIONS,
            SCREENING_RECOMMENDATION_LABELS,
          )}
          hint="This is your recommendation, not the stage change itself — move the application on the Pipeline tab."
        />
      </section>

      <section className="flex flex-col gap-md border-t border-border pt-lg">
        <h4 className="text-body font-semibold text-text">Assessment</h4>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <SelectField
            id={`${prefix}-assessment-type`}
            label="Assessment type"
            disabled={submitting}
            value={assessmentType}
            onChange={setAssessmentType}
            options={options(ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS)}
          />
          <SelectField
            id={`${prefix}-attendance`}
            label="Attendance"
            disabled={submitting || noAssessment}
            value={noAssessment ? "NOT_APPLICABLE" : attendance}
            onChange={setAttendance}
            options={options(
              ASSESSMENT_ATTENDANCE,
              ASSESSMENT_ATTENDANCE_LABELS,
            )}
          />
          <NumberField
            id={`${prefix}-score`}
            label="Assessment score"
            min={0}
            disabled={submitting || noAssessment}
            value={noAssessment ? "" : score}
            onChange={setScore}
            error={errors.score}
            hint="Leave empty until the paper is marked."
          />
          <NumberField
            id={`${prefix}-max-score`}
            label="Marked out of"
            min={1}
            required
            disabled={submitting || noAssessment}
            value={noAssessment ? "" : maxScore}
            onChange={setMaxScore}
            error={errors.maxScore}
          />
        </div>

        {/* Real presigned-upload flow (Phase 1). `ownerId` is the screening
            record's id, which does not exist until the first save — before
            then the control stages the file and the note below says so. */}
        <div className="rounded-md border border-border bg-surface-sunken px-md py-md">
          <DocumentUpload
            ownerType="SCREENING_ASSESSMENT"
            ownerId={existing?.id ?? null}
            label="Assessment documents"
            hint="Scanned answer sheets, marking sheets, submitted tasks."
          />
          {documents.length > 0 && (
            <ul className="mt-sm flex flex-col gap-2xs">
              {documents.map((document) => (
                <li key={document.id} className="text-body-sm text-muted">
                  Already attached: {document.fileName}
                </li>
              ))}
            </ul>
          )}
          {!existing && (
            <p className="mt-sm text-caption text-muted">
              Save this record first — a file can only be attached to a
              screening record that exists.
            </p>
          )}
          {/* TODO(backend): once `POST /api/v1/documents` is called from
              `DocumentUpload.onUploaded` (see that file's hand-off block), pass
              an `onUploaded` handler here and promote `documents` back to a
              stateful list so the new `DocumentRef` appends locally. Today the
              bytes reach the object store but no row is created, so the list
              above only ever shows documents that came back from the server. */}
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <SelectField
            id={`${prefix}-evaluator-recommendation`}
            label="Evaluator recommendation"
            disabled={submitting || noAssessment}
            value={noAssessment ? "" : evaluatorRecommendation}
            onChange={setEvaluatorRecommendation}
            placeholder="Not signed off yet"
            options={options(
              EVALUATOR_RECOMMENDATIONS,
              EVALUATOR_RECOMMENDATION_LABELS,
            )}
            hint="The assessment marker’s verdict, separate from yours above."
          />
        </div>

        <TextAreaField
          id={`${prefix}-evaluator-comments`}
          label="Evaluator comments"
          rows={3}
          disabled={submitting || noAssessment}
          value={noAssessment ? "" : evaluatorComments}
          onChange={setEvaluatorComments}
        />
      </section>

      <div className="flex flex-wrap items-center gap-md border-t border-border pt-lg">
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting
            ? "Saving…"
            : existing
              ? "Save changes"
              : "Save screening record"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        {existing && (
          <span className="font-data text-caption tabular-nums text-muted">
            record version {existing.version}
          </span>
        )}
      </div>
    </form>
  );
}
