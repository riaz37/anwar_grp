import "server-only";
import {
  Application,
  ApprovalChainConfig,
  ApprovalChainStep,
  ApprovalDecisionStatus,
  ApprovalRequest,
  ApprovalRequestStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "./prisma";
import { writeAudit } from "./audit";

/**
 * Approval-chain resolution and progression logic (BUILD_PLAN.md Sec 2.9,
 * mirroring lib/requisition-status.ts's "one file owns the transition
 * graph" style). This governs the candidate/application SELECTION-
 * DECISION approval chain — a separate flow from
 * Requisition.approvalStatus (Phase 2's requisition approval, already
 * built; see that model's own status graph in
 * lib/requisition-status.ts). Do not confuse the two.
 *
 * Deliberately NOT a general-purpose workflow engine (BUILD_PLAN's
 * "Features intentionally excluded" list): no conditional branching, no
 * dynamic step insertion, no per-request customization of the chain.
 * The chain is exactly the ordered list of approver roles resolved from
 * ApprovalChainConfig at initiation time.
 */

export class ApprovalChainError extends Error {
  code: string;
  httpStatus: number;

  constructor(message: string, code: string, httpStatus: number) {
    super(message);
    this.name = "ApprovalChainError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type ApprovalChainConfigWithSteps = ApprovalChainConfig & {
  steps: ApprovalChainStep[];
};

/**
 * Resolves the applicable ApprovalChainConfig for an application, keyed
 * off its requisition's (businessUnitId, departmentId, positionLevel) —
 * per BUILD_PLAN.md Sec 2.9's locked design. Returns null if no active
 * chain is configured for that triple (a real, expected "unconfigured
 * chain" case — callers must surface this to the user, not treat it as
 * a 500).
 */
export async function resolveChainForApplication(
  application: Pick<Application, "id" | "requisitionId">,
): Promise<ApprovalChainConfigWithSteps | null> {
  const requisition = await prisma.requisition.findUnique({
    where: { id: application.requisitionId },
    select: { businessUnitId: true, departmentId: true, positionLevel: true },
  });
  if (!requisition) {
    throw new ApprovalChainError(
      "The application's requisition could not be found.",
      "NOT_FOUND",
      404,
    );
  }

  const chain = await prisma.approvalChainConfig.findFirst({
    where: {
      businessUnitId: requisition.businessUnitId,
      departmentId: requisition.departmentId,
      positionLevel: requisition.positionLevel,
      isActive: true,
    },
    include: { steps: { orderBy: { sequence: "asc" } } },
  });

  return chain;
}

/**
 * Initiates an ApprovalRequest for an application: resolves the
 * applicable chain, then creates the ApprovalRequest + ALL
 * ApprovalDecision rows for every step UPFRONT (not lazily as each step
 * is reached) — see prisma/schema.prisma's ApprovalDecision doc comment
 * for the full reasoning (PDF's "Decisions and Approvals" visibility
 * language argues for "step 3 of 5, waiting on Dept Head" being
 * queryable the instant the request is initiated).
 *
 * Throws ApprovalChainError("NO_CHAIN_CONFIGURED", 400) if no active
 * chain resolves for this application's business unit/department/
 * position level — callers must surface this as a clear, actionable
 * error, not a generic failure.
 */
export async function initiateApprovalRequest(
  applicationId: string,
  initiatedById: string,
): Promise<ApprovalRequest> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!application) {
    throw new ApprovalChainError("Application not found.", "NOT_FOUND", 404);
  }

  const chain = await resolveChainForApplication(application);
  if (!chain) {
    throw new ApprovalChainError(
      "No approval chain is configured for this application's business unit, department, and position level. Configure an ApprovalChainConfig before initiating an approval request.",
      "NO_CHAIN_CONFIGURED",
      400,
    );
  }
  if (chain.steps.length === 0) {
    throw new ApprovalChainError(
      "The resolved approval chain has no steps configured.",
      "NO_CHAIN_CONFIGURED",
      400,
    );
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.approvalRequest.create({
      data: {
        applicationId,
        chainConfigId: chain.id,
        currentStepIndex: 0,
        status: ApprovalRequestStatus.IN_PROGRESS,
        initiatedById,
      },
    });

    await tx.approvalDecision.createMany({
      data: chain.steps.map((step) => ({
        approvalRequestId: created.id,
        stepIndex: step.sequence,
        approverRole: step.approverRole,
        decision: ApprovalDecisionStatus.PENDING,
      })),
    });

    return created;
  });

  await writeAudit({
    actorId: initiatedById,
    action: "APPROVAL_REQUEST_INITIATE",
    entityType: "ApprovalRequest",
    entityId: request.id,
    metadata: {
      applicationId,
      chainConfigId: chain.id,
      stepCount: chain.steps.length,
    },
  });

  return request;
}

