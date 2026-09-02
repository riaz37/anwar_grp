import "server-only";
import { Prisma, Role } from "@prisma/client";
import type { SessionPayload } from "./session";

/**
 * Server-side visibility scoping for Phase 2 list endpoints, per
 * BUILD_PLAN.md Sec 2.5 ("role -> allowed actions + visible fields").
 * These are default *scopes* applied when the caller doesn't (or can't)
 * ask for someone else's data — see each route's doc comment for the
 * exact decision per resource.
 */

const ORG_WIDE_READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

export function canReadOrgWide(user: SessionPayload): boolean {
  return ORG_WIDE_READ_ROLES.includes(user.role);
}

/**
 * Requisitions: org-wide roles see everything. RECRUITER defaults to
 * their own assigned requisitions. DEPT_HEAD/HIRING_MANAGER default to
 * their own department. Anyone else (PANEL_MEMBER) sees nothing by
 * default in Phase 2 — requisition visibility for panel members is an
 * Interview-phase concern.
 */
export function requisitionScopeWhere(
  user: SessionPayload,
): Prisma.RequisitionWhereInput {
  if (canReadOrgWide(user)) return {};
  if (user.role === Role.RECRUITER) {
    return { assignedRecruiterId: user.userId };
  }
  if (user.role === Role.DEPT_HEAD || user.role === Role.HIRING_MANAGER) {
    return user.departmentId
      ? { departmentId: user.departmentId }
      : { hiringManagerId: user.userId };
  }
  return { id: "__none__" };
}

/**
 * Applications: org-wide roles see everything. RECRUITER defaults to
 * applications they are assigned to. DEPT_HEAD/HIRING_MANAGER default
 * to applications under requisitions in their department. Anyone else
 * sees nothing by default.
 */
export function applicationScopeWhere(
  user: SessionPayload,
): Prisma.ApplicationWhereInput {
  if (canReadOrgWide(user)) return {};
  if (user.role === Role.RECRUITER) {
    return { assignedRecruiterId: user.userId };
  }
  if (user.role === Role.DEPT_HEAD || user.role === Role.HIRING_MANAGER) {
    return user.departmentId
      ? { requisition: { departmentId: user.departmentId } }
      : { requisition: { hiringManagerId: user.userId } };
  }
  return { id: "__none__" };
}
