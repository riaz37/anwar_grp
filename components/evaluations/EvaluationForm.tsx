"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  saveEvaluationDraftAction,
  submitEvaluationAction,
} from "@/app/(dashboard)/_evaluation-actions";
import { Button } from "@/components/ui/Button";
import { RadioGroupField } from "@/components/ui/Choice";
import { TextAreaField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { formatDateTime } from "@/lib/format";
import {
  OVERALL_RECOMMENDATION_LABELS,
  OVERALL_RECOMMENDATION_MEANING,
  OVERALL_RECOMMENDATIONS,
  type EvaluationFormTemplate,
  type EvaluationRecord,
  type InterviewEvaluationRound,
  type OverallRecommendation,
} from "@/lib/types/domain";
import { ScoreScale } from "./ScoreScale";

/**
 * The panelist's own evaluation for one interview round.
 *
 * Scoped to "my evaluation": there is no panelist picker and no way to reach
 * anyone else's record from here, because a panelist only ever writes their
 * own (`prisma.Evaluation` is unique on `(interviewId, panelistId)`).
 *
 * The scored criteria are whatever `template.criteria` says — nothing in this
 * component names a criterion, so a template configured for a different role
 * type renders a different form with no code change (spec Sec 6: "Evaluation
 * forms should be configurable for different role types"). The four fields
 * below the scores are fixed by the spec itself (organisational suitability,
 * strengths, concerns, overall recommendation) and so are hard-coded here,
 * matching the same split in `lib/evaluation-forms.ts`.
 *
 * Two save paths, deliberately different in weight:
 *  - Draft: no validation, autosaves on a pause, stays editable. Spec Sec 7
 *    asks for "able to save drafts automatically", and a panel member writing
 *    this up between two other meetings is exactly who that bullet is for.
 *  - Submit: validated, confirmed, irreversible. It locks the record *and*
 *    unblinds the rest of the panel to this viewer, so it says both of those
 *    things before it happens.
 */

const AUTOSAVE_PAUSE_MS = 2500;

type Status =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "confirming" }
  | { phase: "submitting" }
  | { phase: "error"; message: string };

function initialScores(
  own: EvaluationRecord | null,
): Record<string, number | undefined> {
  return { ...(own?.scores ?? {}) };
}

