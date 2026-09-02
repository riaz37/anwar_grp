"use client";

import type { ReactNode } from "react";

/**
 * Form primitives for the requisition/candidate create forms.
 *
 * Every control here is label-first (placeholders are never used as labels),
 * has a ≥44px hit area, wires `aria-invalid`/`aria-describedby` to its error
 * and hint text, and renders its error inline beneath the control rather than
 * summarising errors elsewhere. Forms cap at 720px per DESIGN.md > Layout.
 */

const CONTROL =
  "min-h-11 w-full rounded-sm border bg-surface px-sm py-sm text-body text-text " +
  "transition-colors duration-100 ease-move placeholder:text-muted " +
  "hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60";

function controlClass(invalid: boolean, extra = ""): string {
  return `${CONTROL} ${invalid ? "border-error" : "border-border"} ${extra}`;
}

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2xs">
      <label htmlFor={id} className="text-body-sm font-medium text-text">
        {label}
        {!required && (
          <span className="ml-xs font-normal text-muted">(optional)</span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {/* Hint sits *below* the control, not between label and control: with it
          above, a hinted field and an un-hinted one side by side in the same
          grid row have their inputs at different heights, and the form stops
          reading as a grid (DESIGN.md > Layout: grid-disciplined). */}
      {hint && (
        <p id={hintId} className="text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-body-sm text-error-ink">
          {error}
        </p>
      )}
    </div>
  );
}

type BaseProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

export function TextInputField({
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  placeholder,
  ...field
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "date" | "number";
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  placeholder?: string;
}) {
  return (
    <Field {...field}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          required={field.required}
          disabled={field.disabled}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass(
            invalid,
            type === "date" || type === "number"
              ? "font-data tabular-nums"
              : "",
          )}
        />
      )}
    </Field>
  );
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  ...field
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Field {...field}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          name={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          required={field.required}
          disabled={field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass(invalid, "font-data tabular-nums")}
        />
      )}
    </Field>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = "Select…",
  ...field
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
}) {
  return (
    <Field {...field}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          name={id}
          value={value}
          required={field.required}
          disabled={field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          /* Native select chrome kept on purpose — the OS chevron is the most
             recognisable affordance and this is a utilitarian ops tool. */
          className={controlClass(invalid)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function TextAreaField({
  value,
  onChange,
  rows = 4,
  ...field
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <Field {...field}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          name={id}
          rows={rows}
          value={value}
          required={field.required}
          disabled={field.disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={controlClass(invalid, "min-h-24 resize-y leading-normal")}
        />
      )}
    </Field>
  );
}
