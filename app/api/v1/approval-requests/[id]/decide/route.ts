import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { ok, fail, handleRouteError } from "@/lib/api-response";
import { ApprovalChainError, recordDecision } from "@/lib/approval-chain";

const decideSchema = z.object({
  stepIndex: z.number().int().min(0),
  decision: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/v1/approval-requests/:id/decide — records a decision at a
 * step. Deliberately NOT gated by a fixed route-level `requireRole`
 * allowlist — the role required differs per step (snapshotted on the
 * ApprovalDecision row as `approverRole`), so this route just requires
 * "any authenticated user" and lets lib/approval-chain.ts's
 * recordDecision() reject with 403 WRONG_ROLE if the caller's role
 * doesn't match that step's required role.
 *
 * Sequential-only policy (see lib/approval-chain.ts's doc comment):
 * `stepIndex` in the body must match the request's current step, or a
 * 409 NOT_CURRENT_STEP is returned.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = decideSchema.parse(await req.json());

    const existing = await prisma.approvalRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return fail("NOT_FOUND", "Approval request not found.", 404);
    }

    try {
      const updated = await recordDecision({
        approvalRequestId: id,
        stepIndex: body.stepIndex,
        decidedById: user.userId,
        decidedByRole: user.role,
        decision: body.decision,
        comments: body.comments,
      });

      const withDecisions = await prisma.approvalRequest.findUnique({
        where: { id: updated.id },
        include: {
          decisions: {
            orderBy: { stepIndex: "asc" },
            include: { decidedBy: { select: { id: true, name: true, role: true } } },
          },
        },
      });

      return ok(withDecisions);
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
