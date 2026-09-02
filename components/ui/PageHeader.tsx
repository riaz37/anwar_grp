import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeftIcon } from "./icons";

/**
 * Page-level heading block. Matches the Home dashboard's treatment (title +
 * one-line explanation, rule beneath, actions right-aligned) so every top-level
 * view in the app opens the same way.
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
  /** Small label above the title — used for the record reference on details. */
  eyebrow?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  /** Right-aligned supporting text, e.g. a count or timestamp. */
  meta?: ReactNode;
}) {
  return (
    <div className="border-b border-border pb-lg">
      {backHref && (
        <Link
          href={backHref}
          className="-ml-xs mb-sm inline-flex min-h-11 items-center gap-xs rounded-sm pr-sm text-body-sm font-medium text-muted transition-colors duration-100 ease-move hover:text-text"
        >
          <ArrowLeftIcon />
          {backLabel ?? "Back"}
        </Link>
      )}

      <div className="flex flex-wrap items-end justify-between gap-md">
        <div className="min-w-0">
          {eyebrow && (
            <p className="font-data text-caption font-medium uppercase tracking-[0.08em] tabular-nums text-muted">
              {eyebrow}
            </p>
          )}
          <h1 className="text-title text-text">{title}</h1>
          {description && (
            <p className="mt-2xs max-w-[62ch] text-body text-muted">
              {description}
            </p>
          )}
        </div>

        {(actions || meta) && (
          <div className="flex flex-wrap items-center gap-md">
            {meta}
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
