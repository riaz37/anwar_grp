"use client";

import type { ReactNode } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives/tabs";
import { cn } from "@/lib/utils";

/**
 * Second-level tab strip, used *inside* a record's workspace to separate its
 * sections.
 *
 * Why tabs at all: those sections stacked vertically make the workspace a
 * scroll of roughly six screens, and the user is only ever in one of them at a
 * time. Progressive disclosure keeps the page readable without hiding anything
 * behind a navigation change — every section is one key press away and the
 * counts on the tabs mean nothing is invisible.
 *
 * Now backed by Radix (`@radix-ui/react-tabs` via shadcn/ui). Radix owns the
 * `tablist`/`tab`/`tabpanel` wiring, the roving tabindex and Arrow/Home/End
 * handling that this component previously implemented by hand — including the
 * ref-cleanup and modulo-zero edge cases. What is kept here is the *visual*
 * decision: a compact segmented row, deliberately unlike a top-level underlined
 * strip, so two stacked tab levels are never ambiguous about which one a click
 * acts on.
 */

export interface SectionTab {
  id: string;
  label: string;
  /** Small count shown after the label. `0` renders as a muted zero, not
   *  hidden — "0 blockers" is information; a missing badge is ambiguous. */
  count?: number;
  /** Marks the tab as needing attention (e.g. an unresolved blocker). */
  attention?: boolean;
}

/**
 * Radix requires the triggers and the panels to share one root. Wrap the strip
 * and its `SectionTabPanel`s in this; `SectionTabs` and `SectionTabPanel` then
 * read their state from context.
 */
export function SectionTabsRoot({
  activeId,
  onChange,
  className,
  children,
}: {
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tabs value={activeId} onValueChange={onChange} className={cn("gap-0", className)}>
      {children}
    </Tabs>
  );
}

export function SectionTabs({
  tabs,
  label,
  idPrefix,
}: {
  tabs: readonly SectionTab[];
  label: string;
  idPrefix: string;
}) {
  // A record with no sections should render nothing: an empty `tablist` is
  // announced as a control with nothing in it and paints an empty strip.
  if (tabs.length === 0) return null;

  return (
    <TabsList
      aria-label={label}
      className="h-auto w-full flex-wrap justify-start gap-ds-xs rounded-lg border border-outline-low bg-surface-2 p-ds-xs"
    >
      {tabs.map((tab) => (
        <TabsTrigger
          key={tab.id}
          value={tab.id}
          id={`${idPrefix}-tab-${tab.id}`}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          className={cn(
            "min-h-11 flex-1 gap-ds-sm whitespace-nowrap rounded-md px-ds-md text-body-1 font-medium text-muted-foreground sm:flex-none",
            "transition-[background-color,color,box-shadow] duration-100 ease-[var(--ease-move)]",
            "hover:bg-surface-3 hover:text-foreground",
            "data-[state=active]:bg-surface-4 data-[state=active]:font-semibold data-[state=active]:text-foreground",
            "data-[state=active]:shadow-[inset_0_0_0_1px_var(--outline-high)]",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="font-data text-caption-2 tabular-nums text-muted-foreground">
              {tab.count}
            </span>
          )}
          {tab.attention && (
            <>
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-danger-med"
              />
              {/* The dot is the only visual signal, so it needs a spoken
                  equivalent: a screen-reader user otherwise hears an ordinary
                  tab with a count. */}
              <span className="sr-only">needs attention</span>
            </>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

/** Panel body for a `SectionTabs` tab. Keeps the ARIA wiring in one place. */
export function SectionTabPanel({
  id,
  idPrefix,
  children,
}: {
  id: string;
  idPrefix: string;
  children: ReactNode;
}) {
  return (
    <TabsContent
      value={id}
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      /* Panel swaps get a short cross-fade only — DESIGN.md > Motion allows
         transitions that aid comprehension, not sliding content. */
      className="mt-ds-lg focus-visible:outline-offset-4 motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-150"
    >
      {children}
    </TabsContent>
  );
}
