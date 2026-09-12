import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Chrome for the Management Dashboard's two working sections.
 *
 * Deliberately *not* a card: no border box, no radius, no elevation, no
 * descriptive paragraph. A section is a labelled rule with content hanging
 * off it, so the page reads as one dense console rather than a stack of
 * padded panels. (Replaces the former `Panel` treatment on this page —
 * repeating that shape three times in a row was the whole complaint.)
 *
 * The header is one line: label · count · controls. The count belongs to the
 * section it describes, which is why this page has no separate KPI tile row.
 */
export function BoardSection({
  label,
  count,
  headingId,
  controls,
  footer,
  className,
  children,
}: {
  label: string;
  /** Short factual qualifier set in the data face, e.g. "8 off track". */
  count: string;
  headingId: string;
  /** Filters/toggles sitting on the header rule, right-aligned. */
  controls?: ReactNode;
  /** Hairline row under the content: paging, totals, secondary affordances. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn("flex min-w-0 flex-col", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-ds-2xl gap-y-ds-md border-b border-outline-med pb-ds-md">
        <h2 className="flex min-w-0 items-baseline gap-ds-md" id={headingId}>
          <span className="annotation">{label}</span>
          <span className="truncate font-data text-caption-2 tabular-nums text-text-med">
            {count}
          </span>
        </h2>
        {controls && (
          <div className="flex flex-wrap items-center gap-ds-2xl">{controls}</div>
        )}
      </div>

      <div className="min-w-0">{children}</div>

      {/* Sits directly under the content, not pushed to the bottom of the
          grid row — the two sections have very different natural heights and
          a legend stranded 400px below its chart reads as a page footer. */}
      {footer && (
        <div className="mt-ds-md flex flex-wrap items-center justify-between gap-ds-md border-t border-outline-base pt-ds-md">
          {footer}
        </div>
      )}
    </section>
  );
}

/**
 * Section-level empty state. One sentence that states the cleared condition —
 * a manager needs to know the list is empty *because everything is fine*, not
 * because the query failed, and that takes a line, not a paragraph.
 */
export function BoardEmpty({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success";
  children: ReactNode;
}) {
  return (
    <p className="flex items-start gap-ds-md py-ds-7xl text-body-1 text-text-med">
      <span
        aria-hidden="true"
        className={cn(
          "mt-[9px] size-1.5 shrink-0 rounded-pill",
          tone === "success" ? "bg-success-med" : "bg-text-low",
        )}
      />
      <span className="max-w-[46ch] text-pretty">{children}</span>
    </p>
  );
}
