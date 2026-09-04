import type { ReactNode } from "react";

/**
 * Overview-page chrome for graphic-led sections — the sibling to
 * `SectionBlock` (heading rule + list of rows). Where `SectionBlock` suits
 * genuinely list-shaped content, `Movement` is for a full-bleed graphic: a
 * bigger title set at `heading-2`, an eyebrow above it, and an optional aside
 * reading. Alternating the two down a page is what gives the dashboards a
 * real rhythm instead of one shape repeated to the bottom.
 */
export function Movement({
  eyebrow,
  title,
  aside,
  className = "",
  children,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`border-t border-outline-low pt-ds-7xl ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-ds-2xl gap-y-ds-xxs">
        <div>
          <span className="annotation block">{eyebrow}</span>
          <h2 className="mt-ds-xs text-heading-2 font-semibold text-text-high">
            {title}
          </h2>
        </div>
        {aside && (
          <div className="shrink-0 text-body-1 text-muted-foreground">
            {aside}
          </div>
        )}
      </div>
      <div className="mt-ds-6xl">{children}</div>
    </section>
  );
}
