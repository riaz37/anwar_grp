"use server";

import type {
  ApplicationApproval,
  ApprovalDecisionInput,
} from "@/lib/types/approvals";
import {
  ApprovalMockError,
  decideApprovalStep,
  getApplicationApproval,
  startApprovalRequest,
} from "./_mock-approvals";
import { resolveViewer } from "./_mock-evaluations";
import { MOCK_CURRENT_USER } from "./_mock-reference";

/**
 * Server actions behind the Decision tab's two writes.
 *
 * They are server actions rather than local `async` stubs inside the components
 * for the same reason the evaluation actions are (`_approval-actions.ts`'s
 * sibling, `_evaluation-actions.ts`): **who may decide is an authorization
 * answer, and the client must not be the thing that answers it.** Both actions
 * return the whole re-resolved `ApplicationApproval`, not an `{ ok: true }`,
 * because a decision changes `viewerDecidableStepId` for everyone — including
 * the person who just made it, who must immediately stop being offered the
 * action.
 *
 * SWAP POINT — with the real API these two become `fetch` calls:
 *   initiateApprovalAction -> POST /api/v1/applications/{id}/approval-request
 *                             (no body)
 *   decideApprovalAction   -> POST /api/v1/approval-requests/{id}/decide
 *                             { stepIndex, decision, comments }
 *                             — note `stepIndex` is 0-based server-side while
 *                               `ApprovalStep.order` is 1-based here; see the
 *                               contract-gap list in `_mock-approvals.ts`.
 *   then, in both cases, re-GET the approval view for the caller so the
 *   returned `viewerDecidableStepId` comes from the server's role check rather
 *   than a client-side re-derivation.
 *
 * Both routes return the whole `ApprovalRequest` with every decision row, so
 * neither action needs to recompute step states from a partial response — the
 * `applyDecision()` reducer in `lib/types/approvals.ts` exists for the mock
 * write path and for the derivation described in `_mock-approvals.ts` gap 4,
 * not to second-guess the API.
 *
 * `viewerId` is a parameter only because the mock has no session; with
 * `getSession()` in place it disappears and the approver identity comes from
 * the session, never from the request body. Trusting a client-supplied approver
 * id would let anyone sign off as anyone.
 *
 * The thrown `Error.message` is what the forms render, so every message here
 * has to be readable by a recruiter — see `ApprovalMockError`'s messages in
 * `_mock-approvals.ts`, which are the same strings the API's `error.message`
 * should carry.
 */

export interface ApprovalActionResult {
  approval: ApplicationApproval;
}

function requireViewer(viewerId: string | undefined) {
  return resolveViewer(viewerId) ?? MOCK_CURRENT_USER;
}

function resolve(
  application: { id: string; requisitionId: string },
  viewerId: string | undefined,
): ApprovalActionResult {
  const approval = getApplicationApproval(application, requireViewer(viewerId));
  if (!approval) {
    throw new Error("That application no longer exists.");
  }
  return { approval };
}

export async function initiateApprovalAction(
  application: { id: string; requisitionId: string },
  viewerId?: string,
): Promise<ApprovalActionResult> {
  try {
    startApprovalRequest(application, requireViewer(viewerId));
  } catch (error) {
    throw new Error(
      error instanceof ApprovalMockError
        ? error.message
        : "The approval request wasn’t started. Try again.",
    );
  }
  return resolve(application, viewerId);
}

export async function decideApprovalAction(
  application: { id: string; requisitionId: string },
  input: ApprovalDecisionInput,
  viewerId?: string,
): Promise<ApprovalActionResult> {
  try {
    decideApprovalStep(input, requireViewer(viewerId));
  } catch (error) {
    throw new Error(
      error instanceof ApprovalMockError
        ? error.message
        : "That decision wasn’t recorded. Try again.",
    );
  }
  return resolve(application, viewerId);
}
