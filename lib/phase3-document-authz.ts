import "server-only";
import { DocumentOwnerType, Role } from "@prisma/client";
import { prisma } from "./prisma";
import {
  registerDocumentDownloadAuthzChecker,
  type DocumentDownloadAuthzChecker,
} from "./documents";

/**
 * Phase 3 document-download authorization: registers the checker for
 * DocumentOwnerType.SCREENING_ASSESSMENT (uploaded assessment
 * documents), following the exact pattern lib/phase2-document-authz.ts
 * established for REQUISITION/APPLICATION/CANDIDATE. Called once at
 * process startup from instrumentation.ts — lib/documents.ts fails
 * closed for any owner type with no registered checker.
 *
 * Visibility mirrors the owning Application's visibility: anyone who
 * could see the application (org-wide roles, the assigned recruiter,
 * the requisition's hiring manager, or the dept-head/hiring-manager of
 * that department) can download its screening/assessment documents too.
 *
 * Ownership-id convention (documented, not obvious from the schema
 * alone): assessment documents are uploaded with
 * `ownerType: SCREENING_ASSESSMENT, ownerId: <applicationId>` — NOT the
 * ScreeningAssessment row's own id. This sidesteps a chicken-and-egg
 * problem: the document is typically presigned/uploaded (and the
 * caller wants an authz-checkable owner id) before the
 * ScreeningAssessment record itself is created by
 * POST /applications/:id/screening (which has no separate PATCH to
 * attach a document afterward — see that model's schema comment). The
 * applicationId is stable and known up front, so it is the owner id
 * used for authz purposes; the ScreeningAssessment row's own
 * `assessmentDocumentId` field just stores a pointer to the Document
 * for display purposes.
 */

const ORG_WIDE_READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

const screeningAssessmentChecker: DocumentDownloadAuthzChecker = async ({
  user,
  ownerId,
}) => {
  if (ORG_WIDE_READ_ROLES.includes(user.role)) return true;

  // ownerId is the applicationId — see this file's top doc comment for
  // why (chicken-and-egg with ScreeningAssessment creation order).
  const application = await prisma.application.findUnique({
    where: { id: ownerId },
    select: {
      assignedRecruiterId: true,
      nextActionOwnerId: true,
      requisition: { select: { hiringManagerId: true, departmentId: true } },
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

let registered = false;

/** Idempotent — safe to call more than once (e.g. hot reload in dev). */
export function registerPhase3DocumentAuthzCheckers(): void {
  if (registered) return;
  registered = true;
  registerDocumentDownloadAuthzChecker(
    DocumentOwnerType.SCREENING_ASSESSMENT,
    screeningAssessmentChecker,
  );
}
