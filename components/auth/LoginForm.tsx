"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

/**
 * Envelope every `/api/v1/*` route returns (BUILD_PLAN.md Sec 2.4).
 * Mirrored locally rather than imported from `lib/api-response` — that module
 * pulls in `next/server` and Zod, which don't belong in a client bundle.
 */
type ApiError = { code: string; message: string };

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: ApiError | string | null;
  meta?: unknown;
};

/** The API sends `error` as `{ code, message }`; tolerate a bare string too. */
function errorMessage(error: ApiEnvelope<unknown>["error"]): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  return typeof error.message === "string" ? error.message : null;
}

type FieldErrors = { email?: string; password?: string };

/* Deliberately permissive: the server is the authority on whether an address
   exists. This only catches obvious typos before a round trip. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Enter your work email address.";
  else if (!EMAIL_PATTERN.test(email.trim()))
    errors.email = "That doesn’t look like an email address — check for typos.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

const FIELD_CLASS =
  "min-h-11 w-full rounded-sm border bg-surface px-sm py-sm text-body text-text " +
  "transition-colors duration-100 ease-move placeholder:text-muted " +
  "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60";

export function LoginForm() {
  const router = useRouter();
  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validate(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      document
        .getElementById(errors.email ? emailId : passwordId)
        ?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const body = (await response
        .json()
        .catch(() => null)) as ApiEnvelope<unknown> | null;

      if (response.ok && body?.success) {
        router.push("/");
        router.refresh();
        return;
      }

      setFormError(
        errorMessage(body?.error ?? null) ??
          (response.status === 401
            ? "That email and password combination didn’t match. Check both and try again."
            : "Sign-in is unavailable right now. Try again in a moment, or contact your system administrator."),
      );
      setSubmitting(false);
    } catch {
      setFormError(
        "Couldn’t reach the server. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-md">
      {/* Live region is always present so the message is announced when it
          arrives, not when the region mounts (DESIGN.md > Accessibility). */}
      <div aria-live="polite" aria-atomic="true">
        {formError && (
          <p
            role="alert"
            className="rounded-sm border border-error bg-error-soft px-md py-sm text-body-sm text-error-ink motion-safe:animate-[fade-in_200ms_var(--ease-enter)]"
          >
            {formError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2xs">
        <label htmlFor={emailId} className="text-body-sm font-medium text-text">
          Work email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
          className={`${FIELD_CLASS} ${
            fieldErrors.email ? "border-error" : "border-border"
          }`}
        />
        {fieldErrors.email && (
          <p id={`${emailId}-error`} className="text-body-sm text-error-ink">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2xs">
        <label
          htmlFor={passwordId}
          className="text-body-sm font-medium text-text"
        >
          Password
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          disabled={submitting}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={
            fieldErrors.password ? `${passwordId}-error` : undefined
          }
          className={`${FIELD_CLASS} ${
            fieldErrors.password ? "border-error" : "border-border"
          }`}
        />
        {fieldErrors.password && (
          <p id={`${passwordId}-error`} className="text-body-sm text-error-ink">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="mt-sm min-h-11 rounded-sm bg-accent-ink px-md text-body-sm font-semibold text-surface transition-colors duration-100 ease-move hover:bg-accent-hover disabled:cursor-progress disabled:opacity-70"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
