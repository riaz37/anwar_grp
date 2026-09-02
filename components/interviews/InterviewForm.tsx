"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxGroupField, RadioGroupField } from "@/components/ui/Choice";
import {
  SelectField,
  TextAreaField,
  TextInputField,
} from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { ApiRequestError } from "@/lib/api-client";
import { todayIsoDate } from "@/lib/format";
import {
  INTERVIEW_MODE_LABELS,
  INTERVIEW_MODES,
  type EvaluationFormRef,
  type InterviewMode,
  type InterviewRound,
  type PersonRef,
} from "@/lib/types/domain";

/**
 * Schedule or edit one interview round (spec Sec 6 > Interview Scheduling:
 * "Date, time, duration, location, or online link", "Interview-panel
 * assignment", "Evaluation-form assignment", "Candidate instructions").
 *
 * Date and time are *not* editable here once the round exists — moving a
 * booked interview goes through the reschedule flow instead, because the spec
 * requires the rescheduling history to be visible and a silent edit would
 * leave no history to show. The form says so rather than just disabling the
 * fields with no explanation.
 */

const MODE_DESCRIPTIONS: Record<InterviewMode, string> = {
  IN_PERSON: "The candidate travels to an Anwar Group location.",
  ONLINE: "A video call the candidate joins from a link.",
};

const DURATION_PRESETS = [30, 45, 60, 90, 120];

/* ──────────────────────────────────────────────────────────────────────────
 * SWAP POINT — interview scheduling write
 *
 * TODO(backend):
 *   schedule  POST  /api/v1/applications/{applicationId}/interviews
 *   edit      PATCH /api/v1/interviews/{id}          (+ `version`)
 *
 * Body is `InterviewInput` below. Two things the route has to own that this
 * form cannot:
 *   - `roundNumber` — assigned server-side from the existing rounds on the
 *     application, inside the same transaction as the insert. Computing it on
 *     the client races two recruiters into two "round 2"s.
 *   - panel-availability conflict detection — "is any of these five people
 *     already booked at 10:30 on Sunday" is a query, not a client concern. The
 *     route should return a 409 with the clashing panelists so this form can
 *     surface them inline rather than as a generic failure.
 * ────────────────────────────────────────────────────────────────────────── */
interface InterviewInput {
  applicationId: string;
  interviewId: string | null;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  mode: InterviewMode;
  location: string | null;
  onlineLink: string | null;
  panelIds: string[];
  evaluationFormId: string | null;
  candidateInstructions: string;
  version: number | null;
}

async function submitInterview(
  input: InterviewInput,
): Promise<{ id: string; roundNumber: number; version: number }> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return {
    id: input.interviewId ?? `int_local_${Date.now()}`,
    roundNumber: 0, // replaced by the caller's local numbering; see the note above.
    version: (input.version ?? 0) + 1,
  };
}

type Status =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "error"; message: string };