export function EvaluationForm({
  round,
  template,
  own,
  viewerId,
  onSaved,
  onSubmitted,
}: {
  round: InterviewEvaluationRound;
  template: EvaluationFormTemplate;
  /** The viewer's own draft, or null before they have started one. */
  own: EvaluationRecord | null;
  viewerId: string;
  /** Draft saved — the round is rebuilt server-side and handed back. */
  onSaved: (round: InterviewEvaluationRound) => void;
  /** Submitted: same, but the returned round may now carry peer feedback. */
  onSubmitted: (round: InterviewEvaluationRound) => void;
}) {
  const prefix = useId();
  const confirmRef = useRef<HTMLDivElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scores, setScores] = useState(() => initialScores(own));
  const [organizationalSuitability, setOrganizationalSuitability] = useState(
    own?.organizationalSuitability ?? "",
  );
  const [strengths, setStrengths] = useState(own?.strengths ?? "");
  const [concerns, setConcerns] = useState(own?.concerns ?? "");
  const [recommendation, setRecommendation] = useState<string>(
    own?.overallRecommendation ?? "",
  );
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const busy = status.phase === "saving" || status.phase === "submitting";

  /** Every edit goes through here so autosave has one trigger, not eight. */
  function touch<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDirty(true);
    };
  }

  function body() {
    const cleanScores: Record<string, number> = {};
    for (const criterion of template.criteria) {
      const score = scores[criterion.key];
      if (score !== undefined) cleanScores[criterion.key] = score;
    }
    return {
      interviewId: round.interviewId,
      templateId: template.id,
      scores: cleanScores,
      organizationalSuitability: organizationalSuitability.trim(),
      strengths: strengths.trim(),
      concerns: concerns.trim(),
      overallRecommendation:
        recommendation === ""
          ? null
          : (recommendation as OverallRecommendation),
    };
  }

  async function saveDraft() {
    setStatus({ phase: "saving" });
    try {
      const next = await saveEvaluationDraftAction(body(), viewerId);
      setDirty(false);
      setSavedAt(new Date().toISOString());
      setStatus({ phase: "idle" });
      onSaved(next);
    } catch (error) {
      setStatus({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "The draft wasn’t saved. Your answers are still on screen — try again.",
      });
    }
  }

  /**
   * Autosave on a pause in typing. Only ever writes a *draft*: nothing here
   * can submit, so a distracted panelist cannot accidentally lock a record or
   * unblind themselves.
   */
  useEffect(() => {
    if (!dirty || busy || status.phase === "confirming") return;
    autosaveTimer.current = setTimeout(() => {
      void saveDraft();
    }, AUTOSAVE_PAUSE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, busy, status.phase, scores, organizationalSuitability, strengths, concerns, recommendation]);

  /* Move focus into the confirmation when it appears — a keyboard user who
     pressed "Submit…" should land on the thing that asks them to confirm. */
  useEffect(() => {
    if (status.phase === "confirming") confirmRef.current?.focus();
  }, [status.phase]);

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    for (const criterion of template.criteria) {
      if (scores[criterion.key] === undefined) {
        found[criterion.key] =
          "Score this before submitting, or leave the evaluation as a draft.";
      }
    }
    if (!recommendation) {
      found.recommendation =
        "Give your overall recommendation. The panel’s consolidated view is built from these.";
    }
    return found;
  }

  async function handleSubmit() {
    setStatus({ phase: "submitting" });
    try {
      const next = await submitEvaluationAction(body(), viewerId);
      setDirty(false);
      onSubmitted(next);
    } catch (error) {
      setStatus({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "The evaluation wasn’t submitted. Nothing was locked — try again.",
      });
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const found = validate();
        setErrors(found);
        if (Object.keys(found).length > 0) {
          setStatus({ phase: "idle" });
          return;
        }
        setStatus({ phase: "confirming" });
      }}
      className="flex max-w-[var(--container-form)] flex-col gap-xl"
    >
      <LiveRegion>
        {status.phase === "error" && (
          <InlineBanner
            tone="error"
            title="That didn’t save"
            onDismiss={() => setStatus({ phase: "idle" })}
          >
            {status.message}
          </InlineBanner>
        )}
        {status.phase !== "error" && savedAt && !dirty && (
          <p className="text-body-sm text-muted">
            Draft saved{" "}
            <span className="font-data tabular-nums">
              {formatDateTime(savedAt)}
            </span>
            . Only you can see it until you submit.
          </p>
        )}
      </LiveRegion>

      <section className="flex flex-col gap-lg">
        <div>
          <h4 className="text-body font-semibold text-text">Scored criteria</h4>
          <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
            From the <strong className="font-semibold">{template.name}</strong>{" "}
            form, configured for {template.roleType.toLowerCase()}. A different
            round type asks for different criteria.
          </p>
        </div>

        {template.criteria.map((criterion) => (
          <ScoreScale
            key={criterion.key}
            criterion={criterion}
            value={scores[criterion.key]}
            disabled={busy}
            error={errors[criterion.key]}
            onChange={touch<number | undefined>((value) =>
              setScores((current) => ({ ...current, [criterion.key]: value })),
            )}
          />
        ))}
      </section>

      <section className="flex flex-col gap-md border-t border-border pt-lg">
        <h4 className="text-body font-semibold text-text">Written feedback</h4>

        <TextAreaField
          id={`${prefix}-suitability`}
          label="Organisational suitability"
          rows={3}
          disabled={busy}
          value={organizationalSuitability}
          onChange={touch(setOrganizationalSuitability)}
          hint="How they would work here specifically — pace, structure, the people they would sit with."
        />
        <TextAreaField
          id={`${prefix}-strengths`}
          label="Strengths"
          rows={3}
          disabled={busy}
          value={strengths}
          onChange={touch(setStrengths)}
          hint="What you saw, not what you inferred. Examples travel better than adjectives."
        />
        <TextAreaField
          id={`${prefix}-concerns`}
          label="Concerns"
          rows={3}
          disabled={busy}
          value={concerns}
          onChange={touch(setConcerns)}
          hint="Collected into the consolidated results for the recruiter. Never sent to the candidate."
        />
      </section>

      <section className="border-t border-border pt-lg">
        <RadioGroupField
          legend="Overall recommendation"
          name={`${prefix}-recommendation`}
          required
          columns={1}
          disabled={busy}
          value={recommendation}
          onChange={touch(setRecommendation)}
          error={errors.recommendation}
          hint="Your position, in your words — not a calculation of the scores above, and not a decision. The recruiter and hiring manager decide."
          options={OVERALL_RECOMMENDATIONS.map((value) => ({
            value,
            label: OVERALL_RECOMMENDATION_LABELS[value],
            description: OVERALL_RECOMMENDATION_MEANING[value],
          }))}
        />
      </section>

      {/* The confirmation stays mounted while the submit is in flight —
          swapping back to the action row mid-request would move focus out from
          under the person who just pressed the button. */}
      {status.phase === "confirming" || status.phase === "submitting" ? (
        <div
          ref={confirmRef}
          tabIndex={-1}
          role="group"
          aria-label="Confirm submission"
          className="rounded-md border border-warning-soft bg-warning-soft px-md py-md motion-safe:animate-[fade-in_200ms_var(--ease-enter)]"
        >
          <p className="text-body-sm font-semibold text-warning-ink">
            Submit your evaluation for round {round.roundNumber}?
          </p>
          <p className="mt-2xs max-w-[62ch] text-body-sm text-warning-ink">
            Two things happen at once and neither can be undone: your
            evaluation is locked exactly as it reads now, and the rest of the
            panel&rsquo;s feedback for this round becomes visible to you.
          </p>
          <label className="mt-md flex min-h-11 max-w-[62ch] items-start gap-sm text-body-sm text-warning-ink">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-[5px] size-4 shrink-0 accent-[var(--warning)]"
            />
            I have finished this evaluation and understand it cannot be edited
            afterwards.
          </label>
          <div className="mt-md flex flex-wrap items-center gap-sm">
            <Button
              variant="primary"
              disabled={!acknowledged || busy}
              aria-busy={status.phase === "submitting"}
              onClick={() => void handleSubmit()}
            >
              {status.phase === "submitting"
                ? "Submitting…"
                : "Submit and lock"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setAcknowledged(false);
                setStatus({ phase: "idle" });
              }}
            >
              Keep editing
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-md border-t border-border pt-lg">
          <Button type="submit" variant="primary" disabled={busy}>
            Submit evaluation…
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !dirty}
            aria-busy={status.phase === "saving"}
            onClick={() => void saveDraft()}
          >
            {status.phase === "saving" ? "Saving draft…" : "Save draft"}
          </Button>
          <p className="text-body-sm text-muted">
            Drafts save on their own after a pause.
          </p>
        </div>
      )}
    </form>
  );
}
