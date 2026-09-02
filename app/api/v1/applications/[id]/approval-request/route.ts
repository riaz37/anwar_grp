import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { applicationScopeWhere } from "@/lib/phase2-scoping";
import {
  ApprovalChainError,
  APPROVAL_REQUEST_INITIATE_ROLES,
  initiateApprovalRequest,
} from "@/lib/approval-chain";

const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

/**
 * POST /api/v1/applications/:id/approval-request — initiates a candidate
 * -selection ApprovalRequest for this application. Typically called once
 * the application reaches the APPROVAL stage (not enforced here — the
 * stage machine in lib/application-stages.ts already gates how an
 * application gets to APPROVAL; this route doesn't re-derive that
 * check, since an application could conceivably need re-approval from a
 * different stage in an edge case and that's a recruiter judgment call,
 * not a hard rule the PDF specifies).
 *
 * Returns 400 NO_CHAIN_CONFIGURED — a clear, actionable error, not a
 * 500 — when no ApprovalChainConfig resolves for this application's
 * business unit/department/position level.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(APPROVAL_REQUEST_INITIATE_ROLES);
    const { id } = await params;

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
      select: { id: true, requisitionId: true },
    });
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    try {
      const request = await initiateApprovalRequest(application.id, user.userId);
      const withDecisions = await prisma.approvalRequest.findUnique({
        where: { id: request.id },
        include: {
          decisions: { orderBy: { stepIndex: "asc" } },
          chainConfig: { include: { steps: { orderBy: { sequence: "asc" } } } },
        },
      });
      return ok(withDecisions, { status: 201 });
    } catch (err) {
      if (err instanceof ApprovalChainError) {
        return fail(err.code, err.message, err.httpStatus);
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * GET /api/v1/applications/:id/approval-request — the most recent
 * ApprovalRequest for this application, with all decision rows, so
 * "step 3 of 5, waiting on Dept Head" is directly renderable without a
 * second round trip.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(READ_ROLES);
    const { id } = await params;

    const application = await prisma.application.findFirst({
      where: { id, ...applicationScopeWhere(user) },
      select: { id: true },
    });
    if (!application) {
      return fail("NOT_FOUND", "Application not found.", 404);
    }

    const request = await prisma.approvalRequest.findFirst({
      where: { applicationId: id },
      orderBy: { createdAt: "desc" },
      include: {
        decisions: {
          orderBy: { stepIndex: "asc" },
          include: { decidedBy: { select: { id: true, name: true, role: true } } },
        },
        chainConfig: { include: { steps: { orderBy: { sequence: "asc" } } } },
        initiatedBy: { select: { id: true, name: true } },
      },
    });

    if (!request) {
      return fail(
        "NOT_FOUND",
        "No approval request has been initiated for this application yet.",
        404,
      );
    }

    return ok(request);
  } catch (err) {
    return handleRouteError(err);
  }
}
