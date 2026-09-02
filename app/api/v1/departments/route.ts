import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { ok, handleRouteError } from "@/lib/api-response";

const listQuerySchema = z.object({
  businessUnitId: z.string().optional(),
});

/** Reference lookup for dropdowns — any authenticated user may read it. */
export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { businessUnitId } = listQuerySchema.parse({
      businessUnitId: req.nextUrl.searchParams.get("businessUnitId") ?? undefined,
    });

    const departments = await prisma.department.findMany({
      where: businessUnitId ? { businessUnitId } : undefined,
      select: { id: true, name: true, businessUnitId: true },
      orderBy: { name: "asc" },
    });
    return ok(departments);
  } catch (err) {
    return handleRouteError(err);
  }
}
