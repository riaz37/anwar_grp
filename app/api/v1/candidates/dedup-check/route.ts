import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/authz";
import { ok, handleRouteError } from "@/lib/api-response";
import { findDuplicateCandidates } from "@/lib/candidate-dedup";

const READ_ROLES: Role[] = [
  Role.TA_ADMIN,
  Role.RECRUITER,
  Role.DEPT_HEAD,
  Role.HIRING_MANAGER,
  Role.HR_LEADERSHIP,
  Role.AUDIT_USER,
  Role.TECH_ADMIN,
];

const querySchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
  mobileNumber: z.string().trim().min(1).optional(),
});

/**
 * Live pre-check used by the candidate create form's duplicate-warning
 * banner (see lib/candidate-dedup.ts — exact match only, never a
 * block). At least one of email/mobileNumber must be given.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole(READ_ROLES);
    const { searchParams } = req.nextUrl;
    const { email, mobileNumber } = querySchema.parse({
      email: searchParams.get("email") ?? undefined,
      mobileNumber: searchParams.get("mobileNumber") ?? undefined,
    });

    if (!email && !mobileNumber) {
      return ok({ hasDuplicates: false, matches: [] });
    }

    const result = await findDuplicateCandidates({
      email: email ?? "",
      mobileNumber: mobileNumber ?? "",
    });
    return ok(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
