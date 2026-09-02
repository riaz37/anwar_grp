"use client";

import { useRef, type KeyboardEvent } from "react";

/**
 * Second-level tab strip, used *inside* one application's panel to separate
 * the pipeline, screening, interviews and messages views.
 *
 * Why tabs at all: those four sections stacked vertically make the Candidate
 * Workspace a scroll of roughly six screens, and the recruiter is only ever in
 * one of them at a time. Progressive disclosure keeps the page readable
 * without hiding anything behind a navigation change — every section is one
 * key press away and the counts on the tabs mean nothing is invisible.
 *
 * Why it looks nothing like the application tab strip above it: two identical
 * tab strips stacked would be genuinely ambiguous about which level a click
 * acts on. The outer strip is underlined cards; this one is a compact
 * segmented row.
 *
 * ARIA: `tablist`/`tab`/`tabpanel` with a roving tabindex, matching
 * `CandidateWorkspace`. The panels are rendered by the caller so each can own
 * its own state.
 */

export interface SectionTab {
  id: string;
  label: string;
  /** Small count shown after the label. `0` renders as a muted zero, not hidden —
   *  "0 interviews" is information; a missing badge is ambiguous. */
  count?: number;
  /** Marks the tab as needing attention (e.g. a failed message). */
  attention?: boolean;
}

export function SectionTabs({
  tabs,
  activeId,
  onChange,
  label,
  idPrefix,
}: {
  tabs: readonly SectionTab[];
  activeId: string;
  onChange: (id: string) => void;
  label: string;
  idPrefix: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusTab(index: number) {
    const bounded = (index + tabs.length) % tabs.length;
    const target = tabs[bounded];
    onChange(target.id);
    refs.current[target.id]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(tabs.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className="flex flex-wrap gap-xs rounded-sm border border-border bg-surface-sunken p-xs"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-sm whitespace-nowrap rounded-sm px-md text-body-sm transition-colors duration-100 ease-move sm:flex-none ${
              selected
                ? "bg-surface font-semibold text-text shadow-[inset_0_0_0_1px_var(--border-strong)]"
                : "font-medium text-muted hover:bg-surface hover:text-text"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="font-data text-caption tabular-nums text-muted">
                {tab.count}
              </span>
            )}
            {tab.attention && (
              <>
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-error"
                />
                {/* The dot is the only visual signal, so it needs a spoken
                    equivalent — a screen-reader user otherwise hears an
                    ordinary tab with a count. */}
                <span className="sr-only">needs attention</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Panel body for a `SectionTabs` tab. Keeps the ARIA wiring in one place. */
export function SectionTabPanel({
  id,
  idPrefix,
  active,
  children,
}: {
  id: string;
  idPrefix: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      hidden={!active}
      tabIndex={0}
      className="mt-lg focus-visible:outline-offset-4"
    >
      {active && children}
    </div>
  );
}
