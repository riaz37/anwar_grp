"use client";

import type { ReactNode } from "react";
import { Input } from "@/components/ui/primitives/input";
import { Label } from "@/components/ui/primitives/label";
import { Textarea } from "@/components/ui/primitives/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { cn } from "@/lib/utils";

/**
 * Form primitives for the project create/edit forms.
 *
 * Controls are shadcn/ui `Input` / `Textarea` / `Label` and Radix `Select`.
 * The wrapper below is what shadcn's own `Form` would otherwise provide — but
 * without react-hook-form, which these forms don't use.
 *
 * Every control here is label-first (placeholders are never used as labels),
 * has a ≥44px hit area, wires `aria-invalid`/`aria-describedby` to its error
 * and hint text, and renders its error inline beneath the control rather than
 * summarising errors elsewhere. Forms cap at 720px per DESIGN.md > Layout.
 */

/**
 * `disabled` gets a sunken fill as well as reduced opacity: opacity alone on a
 * white control reads as "this page is still loading", while the recessed
 * surface reads as "this control is not yours to change" — which is what a
 * read-only field on a role-scoped record actually means here.
 */
const CONTROL =
  "w-full px-ds-sm py-ds-sm text-body-2 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-100";

function controlClass(invalid: boolean, extra = ""): string {
  return cn(CONTROL, invalid && "border-danger-med", extra);
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
    <div className="flex flex-col gap-ds-xxs">
      <Label htmlFor={id} className="text-body-1 font-medium text-text-high">
        {label}
        {!required && (
          <span className="ml-ds-xs font-normal text-muted-foreground">(optional)</span>
        )}
      </Label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {/* Hint sits *below* the control, not between label and control: with it
          above, a hinted field and an un-hinted one side by side in the same
          grid row have their inputs at different heights, and the form stops
          reading as a grid (DESIGN.md > Layout: grid-disciplined). */}
      {hint && (
        <p id={hintId} className="text-caption-2 text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-body-1 text-danger-high">
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
        <Input
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
        <Input
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
        /* Radix Select rather than a native `<select>`: it carries the same
           focus ring and open/close animation as every other control, and its
           listbox can be styled; the native OS popup cannot. The empty
           placeholder option is gone because Radix models "nothing selected"
           as `value === undefined`, not as an option. */
        <Select
          value={value === "" ? undefined : value}
          onValueChange={onChange}
          disabled={field.disabled}
          required={field.required}
        >
          <SelectTrigger
            id={id}
            name={id}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={controlClass(invalid)}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <Textarea
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
