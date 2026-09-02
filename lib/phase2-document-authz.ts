import "server-only";
import { DocumentOwnerType, Role } from "@prisma/client";
import { prisma } from "./prisma";
import {
  registerDocumentDownloadAuthzChecker,
  type DocumentDownloadAuthzChecker,
} from "./documents";

/**
 * Phase 2 document-download authorization: registers checkers for the
 * CANDIDATE, APPLICATION and REQUISITION DocumentOwnerType values (CV,
 * ERF/RRF). Phase 1 left every owner type fail-closed deliberately
 * (lib/documents.ts) — this module is what makes those documents
 * downloadable, called once at process startup from instrumentation.ts.
 *
 * Role-scoping mirrors the same "who can see this record" rules used by
 * the Phase 2 list/detail API routes (see app/api/v1/requisitions,
 * candidates, applications route handlers) — a user who cannot view the
 * owning record cannot download its documents either.
 */

const ORG_WIDE_READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

const requisitionChecker: DocumentDownloadAuthzChecker = async ({
  user,
  ownerId,
}) => {
  if (ORG_WIDE_READ_ROLES.includes(user.role)) return true;

  const requisition = await prisma.requisition.findUnique({
    where: { id: ownerId },
    select: { assignedRecruiterId: true, hiringManagerId: true, departmentId: true },
  });
  if (!requisition) return false;

  if (requisition.assignedRecruiterId === user.userId) return true;
  if (requisition.hiringManagerId === user.userId) return true;
  if (
    (user.role === Role.DEPT_HEAD || user.role === Role.HIRING_MANAGER) &&
    user.departmentId &&
    requisition.departmentId === user.departmentId
  ) {
    return true;
  }
  return false;
};

const applicationChecker: DocumentDownloadAuthzChecker = async ({
  user,
  ownerId,
}) => {
  if (ORG_WIDE_READ_ROLES.includes(user.role)) return true;

  const application = await prisma.application.findUnique({
    where: { id: ownerId },
    select: {
      assignedRecruiterId: true,
      nextActionOwnerId: true,
      requisition: {
        select: { hiringManagerId: true, departmentId: true },
      },
    },
  });
  if (!application) return false;

  if (application.assignedRecruiterId === user.userId) return true;
  if (application.nextActionOwnerId === user.userId) return true;
  if (application.requisition.hiringManagerId === user.userId) return true;
  if (
    (user.role === Role.DEPT_HEAD || user.role === Role.HIRING_MANAGER) &&
    user.departmentId &&
    application.requisition.departmentId === user.departmentId
  ) {
    return true;
  }
  return false;
};

// Candidate profiles/CVs are not owned by a single requisition (one
// candidate, many applications — BUILD_PLAN.md Sec 2.3), so there is no
// single department/recruiter to scope against. Any authenticated user
// in a recruiting-facing role may download a candidate's CV; panel
// members and audit users get read access too (audit = read-only by
// design, panel members legitimately review CVs pre-interview in later
// phases). Break-glass/field-level encryption for CV *contents* is a
// Phase 8 hardening item per BUILD_PLAN.md Sec 3.1 — this checker only
// gates presigned-URL issuance, not encryption.
const CANDIDATE_DOCUMENT_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.PANEL_MEMBER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

const candidateChecker: DocumentDownloadAuthzChecker = ({ user }) => {
  return CANDIDATE_DOCUMENT_ROLES.includes(user.role);
};

let registered = false;

/** Idempotent — safe to call more than once (e.g. hot reload in dev). */
export function registerPhase2DocumentAuthzCheckers(): void {
  if (registered) return;
  registered = true;
  registerDocumentDownloadAuthzChecker(
    DocumentOwnerType.REQUISITION,
    requisitionChecker,
  );
  registerDocumentDownloadAuthzChecker(
    DocumentOwnerType.APPLICATION,
    applicationChecker,
  );
  registerDocumentDownloadAuthzChecker(
    DocumentOwnerType.CANDIDATE,
    candidateChecker,
  );
}
