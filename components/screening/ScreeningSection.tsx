"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DetailItem, DetailList } from "@/components/ui/DetailList";
import { LiveRegion } from "@/components/ui/InlineBanner";
import { Pill } from "@/components/ui/StatusPill";
import {
  ELIGIBILITY_TONE,
  EVALUATOR_RECOMMENDATION_TONE,
  SCREENING_RECOMMENDATION_TONE,
} from "@/components/ui/tone";
import { DownloadIcon, PaperclipIcon } from "@/components/ui/icons";
import { formatDateTime, formatFileSize } from "@/lib/format";
import {
  ASSESSMENT_ATTENDANCE_LABELS,
  ASSESSMENT_TYPE_LABELS,
  ELIGIBILITY_LABELS,
  EVALUATOR_RECOMMENDATION_LABELS,
  SCREENING_RECOMMENDATION_LABELS,
  TELEPHONE_OUTCOME_LABELS,
  type ScreeningAssessment,
} from "@/lib/types/domain";
import { ScreeningForm } from "./ScreeningForm";

/**
 * Screening & Assessment for one application (spec Sec 6 > Screening and
 * Assessment).
 *
 * Three states: not recorded (an empty state that says what recording it
 * unlocks), recording/editing (the form), and recorded (a read-only summary
 * with an explicit way back into the form). Read-only-by-default is the point
 * — a screening record is evidence behind a stage decision, and a page where
 * every field is a live input invites accidental edits months later.
 */

function scoreLabel(record: ScreeningAssessment): string {
  if (record.assessmentType === "NONE") return "No assessment for this role";
  if (record.assessmentScore === null) return "Not marked yet";
  const percent = Math.round(
    (record.assessmentScore / record.assessmentMaxScore) * 100,
  );
  return `${record.assessmentScore} / ${record.assessmentMaxScore} · ${percent}%`;
}

