"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextInputField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { ApiRequestError } from "@/lib/api-client";
import { todayIsoDate } from "@/lib/format";
import {
  ALL_STAGES,
  PIPELINE_STAGES,
  STAGE_LABELS,
  type ApplicationStage,
  type ApplicationSummary,
  type PersonRef,
  type PipelineStage,
} from "@/lib/types/domain";

/**
 * Stage-change control for one application.
 *
 * Spec Sec 5 requires every active application to carry a current stage, an
 * assigned recruiter, a next action, an action owner and a due date — so
 * moving the stage *must* also restate the next action, owner and due date, or
 * the record is momentarily incomplete. That is why this is a small form and
 * not a bare dropdown.
 *
 * All eight interaction states are wired: idle, submitting (`aria-busy`),
 * success, validation error, request error, and the 409 conflict below.
 */

/** Field names deliberately mirror the real PATCH body — see below. */
interface StageChangeInput {
  applicationId: string;
  toStage: ApplicationStage;
  nextAction: string;
  nextActionOwnerId: string;
  /** ISO calendar date. */
  nextActionDueDate: string;
  notes: string;
  /** Optimistic-lock token read with the record (BUILD_PLAN.md Sec 2.4). */
  version: number;
}

/**
 * Pipeline stages are numbered so the dropdown reads as an ordered process;
 * branch outcomes are prefixed instead of numbered, because they are not
 * positions on the line (spec Sec 5, "Alternative outcomes").
 */
const STAGE_OPTIONS = ALL_STAGES.map((value) => {
  const index = PIPELINE_STAGES.indexOf(value as PipelineStage);
  return {
    value,
    label:
      index >= 0
        ? `${index + 1}. ${STAGE_LABELS[value]}`
        : `Outcome — ${STAGE_LABELS[value]}`,
  };
});

type Status =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "success"; stage: ApplicationStage }
  | { phase: "conflict" }
  | { phase: "error"; message: string };

/* ──────────────────────────────────────────────────────────────────────────
 * SWAP POINT — stage transition write
 *
 * TODO(frontend): `PATCH /api/v1/applications/{id}/stage` now exists (it
 * appends the StageHistory row, bumps `version`, and returns 409 on a stale
 * version). Replace the body of this function with:
 *
 *   const { version } = await patchJson(
 *     `/api/v1/applications/${input.applicationId}/stage`,
 *     { version, toStage, notes, nextAction, nextActionOwnerId,
 *       nextActionDueDate },
 *   );
 *
 * `lib/api-client.ts` currently exposes `postJson` only — add a `patchJson`
 * (same body, different method) when wiring this. It already throws
 * `ApiRequestError` carrying `.status`, so the 409 branch in `handleSubmit`
 * below keeps working unchanged.
 *
 * Two contract notes for that swap:
 *   - the route rejects transitions `lib/application-stages.ts` disallows with
 *     a 400 `INVALID_TRANSITION`; this form still offers every stage, so add a
 *     branch that surfaces that message inline (the `error` phase already
 *     renders it).
 *   - `nextActionDueDate` is `z.coerce.date()`, so the `YYYY-MM-DD` string
 *     from the date input is accepted as-is.
 *
 * Until then this simulates latency, and returns a 409 when the demo switch is
 * on so the conflict banner can be reviewed without a second browser session.
 * ────────────────────────────────────────────────────────────────────────── */
async function submitStageChange(
  input: StageChangeInput,
  simulateConflict: boolean,
): Promise<{ version: number }> {
  await new Promise((resolve) => setTimeout(resolve, 550));
  if (simulateConflict) {
    throw new ApiRequestError(
      "This application was changed by someone else after you opened it.",
      409,
      "VERSION_CONFLICT",
    );
  }
  return { version: input.version + 1 };
}

