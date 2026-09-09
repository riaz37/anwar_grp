/**
 * Browser-side helper for calling `/api/v1/*`.
 *
 * The envelope type is mirrored from `lib/api-response.ts` rather than
 * imported, because that module pulls in `next/server` and Zod, which must not
 * end up in a client bundle. (Same reasoning as `components/auth/LoginForm.tsx`,
 * which predates this file — that component can be folded onto this helper
 * whenever it is next touched.)
 */

export interface ApiErrorShape {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  /** The API sends `{ code, message }`; a bare string is tolerated. */
  error: ApiErrorShape | string | null;
  meta?: unknown;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

function envelopeMessage(error: ApiEnvelope<unknown>["error"]): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  return typeof error.message === "string" ? error.message : null;
}

function envelopeCode(error: ApiEnvelope<unknown>["error"]): string {
  if (error && typeof error !== "string" && typeof error.code === "string") {
    return error.code;
  }
  return "UNKNOWN_ERROR";
}

/**
 * POSTs JSON and unwraps the envelope. Throws `ApiRequestError` on any
 * non-success response so callers can branch on `.status` (notably 409, the
 * optimistic-locking conflict — PROJECT_PLAN.md Sec 2.4).
 */
export async function postJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiRequestError(
      "Couldn’t reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  const envelope = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !envelope?.success) {
    throw new ApiRequestError(
      envelopeMessage(envelope?.error ?? null) ??
        "The server rejected that request. Try again, or contact your administrator.",
      response.status,
      envelopeCode(envelope?.error ?? null),
    );
  }

  return envelope.data as T;
}

/**
 * PATCHes JSON and unwraps the envelope. Same behavior as `postJson` — see
 * its doc comment for the error-handling contract.
 */
export async function patchJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiRequestError(
      "Couldn’t reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  const envelope = (await response
    .json()
    .catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !envelope?.success) {
    throw new ApiRequestError(
      envelopeMessage(envelope?.error ?? null) ??
        "The server rejected that request. Try again, or contact your administrator.",
      response.status,
      envelopeCode(envelope?.error ?? null),
    );
  }

  return envelope.data as T;
}
