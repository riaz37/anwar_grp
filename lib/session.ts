import "server-only";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";

/**
 * Cookie name for the session token. Decision (not spelled out in
 * BUILD_PLAN.md): "tf_session". httpOnly + sameSite=lax + secure
 * (secure only outside development, since local dev runs over http).
 */
export const SESSION_COOKIE_NAME = "tf_session";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BCRYPT_SALT_ROUNDS = 12;

export interface SessionPayload {
  sessionId: string;
  userId: string;
  role: Role;
  departmentId: string | null;
  businessUnitId: string | null;
  email: string;
  name: string;
  isActive: boolean;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function generateSessionToken(): string {
  // 256 bits of entropy, hex-encoded. This is the actual Session.id —
  // NOT a JWT, server-side lookup on every request per BUILD_PLAN.md
  // Sec 0 ("session carries role/departmentId/businessUnitId" — that
  // data is fetched fresh from the DB, never trusted from the token).
  return randomBytes(32).toString("hex");
}

/**
 * Creates a server-side Session row and sets the httpOnly session
 * cookie on the current response. Returns the session payload.
 */
export async function createSession(userId: string): Promise<SessionPayload> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const session = await prisma.session.create({
    data: {
      id: token,
      userId,
      expiresAt,
    },
    include: { user: true },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return {
    sessionId: session.id,
    userId: session.user.id,
    role: session.user.role,
    departmentId: session.user.departmentId,
    businessUnitId: session.user.businessUnitId,
    email: session.user.email,
    name: session.user.name,
    isActive: session.user.isActive,
  };
}

/**
 * Reads the session cookie (if any), validates it against the DB
 * (existence + not expired + user still active), and returns the
 * current session payload. Returns null if there is no valid session —
 * callers must treat null as "unauthenticated," never assume a
 * client-sent role/id is trustworthy.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt < new Date() || !session.user.isActive) {
    // Expired or deactivated: clean up server-side and treat as
    // unauthenticated. Do not throw — this is a normal path.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {
      // Already gone (race with another request) — fine.
    });
    return null;
  }

  return {
    sessionId: session.id,
    userId: session.user.id,
    role: session.user.role,
    departmentId: session.user.departmentId,
    businessUnitId: session.user.businessUnitId,
    email: session.user.email,
    name: session.user.name,
    isActive: session.user.isActive,
  };
}

/**
 * Destroys the current session: deletes the server-side Session row
 * and clears the cookie. Safe to call with no active session.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {
      // Already gone — fine, we're destroying it anyway.
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
