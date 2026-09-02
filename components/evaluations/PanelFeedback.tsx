import { Pill } from "@/components/ui/StatusPill";
import { LockIcon } from "@/components/ui/icons";
import { panelFeedbackTone } from "@/components/ui/tone";
import type {
  EvaluationCriterion,
  PanelFeedbackView,
} from "@/lib/types/domain";
import { EvaluationRecordCard } from "./EvaluationRecordCard";

/**
 * The rest of the panel's feedback for one round — or the reason it is not
 * here yet.
 *
 * Spec Sec 6: "Panel members should not see another interviewer's evaluation
 * until submitting their own." This component is the visible half of that
 * rule; the enforcing half is a WHERE clause
 * (`lib/evaluation-visibility.ts`), mirrored in the mock by
 * `_mock-evaluations.ts`.
 *
 * The gate is real, not cosmetic. In the `BLIND` case the props this component
 * receives contain no peer evaluation at all — `PanelFeedbackView`'s blind
 * variant has no field one could live in, so there is nothing to reveal by
 * unsetting a CSS rule, expanding a collapsed node, or reading the RSC payload
 * in dev-tools. The count below is the only thing that crosses, because a
 * bare count is the one hint the spec's own wording leaves room for.
 */

function CountPill({
  submittedCount,
  totalPanelists,
}: {
  submittedCount: number;
  totalPanelists: number;
}) {
  return (
    <Pill
      tone={panelFeedbackTone(submittedCount, totalPanelists)}
      label={`${submittedCount} of ${totalPanelists} submitted`}
      size="md"
    />
  );
}

function Awaiting({ people }: { people: readonly { id: string; name: string }[] }) {
  if (people.length === 0) return null;
  return (
    <p className="text-body-sm text-warning-ink">
      Still to submit: {people.map((person) => person.name).join(", ")}.
    </p>
  );
}

export function PanelFeedback({
  feedback,
  criteria,
  viewerIsPanelist,
}: {
  feedback: PanelFeedbackView;
  criteria: readonly EvaluationCriterion[];
  /** Changes only the *copy* of the blind state — a panel member who is not on
   *  this round's panel has no evaluation to submit, so telling them to submit
   *  one would be a dead end. The gate itself is identical either way. */
  viewerIsPanelist: boolean;
}) {
  if (feedback.state === "BLIND" && !viewerIsPanelist) {
    return (
      <div className="max-w-[var(--container-form)] rounded-md border border-dashed border-border-strong bg-surface-sunken px-md py-lg lg:px-lg">
        <h4 className="flex items-center gap-sm text-subhead text-text">
          <LockIcon className="shrink-0 text-muted" />
          You are not on this panel
        </h4>
        <p className="mt-sm max-w-[62ch] text-body-sm text-muted">
          Evaluations are visible to the panel that sat the round, and to the
          recruiter coordinating it. If you need this round&rsquo;s feedback,
          ask the assigned recruiter.
        </p>
      </div>
    );
  }

  if (feedback.state === "BLIND") {
    return (
      <div className="max-w-[var(--container-form)] rounded-md border border-dashed border-border-strong bg-surface-sunken px-md py-lg lg:px-lg">
        <div className="flex flex-wrap items-start justify-between gap-md">
          <h4 className="flex items-center gap-sm text-subhead text-text">
            <LockIcon className="shrink-0 text-muted" />
            Submit your evaluation to see the panel&rsquo;s feedback
          </h4>
          <CountPill {...feedback} />
        </div>
        <p className="mt-sm max-w-[62ch] text-body-sm text-muted">
          Your assessment of this candidate has to be your own. Until you
          submit, nothing about what the other panel members scored, wrote or
          recommended is sent to this page — not hidden here, not loaded and
          collapsed. Only the count above crosses.
        </p>
        <p className="mt-sm max-w-[62ch] text-body-sm text-muted">
          The moment you submit, everything they have submitted appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex max-w-[var(--container-form)] flex-col gap-md">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <CountPill
          submittedCount={feedback.submittedCount}
          totalPanelists={feedback.totalPanelists}
        />
        <Awaiting people={feedback.awaiting} />
      </div>

      {feedback.evaluations.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-surface px-md py-lg lg:px-lg">
          <h4 className="text-subhead text-text">
            Nobody else has submitted yet
          </h4>
          <p className="mt-sm max-w-[58ch] text-body-sm text-muted">
            Each panelist&rsquo;s evaluation appears here as they submit it. A
            round with feedback outstanding shows on the recruiter&rsquo;s
            dashboard as overdue, so chasing it is somebody&rsquo;s job
            already.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-md">
          {feedback.evaluations.map((record) => (
            <li key={record.id}>
              <EvaluationRecordCard
                record={record}
                criteria={criteria}
                variant="peer"
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
