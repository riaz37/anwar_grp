"use server";

import type {
  EvaluationDraftInput,
  InterviewEvaluationRound,
} from "@/lib/types/domain";
import {
  getEvaluationRound,
  resolveViewer,
  writeOwnEvaluation,
} from "./_mock-evaluations";
import { getMockInterview } from "./_mock-interviews";
import { MOCK_CURRENT_USER } from "./_mock-reference";

/**
 * Server actions behind the evaluation form.
 *
 * These exist as server actions rather than as local `async` stubs inside the
 * form component for one specific reason, and it is the same reason the whole
 * feature is shaped the way it is: **submitting an evaluation is what reveals
 * the panel's feedback, and the client must not be the thing that reveals it.**
 *
 * A panelist who has not submitted never receives peer evaluations — not
 * hidden, not blurred, not in a collapsed component: absent from the payload
 * (see `_mock-evaluations.ts`). So when they submit, the newly-visible rows
 * have to come back *from the server*, in the submit response. That is exactly
 * what the real API does too, and it is why `submitEvaluationAction` returns a
 * whole freshly-built round rather than an `{ ok: true }`.
 *
 * SWAP POINT — with the real API these two become `fetch` calls:
 *   saveEvaluationDraftAction -> POST /api/v1/interviews/{id}/evaluations
 *                                { ...fields, submitted: false }
 *   submitEvaluationAction    -> POST /api/v1/interviews/{id}/evaluations
 *                                { ...fields, submitted: true }
 *                                then GET /api/v1/interviews/{id}/evaluations
 *                                for the rows the submit just unblinded, and
 *                                (for summary-eligible roles) GET
 *                                .../evaluation-summary.
 *
 * Both properties this UI assumes are already enforced by that route, verified
 * by reading it: a non-panelist POST is a 403, and a POST against a row that
 * already has `submittedAt` is a 409 `EVALUATION_LOCKED` — rejected before the
 * row is touched, even for an identical re-save.
 *
 * `viewerId` is a parameter only because the mock has no session; with
 * `getSession()` in place it disappears and the panelist identity comes from
 * the session, never from the request body. Trusting a client-supplied
 * panelist id would let anyone write anyone else's evaluation.
 */

function requireViewer(viewerId: string | undefined) {
  return resolveViewer(viewerId) ?? MOCK_CURRENT_USER;
}

function buildRound(
  interviewId: string,
  viewerId: string | undefined,
): InterviewEvaluationRound {
  const interview = getMockInterview(interviewId);
  if (!interview) {
    throw new Error("That interview round no longer exists.");
  }
  return getEvaluationRound(interview, requireViewer(viewerId));
}

export async function saveEvaluationDraftAction(
  input: EvaluationDraftInput,
  viewerId?: string,
): Promise<InterviewEvaluationRound> {
  writeOwnEvaluation(input, requireViewer(viewerId), false);
  return buildRound(input.interviewId, viewerId);
}

export async function submitEvaluationAction(
  input: EvaluationDraftInput,
  viewerId?: string,
): Promise<InterviewEvaluationRound> {
  writeOwnEvaluation(input, requireViewer(viewerId), true);
  return buildRound(input.interviewId, viewerId);
}
