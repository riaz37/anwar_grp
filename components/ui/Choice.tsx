"use client";

import { useId } from "react";

/**
 * Grouped-choice form primitives, companions to `Field.tsx`.
 *
 * Both render a real `<fieldset>` + `<legend>` rather than a labelled div, so
 * a screen reader announces the group name before each option instead of
 * reading five orphaned checkboxes. Native `input` elements are kept (styled
 * with `accent-color`) — a div-with-role listbox would buy nothing here and
 * lose keyboard behaviour the browser already gets right.
 */

function Legend({
  children,
  required,
  hintId,
}: {
  children: string;
  required?: boolean;
  hintId?: string;
}) {
  return (
    <legend className="text-body-sm font-medium text-text" id={hintId}>
      {children}
      {!required && <span className="ml-xs font-normal text-muted">(optional)</span>}
    </legend>
  );
}

export interface ChoiceOption {
  value: string;
  label: string;
  /** Second line, for options that need disambiguating. */
  description?: string;
}

/**
 * Exclusive choice, laid out as labelled cards rather than a `<select>`.
 *
 * Used where the choice changes what the rest of the form asks for — the
 * in-person/online interview toggle swaps a "Location" field for an "Online
 * link" field, and burying that behind a collapsed dropdown hides the
 * consequence until after the click.
 */
export function RadioGroupField({
  legend,
  name,
  value,
  onChange,
  options,
  hint,
  error,
  required,
  disabled,
  columns = 2,
}: {
  legend: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly ChoiceOption[];
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
}) {
  const groupId = useId();
  const hintId = hint ? `${groupId}-hint` : undefined;
  const errorId = error ? `${groupId}-error` : undefined;
  const grid =
    columns === 1
      ? "sm:grid-cols-1"
      : columns === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <fieldset
      className="flex flex-col gap-sm"
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
    >
      <Legend required={required}>{legend}</Legend>

      <div className={`grid grid-cols-1 gap-sm ${grid}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-start gap-sm rounded-sm border px-md py-sm transition-colors duration-100 ease-move ${
                selected
                  ? "border-accent bg-accent-soft"
                  : "border-border bg-surface hover:border-border-strong"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="mt-[5px] size-4 shrink-0 accent-[var(--accent)]"
              />
              <span className="min-w-0">
                <span
                  className={`block text-body-sm ${selected ? "font-semibold text-text" : "font-medium text-text"}`}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span className="mt-2xs block text-caption text-muted">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>

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
    </fieldset>
  );
}

export interface CheckboxOption extends ChoiceOption {
  /** Optional grouping key — rendered as a small heading above its options. */
  group?: string;
}

/**
 * Multi-select as a checkbox list.
 *
 * Chosen over a `<select multiple>` for interview-panel assignment: the native
 * multiple-select requires ctrl-click to add a second person, silently drops
 * the rest of the selection on a plain click, and is close to unusable on
 * touch — all three of which are how a panel ends up booked with one member.
 */
export function CheckboxGroupField({
  legend,
  values,
  onChange,
  options,
  hint,
  error,
  required,
  disabled,
  emptyLabel = "None selected",
}: {
  legend: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  options: readonly CheckboxOption[];
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const groupId = useId();
  const hintId = hint ? `${groupId}-hint` : undefined;
  const errorId = error ? `${groupId}-error` : undefined;

  const selected = new Set(values);
  const groups = options.reduce<Map<string, CheckboxOption[]>>((acc, option) => {
    const key = option.group ?? "";
    acc.set(key, [...(acc.get(key) ?? []), option]);
    return acc;
  }, new Map());

  function toggle(value: string) {
    onChange(
      selected.has(value)
        ? values.filter((entry) => entry !== value)
        : [...values, value],
    );
  }

  return (
    <fieldset
      className="flex flex-col gap-sm"
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <Legend required={required}>{legend}</Legend>
        <span className="font-data text-caption tabular-nums text-muted">
          {values.length === 0 ? emptyLabel : `${values.length} selected`}
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-sm border border-border bg-surface">
        {[...groups.entries()].map(([group, groupOptions]) => (
          <div key={group || "ungrouped"} className="border-b border-border last:border-b-0">
            {group && (
              <p className="bg-surface-sunken px-md py-xs text-caption font-medium uppercase tracking-[0.06em] text-muted">
                {group}
              </p>
            )}
            {groupOptions.map((option) => (
              <label
                key={option.value}
                className={`flex min-h-11 items-center gap-sm border-b border-border px-md py-xs last:border-b-0 ${
                  disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-sunken"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(option.value)}
                  disabled={disabled}
                  onChange={() => toggle(option.value)}
                  className="size-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="text-body-sm text-text">{option.label}</span>
                {option.description && (
                  <span className="ml-auto text-caption text-muted">
                    {option.description}
                  </span>
                )}
              </label>
            ))}
          </div>
        ))}
      </div>

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
    </fieldset>
  );
}
