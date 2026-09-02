import { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { ok, handleRouteError } from "@/lib/api-response";

const listQuerySchema = z.object({
  role: z.nativeEnum(Role).optional(),
});

/**
 * Reference lookup for dropdowns (recruiter/hiring-manager pickers etc.)
 * — any authenticated user may read it. Deliberately returns only
 * {id, name, role}, never email/passwordHash/department — this is not
 * a user-management endpoint.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { role } = listQuerySchema.parse({
      role: req.nextUrl.searchParams.get("role") ?? undefined,
    });

    const users = await prisma.user.findMany({
      where: { isActive: true, ...(role && { role }) },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    return ok(users);
  } catch (err) {
    return handleRouteError(err);
  }
}
