import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { ok, handleRouteError } from "@/lib/api-response";

/** Reference lookup for dropdowns — any authenticated user may read it. */
export async function GET() {
  try {
    await requireAuth();
    const businessUnits = await prisma.businessUnit.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return ok(businessUnits);
  } catch (err) {
    return handleRouteError(err);
  }
}
