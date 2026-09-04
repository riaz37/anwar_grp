/**
 * Shared table class strings.
 *
 * Deliberately NOT in `SortableHeader.tsx`: that file is `"use client"`, and a
 * plain string exported from a client module becomes a client-reference proxy
 * when a server component imports it. Used directly it still renders, but
 * interpolated into a template literal it stringifies to the proxy's error
 * text and silently drops every class. Keeping these in a server-safe module
 * removes the trap entirely.
 */

/** Column header cell: dense, uppercase caption, bottom-aligned. */
export const TH_BASE =
  "whitespace-nowrap px-ds-xs py-ds-sm text-left align-bottom text-caption-2 font-medium sm:px-ds-sm md:px-ds-md " +
  "uppercase tracking-[0.08em] text-muted-foreground";

/** Body cell: comfortable density per DESIGN.md, top-aligned for wrapping rows. */
export const TD_BASE = "px-ds-xs py-ds-sm align-top text-body-1 sm:px-ds-sm md:px-ds-md";