export function InterviewForm({
  applicationId,
  existing,
  nextRoundNumber,
  panelMembers,
  evaluationForms,
  onSaved,
  onCancel,
}: {
  applicationId: string;
  existing: InterviewRound | null;
  nextRoundNumber: number;
  panelMembers: readonly (PersonRef & { role: string })[];
  evaluationForms: readonly EvaluationFormRef[];
  onSaved: (round: InterviewRound) => void;
  onCancel: () => void;
}) {
  const prefix = useId();

  const [title, setTitle] = useState(existing?.title ?? "");
  const [date, setDate] = useState(existing?.scheduledDate ?? "");
  const [time, setTime] = useState(existing?.scheduledTime ?? "");
  const [duration, setDuration] = useState(
    String(existing?.durationMinutes ?? 45),
  );
  const [mode, setMode] = useState<string>(existing?.mode ?? "IN_PERSON");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [onlineLink, setOnlineLink] = useState(existing?.onlineLink ?? "");
  const [panelIds, setPanelIds] = useState<string[]>(
    existing?.panel.map((person) => person.id) ?? [],
  );
  const [evaluationFormId, setEvaluationFormId] = useState(
    existing?.evaluationFormId ?? "",
  );
  const [instructions, setInstructions] = useState(
    existing?.candidateInstructions ?? "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ phase: "idle" });

  const submitting = status.phase === "submitting";
  const online = mode === "ONLINE";

  /* Presets cover every round Anwar Group actually books; an existing round
     saved at some other length keeps its own value rather than being silently
     snapped to the nearest preset on the next edit. */
  const durationMinuteOptions = DURATION_PRESETS.includes(Number(duration))
    ? DURATION_PRESETS
    : [...DURATION_PRESETS, Number(duration)].sort((a, b) => a - b);
  const durationOptions = durationMinuteOptions
    .filter((minutes) => Number.isFinite(minutes) && minutes > 0)
    .map((minutes) => ({
      value: String(minutes),
      label:
        minutes < 60
          ? `${minutes} minutes`
          : minutes % 60 === 0
            ? `${minutes / 60} hour${minutes === 60 ? "" : "s"}`
            : `${Math.floor(minutes / 60)} h ${minutes % 60} min`,
    }));

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    if (!title.trim()) {
      found.title = "Name the round, e.g. “Technical round”.";
    }
    if (!existing) {
      if (!date) found.date = "Pick the interview date.";
      if (!time) found.time = "Pick a start time.";
    }
    const minutes = Number(duration);
    if (!duration || Number.isNaN(minutes) || minutes < 5) {
      found.duration = "Give a duration of at least 5 minutes.";
    }
    if (online) {
      if (!onlineLink.trim()) {
        found.onlineLink = "Add the joining link the candidate will use.";
      } else if (!/^https?:\/\//i.test(onlineLink.trim())) {
        found.onlineLink = "Links must start with http:// or https://.";
      }
    } else if (!location.trim()) {
      found.location = "Say where the candidate should go.";
    }
    if (panelIds.length === 0) {
      found.panel = "Assign at least one panel member.";
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
      const result = await submitInterview({
        applicationId,
        interviewId: existing?.id ?? null,
        title: title.trim(),
        scheduledDate: existing ? existing.scheduledDate : date,
        scheduledTime: existing ? existing.scheduledTime : time,
        durationMinutes: Number(duration),
        mode: mode as InterviewMode,
        location: online ? null : location.trim(),
        onlineLink: online ? onlineLink.trim() : null,
        panelIds,
        evaluationFormId: evaluationFormId || null,
        candidateInstructions: instructions.trim(),
        version: existing?.version ?? null,
      });

      const now = new Date().toISOString();
      onSaved({
        id: result.id,
        applicationId,
        roundNumber: existing?.roundNumber ?? nextRoundNumber,
        title: title.trim(),
        scheduledDate: existing ? existing.scheduledDate : date,
        scheduledTime: existing ? existing.scheduledTime : time,
        durationMinutes: Number(duration),
        mode: mode as InterviewMode,
        location: online ? null : location.trim(),
        onlineLink: online ? onlineLink.trim() : null,
        panel: panelIds.map(
          (id) =>
            panelMembers.find((person) => person.id === id) ?? {
              id,
              name: "—",
            },
        ),
        evaluationFormId: evaluationFormId || null,
        evaluationFormName:
          evaluationForms.find((form) => form.id === evaluationFormId)?.name ??
          null,
        candidateInstructions: instructions.trim(),
        status: existing?.status ?? "SCHEDULED",
        rescheduleHistory: existing?.rescheduleHistory ?? [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        version: result.version,
      });
    } catch (error) {
      setStatus({
        phase: "error",
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : "That interview wasn’t saved. Try again.",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex max-w-[var(--container-form)] flex-col gap-lg rounded-md border border-border bg-surface px-md py-lg lg:px-lg"
    >
      <div>
        <h4 className="text-subhead text-text">
          {existing
            ? `Edit round ${existing.roundNumber} — ${existing.title}`
            : `Schedule round ${nextRoundNumber}`}
        </h4>
        <p className="mt-2xs max-w-[58ch] text-body-sm text-muted">
          {existing
            ? "Date and time are changed through Reschedule, so the reason is recorded and the change stays visible in this round’s history."
            : "Nothing is sent to the candidate by scheduling this. Invitations are drafted, approved and sent from the Messages tab."}
        </p>
      </div>

      <LiveRegion>
        {status.phase === "error" && (
          <InlineBanner
            tone="error"
            title="That interview wasn’t saved"
            onDismiss={() => setStatus({ phase: "idle" })}
          >
            {status.message}
          </InlineBanner>
        )}
      </LiveRegion>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <TextInputField
          id={`${prefix}-title`}
          label="Round name"
          required
          disabled={submitting}
          value={title}
          onChange={setTitle}
          error={errors.title}
          placeholder="Technical round"
        />
        <SelectField
          id={`${prefix}-duration`}
          label="Duration"
          required
          disabled={submitting}
          value={duration}
          onChange={setDuration}
          error={errors.duration}
          options={durationOptions}
        />
        {!existing && (
          <>
            <TextInputField
              id={`${prefix}-date`}
              label="Date"
              type="date"
              required
              disabled={submitting}
              value={date}
              onChange={setDate}
              error={errors.date}
              hint={`Today is ${todayIsoDate()}.`}
            />
            <TimeField
              id={`${prefix}-time`}
              label="Start time"
              value={time}
              onChange={setTime}
              error={errors.time}
              disabled={submitting}
            />
          </>
        )}
      </div>

      <RadioGroupField
        legend="Where the interview happens"
        name={`${prefix}-mode`}
        required
        disabled={submitting}
        value={mode}
        onChange={setMode}
        options={INTERVIEW_MODES.map((value) => ({
          value,
          label: INTERVIEW_MODE_LABELS[value],
          description: MODE_DESCRIPTIONS[value],
        }))}
      />

      {online ? (
        <TextInputField
          id={`${prefix}-link`}
          label="Online link"
          required
          disabled={submitting}
          value={onlineLink}
          onChange={setOnlineLink}
          error={errors.onlineLink}
          placeholder="https://meet.example.com/…"
          hint="Goes into the invitation message. Check it works before approving that message."
        />
      ) : (
        <TextInputField
          id={`${prefix}-location`}
          label="Location"
          required
          disabled={submitting}
          value={location}
          onChange={setLocation}
          error={errors.location}
          placeholder="Head office, Gulshan-1 — Meeting room 4B"
          hint="Building, floor and room. The candidate will read this at reception."
        />
      )}

      <CheckboxGroupField
        legend="Interview panel"
        required
        disabled={submitting}
        values={panelIds}
        onChange={setPanelIds}
        error={errors.panel}
        emptyLabel="Nobody assigned"
        hint="Each panel member gets their own evaluation form, and cannot see another’s until they submit their own."
        options={panelMembers.map((person) => ({
          value: person.id,
          label: person.name,
          description: person.role,
          group: person.role,
        }))}
      />

      <div>
        <SelectField
          id={`${prefix}-eval-form`}
          label="Evaluation form"
          disabled={submitting}
          value={evaluationFormId}
          onChange={setEvaluationFormId}
          placeholder="Decide later"
          options={evaluationForms.map((form) => ({
            value: form.id,
            label: form.name,
          }))}
        />
        {/* Phase 4 forward-declaration, said plainly rather than left to be
            discovered. BUILD_PLAN.md Sec 3.1 item 4. */}
        <p className="mt-sm rounded-sm border border-dashed border-border bg-surface-sunken px-md py-sm text-caption text-muted">
          Evaluation forms arrive in a later release. Choosing one here records
          which form the panel should be given — it does not create or open the
          form yet.
          {evaluationFormId && (
            <>
              {" "}
              <span className="text-text">
                {
                  evaluationForms.find((form) => form.id === evaluationFormId)
                    ?.description
                }
              </span>
            </>
          )}
        </p>
      </div>

      <TextAreaField
        id={`${prefix}-instructions`}
        label="Candidate instructions"
        rows={3}
        disabled={submitting}
        value={instructions}
        onChange={setInstructions}
        hint="Written for the candidate — this text is merged into the invitation message, so keep it free of anything internal."
      />

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
              : "Schedule this round"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * Native time input. Not folded into `Field.tsx`'s `TextInputField` union
 * because `type="time"` needs `step` and the tabular face for the same reason
 * dates do, and widening that union is a change to a Phase 2 primitive other
 * forms depend on.
 */
function TimeField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-2xs">
      <label htmlFor={id} className="text-body-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="time"
        step={300}
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`min-h-11 w-full rounded-sm border bg-surface px-sm py-sm font-data text-body tabular-nums text-text transition-colors duration-100 ease-move hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60 ${
          error ? "border-error" : "border-border"
        }`}
      />
      {hint && (
        <p id={hintId} className="text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-body-sm text-error-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export { TimeField };
