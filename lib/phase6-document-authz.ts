import "server-only";
import { DocumentOwnerType, Role } from "@prisma/client";
import { prisma } from "./prisma";
import {
  registerDocumentDownloadAuthzChecker,
  type DocumentDownloadAuthzChecker,
} from "./documents";

/**
 * Phase 6 document-download authorization: registers the checker for
 * DocumentOwnerType.JOINING_CHECKLIST_ITEM (optional evidence uploaded
 * against a checklist item, e.g. a signed offer letter or ID card
 * photo), following the exact pattern lib/phase2-document-authz.ts and
 * lib/phase3-document-authz.ts established. Called once at process
 * startup from instrumentation.ts — lib/documents.ts fails closed for
 * any owner type with no registered checker.
 *
 * Visibility mirrors the owning Application's visibility (same rule as
 * Phase 3's SCREENING_ASSESSMENT checker): anyone who could see the
 * application (org-wide roles, the assigned recruiter, the requisition's
 * hiring manager, or the dept-head/hiring-manager of that department)
 * can download its joining-checklist evidence documents too. The
 * checklist item's own `ownerId` (the user responsible for that item)
 * is also granted access — they may not otherwise be the assigned
 * recruiter (e.g. an IT staffer assigned the "IT request" item), and
 * they are the one most likely to need to view/re-upload the evidence.
 *
 * Ownership-id convention: evidence documents are uploaded with
 * `ownerType: JOINING_CHECKLIST_ITEM, ownerId: <joiningChecklistItemId>`
 * — the checklist item's own id, NOT the applicationId (unlike Phase 3's
 * SCREENING_ASSESSMENT convention). There is no chicken-and-egg problem
 * here: the checklist item row always exists before evidence is
 * attached to it (items are seeded/created first, evidence uploaded
 * after), so its id is available up front.
 */

const ORG_WIDE_READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

const joiningChecklistItemChecker: DocumentDownloadAuthzChecker = async ({
  user,
  ownerId,
}) => {
  if (ORG_WIDE_READ_ROLES.includes(user.role)) return true;

  const item = await prisma.joiningChecklistItem.findUnique({
    where: { id: ownerId },
    select: {
      ownerId: true,
      application: {
        select: {
          assignedRecruiterId: true,
          nextActionOwnerId: true,
          requisition: { select: { hiringManagerId: true, departmentId: true } },
        },
      },
    },
  });
  if (!item) return false;

  if (item.ownerId === user.userId) return true;
  if (item.application.assignedRecruiterId === user.userId) return true;
  if (item.application.nextActionOwnerId === user.userId) return true;
  if (item.application.requisition.hiringManagerId === user.userId) return true;
  if (
    (user.role === Role.DEPT_HEAD || user.role === Role.HIRING_MANAGER) &&
    user.departmentId &&
    item.application.requisition.departmentId === user.departmentId
  ) {
    return true;
  }
  return false;
};

let registered = false;

/** Idempotent — safe to call more than once (e.g. hot reload in dev). */
export function registerPhase6DocumentAuthzCheckers(): void {
  if (registered) return;
  registered = true;
  registerDocumentDownloadAuthzChecker(
    DocumentOwnerType.JOINING_CHECKLIST_ITEM,
    joiningChecklistItemChecker,
  );
}
