import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthzError } from "./authz";

/**
 * Standard API envelope per BUILD_PLAN.md Sec 2.4:
 * { success, data, error, meta } — meta carries pagination for list
 * endpoints (unused by the Phase 1 routes, reserved for later phases).
 */
export interface ApiError {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta?: Record<string, unknown>;
}

export function ok<T>(
  data: T,
  init?: { status?: number; meta?: Record<string, unknown> },
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(
    { success: true, data, error: null, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 },
  );
}

export function fail(
  code: string,
  message: string,
  status: number,
): NextResponse<ApiEnvelope<null>> {
  return NextResponse.json(
    { success: false, data: null, error: { code, message } },
    { status },
  );
}

/**
 * Centralized error mapping for route handlers: catches AuthzError and
 * ZodError specially, falls back to a generic 500 for anything else.
 * Route handlers should wrap their body in try/catch and call this in
 * the catch block, e.g.:
 *
 *   try { ... } catch (err) { return handleRouteError(err); }
 */
export function handleRouteError(err: unknown): NextResponse<ApiEnvelope<null>> {
  if (err instanceof AuthzError) {
    return fail(err.code, err.message, err.httpStatus);
  }
  if (err instanceof ZodError) {
    return fail(
      "VALIDATION_ERROR",
      err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      400,
    );
  }
  if (err instanceof SyntaxError) {
    // req.json() on a missing/malformed body throws a raw SyntaxError —
    // map it to the same 400 envelope as a Zod failure rather than a 500.
    return fail("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
  }
  console.error("[api] unhandled route error:", err);
  return fail("INTERNAL_ERROR", "An unexpected error occurred.", 500);
}
