"use client";

import { useId } from "react";
import { Checkbox } from "@/components/ui/primitives/checkbox";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/primitives/radio-group";
import { cn } from "@/lib/utils";

/**
 * Grouped-choice form primitives, companions to `Field.tsx`.
 *
 * Both render a real `<fieldset>` + `<legend>` rather than a labelled div, so
 * a screen reader announces the group name before each option instead of
 * reading orphaned controls.
 *
 * The controls themselves are shadcn/ui's Radix-backed `RadioGroup` and
 * `Checkbox`. Radix owns roving-tabindex arrow-key navigation inside the radio
 * group (which native radios only get right when every input shares a `name`
 * *and* a document), the `data-state` hooks the Blueprint styling keys off,
 * and the indicator markup. `Checkbox` stays a per-item control rather than a
 * second Radix root because the list is a plain multi-select, not a group with
 * its own roving focus.
 */

function Legend({ children, required }: { children: string; required?: boolean }) {
  return (
    <legend className="text-body-1 font-medium text-text-high">
      {children}
      {!required && (
        <span className="ml-ds-xs font-normal text-muted-foreground">(optional)</span>
      )}
    </legend>
  );
}

/**
 * Shown when a group has nothing to offer. An empty bordered box reads as a
 * rendering fault, and "nothing is set up yet" is the thing the user actually
 * needs to know before they go looking for the missing options.
 */
function EmptyOptions({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-dashed border-outline-med bg-surface-2 px-ds-md py-ds-sm text-body-1 text-muted-foreground">
      {children}
    </p>
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
 * Used where the choice changes what the rest of the form asks for: burying
 * that consequence behind a collapsed dropdown hides it until after the click.
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
      className="flex flex-col gap-ds-sm"
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
    >
      <Legend required={required}>{legend}</Legend>

      {options.length === 0 ? (
        <EmptyOptions>No options are available for this field yet.</EmptyOptions>
      ) : (
        <RadioGroup
          name={name}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={cn("grid grid-cols-1 gap-ds-sm", grid)}
        >
          {options.map((option) => {
            const selected = option.value === value;
            const itemId = `${groupId}-${option.value}`;
            return (
              /* The focus ring is hoisted from the (visually tiny) control
                 onto the whole card via `has-[:focus-visible]`, so keyboard
                 position is legible at the same scale as the hit target.
                 `cursor-*` is branched rather than layered: two cursor
                 utilities on one element resolve by stylesheet order, not by
                 the order they appear in the class string. */
              <label
                key={option.value}
                htmlFor={itemId}
                className={cn(
                  "flex min-h-11 items-start gap-ds-sm rounded-lg border px-ds-md py-ds-sm",
                  "transition-colors duration-100 ease-move",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-med",
                  selected
                    ? "border-primary-med bg-primary-wash"
                    : "border-outline-low bg-surface-1 hover:border-outline-med hover:bg-surface-2",
                  disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
              >
                <RadioGroupItem
                  id={itemId}
                  value={option.value}
                  /* Ring suppressed here because the label above draws it. */
                  className="mt-[5px] focus-visible:ring-0"
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-body-1 text-text-high",
                      selected ? "font-semibold" : "font-medium",
                    )}
                  >
                    {option.label}
                  </span>
                  {option.description && (
                    <span className="mt-ds-xxs block text-caption-2 text-muted-foreground">
                      {option.description}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      )}

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
    </fieldset>
  );
}

export interface CheckboxOption extends ChoiceOption {
  /** Optional grouping key, rendered as a small heading above its options. */
  group?: string;
}

/**
 * Multi-select as a checkbox list.
 *
 * Chosen over a `<select multiple>`: the native multiple-select requires
 * ctrl-click to add a second entry, silently drops the rest of the selection
 * on a plain click, and is close to unusable on touch.
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
      className="flex flex-col gap-ds-sm"
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-ds-sm">
        <Legend required={required}>{legend}</Legend>
        <span className="font-data text-caption-2 tabular-nums text-muted-foreground">
          {values.length === 0 ? emptyLabel : `${values.length} selected`}
        </span>
      </div>

      {options.length === 0 ? (
        <EmptyOptions>No options are available for this field yet.</EmptyOptions>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-outline-low bg-surface-1">
          {[...groups.entries()].map(([group, groupOptions]) => (
            <div
              key={group || "ungrouped"}
              className="border-b border-outline-low last:border-b-0"
            >
              {group && (
                <p className="annotation bg-surface-2 px-ds-md py-ds-xs">{group}</p>
              )}
              {groupOptions.map((option) => {
                const itemId = `${groupId}-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={itemId}
                    className={cn(
                      "flex min-h-11 items-center gap-ds-sm border-b border-outline-low px-ds-md py-ds-xs last:border-b-0",
                      "transition-colors duration-100 ease-move",
                      "has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-primary-med",
                      disabled
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:bg-surface-2",
                    )}
                  >
                    <Checkbox
                      id={itemId}
                      checked={selected.has(option.value)}
                      disabled={disabled}
                      onCheckedChange={() => toggle(option.value)}
                      className="focus-visible:ring-0"
                    />
                    <span className="text-body-1 text-text-high">{option.label}</span>
                    {option.description && (
                      <span className="ml-auto pl-ds-sm text-caption-2 text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}

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
    </fieldset>
  );
}
