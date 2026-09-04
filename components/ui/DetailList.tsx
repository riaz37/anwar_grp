import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/primitives/card";
import { cn } from "@/lib/utils";

/**
 * Definition list for record fields. A real `<dl>` rather than a grid of divs,
 * so a screen reader announces "Business unit: Anwar Textiles" as a pair.
 *
 * Columns are set by the caller; detail panels cap at 720px per DESIGN.md >
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
    <dl className={cn("grid grid-cols-1 gap-x-ds-xl gap-y-ds-lg", grid)}>{children}</dl>
  );
}

/**
 * One label/value pair, drawn the way a technical drawing annotates a
 * dimension: a hairline leader down the left edge, the label set as small
 * uppercase caption text above the value it names.
 */
export function DetailItem({
  label,
  children,
  /** Numeric or date values get the mono numeral face (DESIGN.md > Typography). */
  numeric = false,
  span = false,
}: {
  label: string;
  children: ReactNode;
  numeric?: boolean;
  span?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-l border-outline-low pl-ds-md",
        span && "sm:col-span-full",
      )}
    >
      <dt className="annotation">{label}</dt>
      <dd
        className={cn(
          "mt-ds-xxs text-pretty text-body-1 text-text-high",
          numeric && "font-data tabular-nums",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * Titled panel used to group a detail view's sections.
 *
 * Built on shadcn/ui's `Card`, retuned to this app's register: the stock
 * card's drop shadow is dropped in favour of a hairline, because DESIGN.md
 * reserves elevation for things that genuinely float. A panel never contains
 * another panel; nested groupings use a rule and a heading instead.
 */
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
    <Card
      asChild
      className="gap-0 overflow-hidden border-outline-low py-0 shadow-none"
    >
      <section aria-labelledby={headingId}>
        <CardHeader className="flex flex-wrap items-start justify-between gap-ds-md border-b border-outline-low px-ds-md py-ds-md lg:px-ds-lg">
          <div className="min-w-0 flex-1">
            <CardTitle asChild>
              <h2 id={headingId} className="text-balance text-title-1 text-text-high">
                {title}
              </h2>
            </CardTitle>
            {description && (
              <CardDescription className="mt-ds-xxs max-w-[62ch] text-pretty text-body-1">
                {description}
              </CardDescription>
            )}
          </div>
          {/* `shrink-0` keeps a two-button action group from being squeezed
              into a stack while the title still has room to wrap. */}
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-ds-sm">
              {actions}
            </div>
          )}
        </CardHeader>
        <CardContent className="px-ds-md py-ds-md lg:px-ds-lg lg:py-ds-lg">
          {children}
        </CardContent>
      </section>
    </Card>
  );
}
