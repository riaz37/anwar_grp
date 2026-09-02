import { getCurrentUser } from "@/lib/authz";
import { ok, fail, handleRouteError } from "@/lib/api-response";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return fail("UNAUTHENTICATED", "Not logged in.", 401);
    }

    return ok({
      id: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      businessUnitId: user.businessUnitId,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
