"use client";

import { useId } from "react";
import { CloseIcon } from "@/components/shell/icons";
import { SearchIcon } from "./icons";
import { Input } from "@/components/ui/primitives/input";
import { Label } from "@/components/ui/primitives/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";

/**
 * Filter-bar controls shared by the portfolio and my-work tables.
 *
 * Both keep a real label — the search field's is visually hidden but present,
 * since an icon plus a placeholder is not a label (DESIGN.md > Accessibility).
 * Filtering happens on the client against an already-loaded page of rows; when
 * these become server-driven the same components can push to `useRouter`
 * search params without changing shape.
 *
 * Built on shadcn/ui `Input` and Radix `Select`. Radix replaces the native
 * `<select>` so the option list can be styled, animates on open/close, and
 * carries the same focus ring as every other control instead of the OS popup's.
 */

/** All-option sentinel. Radix `SelectItem` rejects `value=""`, which it
 *  reserves for "no selection", so the empty filter needs a real token. */
const ALL = "__all__";

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
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <SearchIcon
        className="pointer-events-none absolute left-ds-sm top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        /* `type="text"`, not `search`: the WebKit clear affordance is
           unstyleable, keyboard-unreachable and disappears in Firefox, so the
           clear control below replaces it consistently. */
        type="text"
        role="searchbox"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        /* Escape clears the query, matching the native search-field
           convention. Otherwise a keyboard user has to select-all-delete. */
        onKeyDown={(event) => {
          if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            onChange("");
          }
        }}
        className="pl-[calc(var(--spacing-ds-sm)*2+20px)] pr-11"
      />
      {value !== "" && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute right-0 top-1/2 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-[color,background-color] duration-100 ease-[var(--ease-move)] hover:bg-surface-2 hover:text-foreground motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-100"
        >
          <CloseIcon className="size-4" aria-hidden="true" />
        </button>
      )}
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
    <div className="flex items-center gap-ds-sm">
      <Label
        htmlFor={id}
        className="whitespace-nowrap annotation"
      >
        {label}
      </Label>
      <Select
        value={value === "" ? ALL : value}
        onValueChange={(next) => onChange(next === ALL ? "" : next)}
      >
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
