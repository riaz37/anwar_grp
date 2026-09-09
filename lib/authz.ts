import "server-only";
import type { Role } from "@prisma/client";
import { getSession, type SessionPayload } from "./session";

/**
 * Thrown by requireRole()/requireAuth() when the request should be
 * rejected. Route handlers should catch this (or use the withAuthz
 * wrapper below) and map it to the standard error envelope with the
 * given httpStatus.
 */
export class AuthzError extends Error {
  httpStatus: number;
  code: string;

  constructor(message: string, httpStatus: number, code: string) {
    super(message);
    this.name = "AuthzError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

/**
 * Returns the current authenticated user's session payload, or null
 * if there is none. This is the ONLY source of truth for "who is
 * making this request" — never read role/user info from the request
 * body or query string.
 */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  return getSession();
}

/**
 * Throws AuthzError(401) if there is no authenticated session.
 * Use directly when a route just needs "any logged-in user."
 */
export async function requireAuth(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthzError("Authentication required.", 401, "UNAUTHENTICATED");
  }
  return user;
}

/**
 * Throws AuthzError(401) if unauthenticated, AuthzError(403) if the
 * current user's role is not in allowedRoles. This is the server-side
 * security boundary — the client's role-based navigation is a UX
 * convenience only (PROJECT_PLAN.md Sec 2.5). Every mutating route
 * handler under app/api/v1/** must call this (or requireAuth) before
 * doing anything else.
 */
export async function requireRole(
  allowedRoles: Role[],
): Promise<SessionPayload> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new AuthzError(
      "You do not have permission to perform this action.",
      403,
      "FORBIDDEN",
    );
  }
  return user;
}
