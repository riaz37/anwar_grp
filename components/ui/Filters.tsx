"use client";

import { useId } from "react";
import { SearchIcon } from "./icons";

/**
 * Filter-bar controls shared by the requisition and candidate tables.
 *
 * Both keep a visible label — the search field's label is visually hidden but
 * present, since its icon plus placeholder is not a label (DESIGN.md >
 * Accessibility). Filtering happens on the client against an already-loaded
 * page of rows; when these become server-driven the same components can push
 * to `useRouter` search params without changing shape.
 */

const CONTROL =
  "min-h-11 rounded-sm border border-border bg-surface px-sm text-body-sm text-text " +
  "transition-colors duration-100 ease-move hover:border-border-strong";

export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  const id = useId();
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-80">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon
        className="pointer-events-none absolute left-sm top-1/2 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${CONTROL} w-full pl-[38px]`}
      />
    </div>
  );
}

export function FilterSelect({
  value,
  onChange,
  label,
  allLabel,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-sm">
      <label
        htmlFor={id}
        className="whitespace-nowrap text-caption font-medium uppercase tracking-[0.06em] text-muted"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={CONTROL}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
