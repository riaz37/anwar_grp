import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, Role, CandidateSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];
const WRITE_ROLES: Role[] = [Role.TA_ADMIN, Role.RECRUITER];

/** GET: candidate profile + their applications (PDF Sec 6). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole(READ_ROLES);
    const { id } = await params;

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            requisition: {
              select: { id: true, position: true, positionLevel: true },
            },
            assignedRecruiter: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!candidate) {
      return fail("NOT_FOUND", "Candidate not found.", 404);
    }

    return ok(candidate);
  } catch (err) {
    return handleRouteError(err);
  }
}

const patchSchema = z.object({
  version: z.number().int().min(1),
  name: z.string().trim().min(1).max(200).optional(),
  mobileNumber: z.string().trim().min(1).max(30).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  candidateSource: z.nativeEnum(CandidateSource).optional(),
  cvDocumentId: z.string().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireRole(WRITE_ROLES);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const { version, ...updates } = body;

    try {
      const updated = await prisma.candidate.update({
        where: { id, version },
        data: { ...updates, version: { increment: 1 } },
      });

      await writeAudit({
        actorId: user.userId,
        action: "CANDIDATE_UPDATE",
        entityType: "Candidate",
        entityId: updated.id,
        metadata: { updates },
      });

      return ok(updated);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return fail(
          "VERSION_CONFLICT",
          "This candidate was updated by someone else. Reload and try again.",
          409,
        );
      }
      throw err;
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
