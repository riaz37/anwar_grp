"use client";

import { useId } from "react";
import type { EvaluationCriterion } from "@/lib/types/domain";

/**
 * One scored criterion on an evaluation form.
 *
 * Native radios inside a real `<fieldset>`/`<legend>`, styled as a segmented
 * row of numbers. Chosen over the two obvious alternatives on purpose:
 *
 *  - Stars would be decoration dressed as data. They cap at five by
 *    convention, and this form's scale is per-template config (one of the
 *    mock templates runs to ten), so the metaphor breaks on the first
 *    leadership round.
 *  - A range slider gives no keyboard-visible current value, no discrete
 *    labels, and no way to say "not scored yet" — which is the state every
 *    criterion starts in and half of them stay in on a saved draft.
 *
 * Every target is ≥44px (DESIGN.md > Accessibility) and the whole group is
 * arrow-key navigable for free, because the browser already does that for a
 * radio group.
 */
export function ScoreScale({
  criterion,
  value,
  onChange,
  disabled,
  error,
}: {
  criterion: EvaluationCriterion;
  /** Undefined means "not scored yet", which is a real, savable state. */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
  error?: string;
}) {
  const groupId = useId();
  const hintId = `${groupId}-hint`;
  const errorId = error ? `${groupId}-error` : undefined;
  const points = Array.from({ length: criterion.scoreMax }, (_, i) => i + 1);

  return (
    <fieldset
      className="flex flex-col gap-sm"
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ")}
      aria-invalid={error ? true : undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-2xs">
        <legend className="text-body-sm font-medium text-text">
          {criterion.label}
        </legend>
        <span className="font-data text-caption tabular-nums text-muted">
          {value === undefined ? "Not scored" : `${value} / ${criterion.scoreMax}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        {points.map((point) => {
          const selected = value === point;
          return (
            <label
              key={point}
              className={`inline-flex ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              {/* The input is visually hidden but still the focused element,
                  so the *ring* has to be moved onto the visible box with
                  `peer-focus-visible` — an `sr-only` input on its own would
                  give a keyboard user a focus indicator they cannot see. */}
              <input
                type="radio"
                name={groupId}
                value={point}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(point)}
                className="peer sr-only"
              />
              <span
                className={`inline-flex size-11 items-center justify-center rounded-sm border font-data text-body-sm tabular-nums transition-colors duration-100 ease-move peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                  selected
                    ? "border-accent bg-accent-soft font-semibold text-accent-ink"
                    : "border-border bg-surface text-text hover:border-border-strong"
                } ${disabled ? "opacity-60" : ""}`}
              >
                <span aria-hidden="true">{point}</span>
                <span className="sr-only">
                  {point} out of {criterion.scoreMax} for {criterion.label}
                </span>
              </span>
            </label>
          );
        })}

        {value !== undefined && !disabled && (
          /* Radios cannot be unset by clicking, and "I scored this by mistake"
             is a real thing on a draft that stays open for a week. */
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="inline-flex min-h-11 items-center rounded-sm px-sm text-body-sm font-medium text-accent-ink transition-colors duration-100 ease-move hover:bg-accent-soft"
          >
            Clear
            <span className="sr-only"> the score for {criterion.label}</span>
          </button>
        )}
      </div>

      <p id={hintId} className="max-w-[62ch] text-caption text-muted">
        {criterion.description}
        {criterion.description ? " · " : ""}1 is well below the bar,{" "}
        {criterion.scoreMax} is outstanding.
      </p>

      {error && (
        <p id={errorId} className="text-body-sm text-error-ink">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Read-only counterpart, used everywhere a submitted evaluation is shown. */
export function ScoreReadout({
  criteria,
  scores,
}: {
  criteria: readonly EvaluationCriterion[];
  scores: Record<string, number>;
}) {
  return (
    <dl className="flex flex-col divide-y divide-border border-y border-border">
      {criteria.map((criterion) => {
        const score = scores[criterion.key];
        return (
          <div
            key={criterion.key}
            className="flex items-baseline justify-between gap-md py-sm"
          >
            <dt className="text-body-sm text-text">{criterion.label}</dt>
            <dd className="font-data text-body-sm tabular-nums text-text">
              {score === undefined ? (
                <span className="text-muted">Not scored</span>
              ) : (
                <>
                  <span className="font-semibold">{score}</span>
                  <span className="text-muted"> / {criterion.scoreMax}</span>
                </>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