export function ScreeningSection({
  applicationId,
  screening: record,
  onSaved,
}: {
  applicationId: string;
  screening: ScreeningAssessment | null;
  onSaved: (record: ScreeningAssessment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  if (editing) {
    return (
      <ScreeningForm
        applicationId={applicationId}
        existing={record}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => {
          onSaved(saved);
          setEditing(false);
          setJustSaved(true);
        }}
      />
    );
  }

  if (!record) {
    return (
      <div className="max-w-[var(--container-form)] rounded-md border border-dashed border-border bg-surface px-lg py-xl">
        <h4 className="text-subhead text-text">Nothing recorded yet</h4>
        <p className="mt-sm max-w-[58ch] text-body-sm text-muted">
          Screening captures the eligibility call and, where the role needs one,
          the assessment result. It is what the interview panel reads before
          meeting the candidate, and what a later approval decision is
          justified against.
        </p>
        <div className="mt-lg">
          <Button variant="primary" onClick={() => setEditing(true)}>
            Record screening
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[var(--container-form)] flex-col gap-lg">
      <LiveRegion>
        {justSaved && (
          <p className="rounded-sm border border-success-soft bg-success-soft px-md py-sm text-body-sm text-success-ink">
            Screening record saved.
          </p>
        )}
      </LiveRegion>

      <div className="flex flex-wrap items-start justify-between gap-md">
        <p className="text-body-sm text-muted">
          Recorded by {record.recordedBy.name} on{" "}
          <span className="font-data tabular-nums">
            {formatDateTime(record.recordedAt)}
          </span>
          {record.updatedAt !== record.recordedAt && (
            <>
              {" · last edited "}
              <span className="font-data tabular-nums">
                {formatDateTime(record.updatedAt)}
              </span>
            </>
          )}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setJustSaved(false);
            setEditing(true);
          }}
        >
          Edit record
        </Button>
      </div>

      <DetailList columns={2}>
        <DetailItem label="Eligibility">
          <Pill
            tone={ELIGIBILITY_TONE[record.eligibility]}
            label={ELIGIBILITY_LABELS[record.eligibility]}
            size="md"
          />
        </DetailItem>
        <DetailItem label="Recommendation">
          <Pill
            tone={SCREENING_RECOMMENDATION_TONE[record.recommendation]}
            label={SCREENING_RECOMMENDATION_LABELS[record.recommendation]}
            size="md"
          />
        </DetailItem>
        <DetailItem label="Telephone assessment">
          {TELEPHONE_OUTCOME_LABELS[record.telephoneOutcome]}
        </DetailItem>
        <DetailItem label="Availability">
          {record.availability || "—"}
        </DetailItem>
        <DetailItem label="Screening comments" span>
          <p className="max-w-[62ch] whitespace-pre-line">
            {record.screeningComments || "—"}
          </p>
        </DetailItem>
      </DetailList>

      <div className="border-t border-border pt-lg">
        <h4 className="text-body font-semibold text-text">Assessment</h4>
        <div className="mt-md">
          <DetailList columns={2}>
            <DetailItem label="Type">
              {ASSESSMENT_TYPE_LABELS[record.assessmentType]}
            </DetailItem>
            <DetailItem label="Attendance">
              {ASSESSMENT_ATTENDANCE_LABELS[record.attendance]}
            </DetailItem>
            <DetailItem label="Score" numeric>
              {scoreLabel(record)}
            </DetailItem>
            <DetailItem label="Evaluator recommendation">
              {record.evaluatorRecommendation ? (
                <Pill
                  tone={
                    EVALUATOR_RECOMMENDATION_TONE[record.evaluatorRecommendation]
                  }
                  label={
                    EVALUATOR_RECOMMENDATION_LABELS[
                      record.evaluatorRecommendation
                    ]
                  }
                  size="md"
                />
              ) : (
                <span className="text-muted">Not signed off yet</span>
              )}
            </DetailItem>
            {record.evaluatorComments && (
              <DetailItem label="Evaluator comments" span>
                <p className="max-w-[62ch] whitespace-pre-line">
                  {record.evaluatorComments}
                </p>
              </DetailItem>
            )}
          </DetailList>
        </div>
      </div>

      <div className="border-t border-border pt-lg">
        <h4 className="text-body font-semibold text-text">
          Assessment documents
        </h4>
        {record.documents.length === 0 ? (
          <p className="mt-sm text-body-sm text-muted">
            None attached. Open the record to add a scanned answer or marking
            sheet.
          </p>
        ) : (
          <ul className="mt-md flex flex-col divide-y divide-border border-y border-border">
            {record.documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center gap-md py-sm"
              >
                <PaperclipIcon className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="break-all text-body-sm font-medium text-text">
                    {document.fileName}
                  </p>
                  <p className="font-data text-caption tabular-nums text-muted">
                    {formatFileSize(document.sizeBytes)} · uploaded{" "}
                    {formatDateTime(document.uploadedAt)} by{" "}
                    {document.uploadedBy}
                  </p>
                </div>
                {/* Presign-download is real (Phase 1). It fails closed until a
                    `SCREENING_ASSESSMENT` download-authz checker is registered
                    — see the TODO block at the bottom of this file. */}
                <a
                  href={`/api/v1/documents/${document.id}/presign-download`}
                  className="inline-flex min-h-11 items-center gap-xs rounded-sm px-sm text-body-sm font-medium text-accent-ink underline decoration-transparent underline-offset-2 transition-colors duration-100 ease-move hover:decoration-current"
                >
                  <DownloadIcon />
                  Download
                  <span className="sr-only"> {document.fileName}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * BACKEND HAND-OFF — screening documents
 *
 * TODO(backend): register a `DocumentDownloadAuthzChecker` for the
 * `SCREENING_ASSESSMENT` owner type, the same way Phase 2 registered
 * `REQUISITION` / `CANDIDATE` / `APPLICATION` in `lib/phase2-document-authz.ts`
 * via `instrumentation.ts`. Until that exists, `lib/documents.ts` fails closed
 * and the Download links above return 403 — correct behaviour, but it means
 * assessment documents are effectively write-only.
 *
 * The rule should be: whoever can read the owning application can read its
 * assessment documents, *except* that raw scores and marked papers are
 * confidential fields under BUILD_PLAN.md Sec 2.5 — so a panelist who has not
 * yet submitted their own evaluation should not be able to pull the marking
 * sheet either.
 * ────────────────────────────────────────────────────────────────────────── */
