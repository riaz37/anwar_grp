import { RequisitionApprovalStatus, Role } from "@prisma/client";

/**
 * Requisition approval-status transitions (PDF Sec 6 suggested statuses:
 * Draft -> Awaiting Approval -> Approved -> Open -> On Hold -> Filled ->
 * Closed). This exact graph + role gate per transition is a Phase 2
 * design decision (the PDF gives the happy-path order, not the full
 * transition/role table) — documented here so it's easy to revise:
 *
 *   - DRAFT -> AWAITING_APPROVAL: recruiter submits for approval.
 *   - AWAITING_APPROVAL -> APPROVED: an approver signs off (DEPT_HEAD /
 *     HIRING_MANAGER / TA_ADMIN / HR_LEADERSHIP) — a real approval-chain
 *     config (BUILD_PLAN.md Sec 2.9) lands in a later phase; for now any
 *     role with approval authority can approve.
 *   - AWAITING_APPROVAL -> DRAFT: sent back for revision (rejected).
 *   - APPROVED -> OPEN: recruiter starts actively sourcing.
 *   - OPEN <-> ON_HOLD: pause/resume sourcing.
 *   - OPEN -> FILLED: all vacancies filled.
 *   - Any non-terminal status -> CLOSED: cancel the requisition.
 *   - CLOSED / FILLED are terminal.
 */
const TRANSITIONS: Partial<
  Record<RequisitionApprovalStatus, RequisitionApprovalStatus[]>
> = {
  [RequisitionApprovalStatus.DRAFT]: [
    RequisitionApprovalStatus.AWAITING_APPROVAL,
    RequisitionApprovalStatus.CLOSED,
  ],
  [RequisitionApprovalStatus.AWAITING_APPROVAL]: [
    RequisitionApprovalStatus.APPROVED,
    RequisitionApprovalStatus.DRAFT,
    RequisitionApprovalStatus.CLOSED,
  ],
  [RequisitionApprovalStatus.APPROVED]: [
    RequisitionApprovalStatus.OPEN,
    RequisitionApprovalStatus.CLOSED,
  ],
  [RequisitionApprovalStatus.OPEN]: [
    RequisitionApprovalStatus.ON_HOLD,
    RequisitionApprovalStatus.FILLED,
    RequisitionApprovalStatus.CLOSED,
  ],
  [RequisitionApprovalStatus.ON_HOLD]: [
    RequisitionApprovalStatus.OPEN,
    RequisitionApprovalStatus.CLOSED,
  ],
  [RequisitionApprovalStatus.FILLED]: [RequisitionApprovalStatus.CLOSED],
  [RequisitionApprovalStatus.CLOSED]: [],
};

export function allowedNextRequisitionStatuses(
  current: RequisitionApprovalStatus,
): RequisitionApprovalStatus[] {
  return TRANSITIONS[current] ?? [];
}

export function isValidRequisitionStatusTransition(
  from: RequisitionApprovalStatus,
  to: RequisitionApprovalStatus,
): boolean {
  return allowedNextRequisitionStatuses(from).includes(to);
}

/** Roles allowed to move a requisition INTO this target status. */
const APPROVER_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
];
const OPERATOR_ROLES: Role[] = [Role.TA_ADMIN, Role.RECRUITER];

export function rolesAllowedForTransition(
  target: RequisitionApprovalStatus,
): Role[] {
  if (target === RequisitionApprovalStatus.APPROVED) {
    return APPROVER_ROLES;
  }
  return OPERATOR_ROLES;
}
