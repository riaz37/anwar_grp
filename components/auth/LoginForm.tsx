"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/primitives/button";

/**
 * Envelope every `/api/v1/*` route returns (PROJECT_PLAN.md Sec 2.4).
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
    errors.email = "That doesn’t look like an email address. Check for typos.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

/**
 * Icon-docked field (DESIGN.md > Components: the auth card is the app's most
 * elevated surface, so its inputs sit on `surface-3` with the inset
 * `shadow-input-inner` rather than the bare bordered box `primitives/input`
 * renders for in-page forms). Local to this file on purpose — it is one
 * screen's shape, not a shared primitive.
 *
 * The label stays visible above the box: the docked glyph is a scanning aid,
 * not a substitute for a name (DESIGN.md > Accessibility).
 */
function Field({
  id,
  icon: Icon,
  label,
  error,
  trailing,
  ...inputProps
}: React.ComponentProps<"input"> & {
  id: string;
  icon: LucideIcon;
  label: string;
  error?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-ds-md">
      <label
        htmlFor={id}
        className="text-caption-2 font-semibold text-text-med"
      >
        {label}
      </label>

      <div
        data-invalid={error ? true : undefined}
        className="group flex items-center gap-ds-lg rounded-xl border border-outline-low bg-surface-3 px-ds-2xl shadow-input-inner transition-colors duration-200 ease-move focus-within:border-outline-high focus-within:bg-surface-4 has-[input:disabled]:opacity-60 data-invalid:border-danger-outline"
      >
        <Icon
          aria-hidden="true"
          className="size-[18px] shrink-0 text-text-low transition-colors duration-200 ease-move group-focus-within:text-primary-med group-data-invalid:text-danger-high"
        />
        <input
          {...inputProps}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-11 min-w-0 flex-1 bg-transparent text-body-2 text-text-high outline-none placeholder:text-text-low disabled:cursor-not-allowed"
        />
        {trailing}
      </div>

      {error && (
        <p
          id={`${id}-error`}
          className="flex items-start gap-ds-sm text-caption-2 text-danger-high motion-safe:animate-[fade-in_200ms_var(--ease-enter)]"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

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
  /* Presentation only — never read by validate() or the submit handler. */
  const [passwordVisible, setPasswordVisible] = useState(false);

  /** An error that survives the correction reads as "still wrong" — clear the
   *  field's message the moment the user starts editing it. */
  function handleFieldChange(field: keyof FieldErrors, value: string) {
    if (field === "email") setEmail(value);
    else setPassword(value);
    setFormError(null);
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

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
        router.push("/home");
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-ds-5xl">
      {/* Live region is always present so the message is announced when it
          arrives, not when the region mounts (DESIGN.md > Accessibility). */}
      <div aria-live="polite" aria-atomic="true">
        {formError && (
          <p
            role="alert"
            className="flex items-start gap-ds-lg rounded-xl border border-danger-outline bg-danger-wash px-ds-2xl py-ds-xl text-para text-danger-high motion-safe:animate-[fade-in_200ms_var(--ease-enter)]"
          >
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {formError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-ds-4xl">
        <Field
          id={emailId}
          icon={Mail}
          label="Work email"
          name="email"
          type="email"
          placeholder="you@anwargroup.example"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          disabled={submitting}
          onChange={(event) => handleFieldChange("email", event.target.value)}
          error={fieldErrors.email}
        />

        <Field
          id={passwordId}
          icon={Lock}
          label="Password"
          name="password"
          type={passwordVisible ? "text" : "password"}
          autoComplete="current-password"
          required
          value={password}
          disabled={submitting}
          onChange={(event) => handleFieldChange("password", event.target.value)}
          error={fieldErrors.password}
          trailing={
            <button
              type="button"
              onClick={() => setPasswordVisible((visible) => !visible)}
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              aria-pressed={passwordVisible}
              className="-mr-ds-md flex size-8 shrink-0 items-center justify-center rounded-md text-text-low transition-colors duration-100 ease-move hover:text-text-high"
            >
              {passwordVisible ? (
                <EyeOff aria-hidden="true" className="size-[18px]" />
              ) : (
                <Eye aria-hidden="true" className="size-[18px]" />
              )}
            </button>
          }
        />
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={submitting}
        aria-busy={submitting}
        className="h-12 w-full text-body-2"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