export function StageChangeForm({
  application,
  people,
  onApplied,
}: {
  application: ApplicationSummary;
  /** Recruiters + hiring managers who can own a next action. */
  people: readonly PersonRef[];
  onApplied: (change: {
    stage: ApplicationStage;
    nextAction: string;
    actionOwner: PersonRef;
    dueDate: string;
    version: number;
  }) => void;
}) {
  const router = useRouter();
  const fieldPrefix = useId();

  const [stage, setStage] = useState<string>(application.stage);
  const [nextAction, setNextAction] = useState(application.nextAction);
  const [ownerId, setOwnerId] = useState(application.actionOwner.id);
  const [dueDate, setDueDate] = useState(application.dueDate);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [simulateConflict, setSimulateConflict] = useState(false);

  const submitting = status.phase === "submitting";

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    if (!stage) found.stage = "Choose the stage this application is moving to.";
    if (!nextAction.trim()) {
      found.nextAction =
        "Every active application needs one visible next action — describe what happens next.";
    }
    if (!ownerId) found.owner = "Choose who owns that next action.";
    if (!dueDate) found.dueDate = "Set a due date so the action can be chased.";
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
      const result = await submitStageChange(
        {
          applicationId: application.id,
          toStage: stage as ApplicationStage,
          nextAction: nextAction.trim(),
          nextActionOwnerId: ownerId,
          nextActionDueDate: dueDate,
          notes: note.trim(),
          version: application.version,
        },
        simulateConflict,
      );

      const owner =
        people.find((person) => person.id === ownerId) ??
        application.actionOwner;

      onApplied({
        stage: stage as ApplicationStage,
        nextAction: nextAction.trim(),
        actionOwner: owner,
        dueDate,
        version: result.version,
      });
      setNote("");
      setStatus({ phase: "success", stage: stage as ApplicationStage });
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
            : "The stage change wasn’t saved. Try again.",
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-md">
      {/* Live region is mounted at all times so banners are announced when
          they arrive (DESIGN.md > Accessibility). */}
      <LiveRegion>
        {status.phase === "conflict" && (
          <InlineBanner
            tone="warning"
            title="Someone else changed this application while you had it open"
            onDismiss={() => setStatus({ phase: "idle" })}
            dismissLabel="Dismiss the conflict message"
            actions={
              <>
                <Button
                  variant="secondary"
                  onClick={() => router.refresh()}
                  className="min-h-11"
                >
                  Reload this application
                </Button>
                <span className="font-data text-caption tabular-nums">
                  you have version {application.version}
                </span>
              </>
            }
          >
            Your change wasn’t saved, and nothing was overwritten. Reload to see
            the current stage, then re-apply your change if it still makes
            sense. Everything else on this page still works.
          </InlineBanner>
        )}

        {status.phase === "error" && (
          <InlineBanner
            tone="error"
            title="That stage change wasn’t saved"
            onDismiss={() => setStatus({ phase: "idle" })}
          >
            {status.message}
          </InlineBanner>
        )}

        {status.phase === "success" && (
          <InlineBanner
            tone="success"
            title={`Moved to ${STAGE_LABELS[status.stage]}`}
            onDismiss={() => setStatus({ phase: "idle" })}
          >
            The change is recorded in this application’s stage history, and the
            next action has been reassigned.
          </InlineBanner>
        )}
      </LiveRegion>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <SelectField
          id={`${fieldPrefix}-stage`}
          label="Move to stage"
          required
          disabled={submitting}
          value={stage}
          onChange={setStage}
          error={errors.stage}
          placeholder="Choose a stage…"
          options={STAGE_OPTIONS}
        />

        <SelectField
          id={`${fieldPrefix}-owner`}
          label="Action owner"
          required
          disabled={submitting}
          value={ownerId}
          onChange={setOwnerId}
          error={errors.owner}
          options={people.map((person) => ({
            value: person.id,
            label: person.name,
          }))}
        />

        <TextInputField
          id={`${fieldPrefix}-next-action`}
          label="Next action"
          required
          disabled={submitting}
          value={nextAction}
          onChange={setNextAction}
          error={errors.nextAction}
          hint="One sentence, in the owner’s language."
        />

        <TextInputField
          id={`${fieldPrefix}-due-date`}
          label="Due date"
          type="date"
          required
          disabled={submitting}
          value={dueDate}
          onChange={setDueDate}
          error={errors.dueDate}
          hint={`Today is ${todayIsoDate()}.`}
        />
      </div>

      <TextAreaField
        id={`${fieldPrefix}-note`}
        label="History note"
        rows={2}
        disabled={submitting}
        value={note}
        onChange={setNote}
        hint="Kept on the permanent stage-history record. Internal only — never sent to the candidate."
      />

      <div className="flex flex-wrap items-center gap-md">
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Saving…" : "Save stage change"}
        </Button>
        <span className="font-data text-caption tabular-nums text-muted">
          record version {application.version}
        </span>
      </div>

      {/* TODO(backend): delete this block once the real PATCH lands. It exists
          only so the optimistic-locking banner (BUILD_PLAN.md Sec 5 decision
          #4) can be reviewed without racing two sessions. */}
      <details className="rounded-sm border border-dashed border-border px-md py-sm text-body-sm text-muted">
        <summary className="min-h-11 cursor-pointer list-item py-sm">
          Demo controls (mock data only)
        </summary>
        <label className="flex min-h-11 items-center gap-sm">
          <input
            type="checkbox"
            checked={simulateConflict}
            onChange={(event) => setSimulateConflict(event.target.checked)}
            className="size-4 accent-[var(--accent)]"
          />
          Simulate a concurrent edit — the next save returns 409 and shows the
          conflict banner.
        </label>
      </details>
    </form>
  );
}