export interface RecordDecisionInput {
  approvalRequestId: string;
  stepIndex: number;
  decidedById: string;
  decidedByRole: Role;
  decision: "APPROVED" | "REJECTED";
  comments?: string | null;
}

/**
 * Records a decision at a given step.
 *
 * Out-of-order-decision policy (documented design choice): SEQUENTIAL
 * ONLY — a decision may only be recorded for the step that currently
 * matches ApprovalRequest.currentStepIndex. This is the safer default
 * matching Sec 2.9's "ordered list of approver roles" — an approver at
 * step 3 approving before step 1's approver has acted would silently
 * undermine the ordering the config exists to enforce, and there's no
 * requirement in the PDF calling for out-of-order/parallel approval.
 *
 * Validates the decider actually holds the snapshotted approverRole for
 * that step. On REJECTED, the whole ApprovalRequest is marked REJECTED
 * immediately — a single rejection ends the chain; later steps are never
 * evaluated (their ApprovalDecision rows stay PENDING, which is itself
 * informative: "never reached"). On APPROVED, currentStepIndex advances;
 * if that was the last step, the ApprovalRequest is marked APPROVED.
 */
export async function recordDecision(
  input: RecordDecisionInput,
): Promise<ApprovalRequest> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: input.approvalRequestId },
    include: { decisions: { orderBy: { stepIndex: "asc" } } },
  });
  if (!request) {
    throw new ApprovalChainError(
      "Approval request not found.",
      "NOT_FOUND",
      404,
    );
  }

  if (
    request.status !== ApprovalRequestStatus.PENDING &&
    request.status !== ApprovalRequestStatus.IN_PROGRESS
  ) {
    throw new ApprovalChainError(
      `This approval request is already ${request.status} and cannot accept further decisions.`,
      "REQUEST_CLOSED",
      400,
    );
  }

  if (input.stepIndex !== request.currentStepIndex) {
    throw new ApprovalChainError(
      `It is not this step's turn — the request is currently at step ${request.currentStepIndex}.`,
      "NOT_CURRENT_STEP",
      409,
    );
  }

  const decisionRow = request.decisions.find(
    (d) => d.stepIndex === input.stepIndex,
  );
  if (!decisionRow) {
    throw new ApprovalChainError(
      "No decision row exists for this step.",
      "NOT_FOUND",
      404,
    );
  }
  if (decisionRow.decision !== ApprovalDecisionStatus.PENDING) {
    throw new ApprovalChainError(
      "This step has already been decided.",
      "ALREADY_DECIDED",
      400,
    );
  }

  if (decisionRow.approverRole !== input.decidedByRole) {
    throw new ApprovalChainError(
      `Step ${input.stepIndex} requires approval from role ${decisionRow.approverRole}.`,
      "WRONG_ROLE",
      403,
    );
  }

  const isLastStep = input.stepIndex === request.decisions.length - 1;
  const newDecisionStatus =
    input.decision === "APPROVED"
      ? ApprovalDecisionStatus.APPROVED
      : ApprovalDecisionStatus.REJECTED;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.approvalDecision.update({
      where: { id: decisionRow.id },
      data: {
        decision: newDecisionStatus,
        decidedById: input.decidedById,
        comments: input.comments ?? null,
        decidedAt: new Date(),
      },
    });

    const nextStatus: ApprovalRequestStatus =
      input.decision === "REJECTED"
        ? ApprovalRequestStatus.REJECTED
        : isLastStep
          ? ApprovalRequestStatus.APPROVED
          : ApprovalRequestStatus.IN_PROGRESS;

    return tx.approvalRequest.update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        // Only advance the step pointer on approval — a rejection ends
        // the chain outright, so there is no "next step" to point at.
        currentStepIndex:
          input.decision === "APPROVED"
            ? request.currentStepIndex + 1
            : request.currentStepIndex,
      },
    });
  });

  await writeAudit({
    actorId: input.decidedById,
    action:
      input.decision === "APPROVED"
        ? "APPROVAL_STEP_APPROVE"
        : "APPROVAL_STEP_REJECT",
    entityType: "ApprovalRequest",
    entityId: request.id,
    metadata: {
      stepIndex: input.stepIndex,
      approverRole: decisionRow.approverRole,
      resultingStatus: updated.status,
    },
  });

  return updated;
}

/** Roles allowed to create/manage ApprovalChainConfig — org configuration. */
export const APPROVAL_CHAIN_CONFIG_ADMIN_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.TECH_ADMIN,
];

/** Roles allowed to initiate an ApprovalRequest for an application. */
export const APPROVAL_REQUEST_INITIATE_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
];

export type PrismaTx = Prisma.TransactionClient;
