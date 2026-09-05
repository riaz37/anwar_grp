import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowLeftIcon } from "./icons";

/**
 * Page-level heading block. Every top-level view in the app opens the same
 * way, which is what makes the shell feel like one drawing rather than a set
 * of unrelated screens.
 *
 * Treatment: the eyebrow is set as a drawing annotation in the mono
 * numeral face, and the block closes on a hairline rather than a card edge.
 * The back affordance is a real `ButtonLink` (shadcn `Button` with
 * `asChild`), so it keeps anchor semantics and the 44px hit area.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  backHref,
  backLabel,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  /** Small label above the title, used for the record reference on details. */
  eyebrow?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  /** Right-aligned supporting text, e.g. a count or timestamp. */
  meta?: ReactNode;
}) {
  return (
    <header className="border-b border-outline-low pb-ds-lg">
      {backHref && (
        <ButtonLink
          href={backHref}
          variant="ghost"
          className="-ml-3 mb-ds-sm text-muted-foreground hover:bg-surface-2 hover:text-text-high"
        >
          <ArrowLeftIcon />
          {backLabel ?? "Back"}
        </ButtonLink>
      )}

      <div className="flex flex-wrap items-end justify-between gap-ds-md">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="annotation font-data tabular-nums">{eyebrow}</p>
          )}
          <h1 className="text-balance text-display-1 font-semibold text-text-high">{title}</h1>
          {description && (
            <p className="mt-ds-xs max-w-[62ch] text-pretty text-body-2 text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {(actions || meta) && (
          <div className="flex shrink-0 flex-wrap items-center gap-ds-md">
            {meta}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
