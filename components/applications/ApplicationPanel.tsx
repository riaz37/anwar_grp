"use client";

import Link from "next/link";
import { DetailItem, DetailList } from "@/components/ui/DetailList";
import { dueLabel, urgencyOf } from "@/components/tasks/types";
import { daysSince, formatDate, formatDateTime } from "@/lib/format";
import {
  STAGE_LABELS,
  type ApplicationStage,
  type ApplicationSummary,
  type PersonRef,
  type StageHistoryEntry,
} from "@/lib/types/domain";
import { StageChangeForm } from "./StageChangeForm";
import { lastPipelineStageOf, StagePipeline } from "./StagePipeline";

/**
 * Everything about one application.
 *
 * Spec Sec 5 makes four fields mandatory on every application view — current
 * stage, assigned recruiter, next action, action owner, due date. They are
 * rendered first, above the fold of the panel, before history or controls, and
 * `ApplicationSummary` types all of them as required so none can go missing.
 */

const URGENCY_TEXT = {
  overdue: "text-error-ink",
  today: "text-warning-ink",
  upcoming: "text-text",
} as const;

export function ApplicationPanel({
  application,
  history,
  people,
  onApplied,
}: {
  application: ApplicationSummary;
  history: StageHistoryEntry[];
  people: readonly PersonRef[];
  onApplied: (change: {
    stage: ApplicationStage;
    nextAction: string;
    actionOwner: PersonRef;
    dueDate: string;
    version: number;
  }) => void;
}) {
  const urgency = urgencyOf(application.dueDate);
  const inStageDays = daysSince(application.stageChangedAt);

  return (
    <div className="flex flex-col gap-xl">
      <section aria-label="Current position in the pipeline">
        <StagePipeline
          stage={application.stage}
          lastPipelineStage={lastPipelineStageOf(
            history.map((entry) => entry.toStage),
          )}
          stageChangedLabel={
            inStageDays === 0
              ? "moved today"
              : `${inStageDays} day${inStageDays === 1 ? "" : "s"} in this stage`
          }
        />
      </section>

      {/* The four spec-mandated fields, plus the requisition they belong to. */}
      <DetailList columns={2}>
        <DetailItem label="Requisition">
          <Link
            href={`/requisitions/${application.requisitionId}`}
            className="link"
          >
            <span className="font-data tabular-nums">
              {application.requisitionRef}
            </span>{" "}
            — {application.requisitionTitle}
          </Link>
        </DetailItem>
        <DetailItem label="Assigned recruiter">
          {application.assignedRecruiter.name}
        </DetailItem>
        <DetailItem label="Next action" span>
          {application.nextAction}
        </DetailItem>
        <DetailItem label="Action owner">
          {application.actionOwner.name}
        </DetailItem>
        <DetailItem label="Due date" numeric>
          <span className={URGENCY_TEXT[urgency]}>
            {formatDate(application.dueDate)}
          </span>
          <span className="ml-sm font-sans text-body-sm text-muted">
            {dueLabel(application.dueDate)}
          </span>
        </DetailItem>
      </DetailList>

      <section aria-labelledby={`${application.id}-change-heading`}>
        <h3
          id={`${application.id}-change-heading`}
          className="text-subhead text-text"
        >
          Move this application
        </h3>
        <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
          Changing the stage also restates the next action, its owner and its
          due date, so the application never sits without one. Every change is
          written to the permanent history below.
        </p>
        <div className="mt-md">
          <StageChangeForm
            application={application}
            people={people}
            onApplied={onApplied}
          />
        </div>
      </section>

      <section aria-labelledby={`${application.id}-history-heading`}>
        <h3
          id={`${application.id}-history-heading`}
          className="text-subhead text-text"
        >
          Stage history
        </h3>
        <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
          Append-only. Entries are never edited or removed.
        </p>
        <ol className="mt-md flex flex-col divide-y divide-border border-t border-border">
          {[...history].reverse().map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline gap-x-md gap-y-2xs py-sm"
            >
              <span className="font-data text-body-sm tabular-nums text-muted">
                {formatDateTime(entry.changedAt)}
              </span>
              <span className="text-body-sm text-text">
                {entry.fromStage
                  ? `${STAGE_LABELS[entry.fromStage]} → ${STAGE_LABELS[entry.toStage]}`
                  : `Created at ${STAGE_LABELS[entry.toStage]}`}
              </span>
              <span className="text-body-sm text-muted">
                by {entry.changedBy.name}
              </span>
              {entry.note && (
                <span className="w-full max-w-[68ch] text-body-sm text-muted">
                  {entry.note}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
