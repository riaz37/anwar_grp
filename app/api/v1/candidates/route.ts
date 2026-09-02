import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, CandidateSource, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { writeAudit } from "@/lib/audit";
import { ok, handleRouteError } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";
import { findDuplicateCandidates } from "@/lib/candidate-dedup";

/**
 * Candidate profiles are shared org-wide (one candidate, many
 * applications — BUILD_PLAN.md Sec 2.3), so unlike Requisitions/
 * Applications there is no department/recruiter scope to default list
 * results to: any of these roles may create/list/search candidates.
 * PANEL_MEMBER is excluded until the Interview phase gives them a
 * reason to browse the candidate list directly.
 */
const CANDIDATE_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];
const WRITE_ROLES: Role[] = [Role.TA_ADMIN, Role.RECRUITER];

const createCandidateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  mobileNumber: z.string().trim().min(1).max(30),
  email: z.string().trim().toLowerCase().email(),
  candidateSource: z.nativeEnum(CandidateSource),
  cvDocumentId: z.string().min(1).optional(),
});

/**
 * POST: creates the candidate unconditionally (dedup is a WARNING per
 * PDF Sec 4, never a block) and returns any exact-match duplicates in
 * `meta.duplicateWarning` so the client can surface a non-blocking
 * banner without a second round trip.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(WRITE_ROLES);
    const body = createCandidateSchema.parse(await req.json());

    const dedupResult = await findDuplicateCandidates({
      email: body.email,
      mobileNumber: body.mobileNumber,
    });

    const candidate = await prisma.candidate.create({
      data: {
        name: body.name,
        mobileNumber: body.mobileNumber,
        email: body.email,
        candidateSource: body.candidateSource,
        cvDocumentId: body.cvDocumentId,
      },
    });

    await writeAudit({
      actorId: user.userId,
      action: "CANDIDATE_CREATE",
      entityType: "Candidate",
      entityId: candidate.id,
      metadata: {
        candidateSource: candidate.candidateSource,
        possibleDuplicates: dedupResult.matches.map((m) => m.candidate.id),
      },
    });

    return ok(candidate, {
      status: 201,
      meta: { duplicateWarning: dedupResult },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
});

/**
 * GET: filterable/searchable by name/email/mobile via a single `q`
 * query param (case-insensitive contains across all three).
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole(CANDIDATE_ROLES);
    const { searchParams } = req.nextUrl;
    const { q } = listQuerySchema.parse({ q: searchParams.get("q") ?? undefined });
    const { skip, take, page, limit } = parsePagination(searchParams);

    const where: Prisma.CandidateWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { mobileNumber: { contains: q } },
          ],
        }
      : {};

    const [total, candidates] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return ok(candidates, { meta: { total, page, limit } });
  } catch (err) {
    return handleRouteError(err);
  }
}
