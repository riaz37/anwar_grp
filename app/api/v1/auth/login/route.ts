import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "Password is required."),
});

export async function POST(req: NextRequest) {
  try {
    const body = loginSchema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    });

    // Same generic error whether the email doesn't exist or the
    // password is wrong — never leak which one it was.
    if (!user || !user.isActive) {
      return fail("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const passwordValid = await verifyPassword(body.password, user.passwordHash);
    if (!passwordValid) {
      return fail("INVALID_CREDENTIALS", "Invalid email or password.", 401);
    }

    const session = await createSession(user.id);

    await writeAudit({
      actorId: user.id,
      action: "AUTH_LOGIN",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email },
    });

    return ok({
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        departmentId: session.departmentId,
        businessUnitId: session.businessUnitId,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
