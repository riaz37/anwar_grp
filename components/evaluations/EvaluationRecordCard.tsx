import { Pill } from "@/components/ui/StatusPill";
import { LockIcon } from "@/components/ui/icons";
import { OVERALL_RECOMMENDATION_TONE } from "@/components/ui/tone";
import { formatDateTime } from "@/lib/format";
import {
  OVERALL_RECOMMENDATION_LABELS,
  USER_ROLE_LABELS,
  meanScore,
  type EvaluationCriterion,
  type EvaluationRecord,
} from "@/lib/types/domain";
import { ScoreReadout } from "./ScoreScale";

/**
 * A submitted evaluation, rendered read-only.
 *
 * Used for two things that must look different: the viewer's *own* submitted
 * record (locked — the client-side mirror of the server's `submittedAt`
 * immutability lock) and a *peer's* record, which was never editable here in
 * the first place.
 *
 * The locked treatment is deliberately not "the same form with `disabled` on
 * every input". A greyed-out form reads as "temporarily unavailable, try
 * again" and invites people to hunt for the thing that will re-enable it.
 * This renders as a record instead — no inputs in the DOM at all, a stated
 * lock, a timestamp, and a sentence saying what to do if it is wrong.
 */

function FreeText({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h5 className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
        {label}
      </h5>
      <p className="mt-2xs max-w-[62ch] whitespace-pre-line text-body-sm text-text">
        {value.trim() ? value : <span className="text-muted">Not recorded</span>}
      </p>
    </div>
  );
}

export function EvaluationRecordCard({
  record,
  criteria,
  variant,
}: {
  record: EvaluationRecord;
  criteria: readonly EvaluationCriterion[];
  variant: "own-locked" | "peer";
}) {
  const own = variant === "own-locked";
  const average = meanScore(record.scores);
  const scale = criteria[0]?.scoreMax;

  return (
    <article className="overflow-hidden rounded-md border border-border bg-surface">
      {own && (
        <p className="flex items-center gap-sm border-b border-success-soft bg-success-soft px-md py-sm text-body-sm font-semibold text-success-ink">
          <LockIcon className="shrink-0" />
          Submitted and locked
        </p>
      )}

      <div className="px-md py-md lg:px-lg lg:py-lg">
        <header className="flex flex-wrap items-start justify-between gap-md">
          <div className="min-w-0">
            {/* Named even on the viewer's own card: the section above it
                already says "Your evaluation", and repeating that here reads
                as two headings for one thing. */}
            <h4 className="text-subhead text-text">
              {record.panelist.name}
              {own && <span className="font-normal text-muted"> (you)</span>}
            </h4>
            <p className="mt-2xs text-body-sm text-muted">
              {USER_ROLE_LABELS[record.panelistRole]} · {record.templateName}
              {record.submittedAt && (
                <>
                  {" · submitted "}
                  <span className="font-data tabular-nums">
                    {formatDateTime(record.submittedAt)}
                  </span>
                </>
              )}
            </p>
          </div>
          {record.overallRecommendation && (
            <Pill
              tone={OVERALL_RECOMMENDATION_TONE[record.overallRecommendation]}
              label={
                OVERALL_RECOMMENDATION_LABELS[record.overallRecommendation]
              }
              size="md"
            />
          )}
        </header>

        <div className="mt-md">
          <ScoreReadout criteria={criteria} scores={record.scores} />
          {average !== null && scale !== undefined && (
            <p className="mt-sm font-data text-caption tabular-nums text-muted">
              Average across this panelist&rsquo;s scored criteria:{" "}
              {average.toFixed(1)} / {scale}
            </p>
          )}
        </div>

        <div className="mt-lg flex flex-col gap-md border-t border-border pt-md">
          <FreeText
            label="Organisational suitability"
            value={record.organizationalSuitability}
          />
          <FreeText label="Strengths" value={record.strengths} />
          <FreeText label="Concerns" value={record.concerns} />
        </div>

        {own && (
          <p className="mt-lg max-w-[62ch] border-t border-border pt-md text-body-sm text-muted">
            A submitted evaluation is permanent — it is the evidence behind a
            hiring decision, so it is never edited after the fact. If something
            here is wrong, tell the recruiter: they record the correction on the
            application, where it stays traceable.
          </p>
        )}
      </div>
    </article>
  );
}
