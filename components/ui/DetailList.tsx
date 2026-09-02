import type { ReactNode } from "react";

/**
 * Definition list for record fields. A real `<dl>` rather than a grid of divs,
 * so a screen reader announces "Business unit: Anwar Textiles" as a pair.
 *
 * Columns are set by the caller — detail panels cap at 720px per DESIGN.md >
 * Layout, which comfortably fits two columns of label + value.
 */
export function DetailList({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 1 | 2 | 3;
}) {
  const grid =
    columns === 1
      ? "sm:grid-cols-1"
      : columns === 3
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <dl className={`grid grid-cols-1 gap-x-lg gap-y-md ${grid}`}>{children}</dl>
  );
}

export function DetailItem({
  label,
  children,
  /** Numeric or date values get the tabular data face (DESIGN.md > Typography). */
  numeric = false,
  span = false,
}: {
  label: string;
  children: ReactNode;
  numeric?: boolean;
  span?: boolean;
}) {
  return (
    <div className={span ? "sm:col-span-full" : undefined}>
      <dt className="text-caption font-medium uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd
        className={`mt-2xs text-body text-text ${numeric ? "font-data tabular-nums" : ""}`}
      >
        {children}
      </dd>
    </div>
  );
}

/** Titled panel used to group a detail view's sections. */
export function Panel({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-md border border-border bg-surface"
    >
      <div className="flex flex-wrap items-start justify-between gap-md border-b border-border px-md py-md lg:px-lg">
        <div className="min-w-0">
          <h2 id={headingId} className="text-subhead text-text">
            {title}
          </h2>
          {description && (
            <p className="mt-2xs max-w-[62ch] text-body-sm text-muted">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      <div className="px-md py-md lg:px-lg lg:py-lg">{children}</div>
    </section>
  );
}
