import type { ReactNode } from "react";
import { Wordmark } from "@/components/shell/Wordmark";

/**
 * Shared frame for the out-of-shell status pages (404, route error,
 * root-layout error). These render outside `AppShell`, so they carry their own
 * masthead; otherwise a user who lands on a bad URL loses every route back
 * into the product.
 *
 * Deliberately left-aligned rather than the usual centred icon-over-heading
 * stack. DESIGN.md's decoration level is minimal — a status code set large in
 * the mono numeral face beside a lime registration mark reads as a system
 * response, which is what it is, with no illustration needed.
 *
 * `actions` is supplied by the caller as shadcn-backed `ButtonLink`s, so the
 * routes out of here are real anchors with the app's 44px hit area.
 */
export function StatusScreen({
  code,
  codeLabel,
  title,
  children,
  actions,
  footnote,
}: {
  /** Numeric status, set in the mono numeral face, e.g. `404`. */
  code: string;
  /** Short uppercase word beside the code, e.g. `Not found`. */
  codeLabel: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-shell">
      <header className="border-b border-outline-low bg-surface-1">
        <div className="mx-auto flex h-14 w-full max-w-form items-center px-ds-2xl">
          <Wordmark />
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center px-ds-2xl py-16">
        <div className="mx-auto w-full max-w-form">
          <p className="flex items-baseline gap-ds-2xl border-l-2 border-primary-med pl-ds-2xl">
            <span className="font-data text-metric font-medium tabular-nums text-text-high">
              {code}
            </span>
            <span className="annotation">{codeLabel}</span>
          </p>

          <h1 className="mt-ds-5xl text-balance text-display-1 font-semibold text-text-high">
            {title}
          </h1>

          <div className="mt-ds-xs max-w-[58ch] text-pretty text-para text-muted-foreground">
            {children}
          </div>

          <div className="mt-ds-7xl flex flex-wrap items-center gap-ds-md">
            {actions}
          </div>

          {footnote && (
            <p className="mt-ds-9xl max-w-[58ch] border-t border-border pt-ds-2xl text-caption-1 text-muted-foreground">
              {footnote}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
