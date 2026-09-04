import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { Wordmark } from "@/components/shell/Wordmark";

/**
 * Public shell for the landing page.
 *
 * No rail, no top bar: this route group deliberately sits outside
 * `(dashboard)`, so it carries none of the authenticated app chrome. The
 * page itself (not this layout) checks the session and redirects signed-in
 * visitors to `/home`, so a logged-out header is the only state this shell
 * ever needs to render. The only route out is `/login`.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-shell">
      <a
        href="#main"
        className="sr-only z-50 rounded-sm bg-surface-1 px-ds-2xl py-ds-lg text-body-1 font-semibold text-primary-high outline-none focus:not-sr-only focus:absolute focus:top-ds-lg focus:left-ds-lg focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-outline-low bg-surface-shell/90 backdrop-blur-[2px]">
        <div className="mx-auto flex h-14 w-full max-w-page items-center justify-between gap-ds-2xl px-ds-2xl lg:px-ds-7xl">
          <Wordmark href="/" />
          <div className="flex items-center gap-ds-xl">
            <span className="hidden text-body-1 text-text-low sm:inline">
              Anwar Group internal system
            </span>
            <ButtonLink href="/login" variant="primary">
              Sign in
            </ButtonLink>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-outline-low">
        <div className="mx-auto flex w-full max-w-page flex-col gap-ds-xl px-ds-2xl py-ds-7xl lg:flex-row lg:items-baseline lg:justify-between lg:px-ds-7xl">
          <p className="max-w-[62ch] text-pretty text-caption-2 text-text-low">
            Internal system. Anwar Group AI &amp; Digital Transformation. Access
            requires an Anwar Group account and is recorded in the audit log.
          </p>
          <p className="annotation">ProjectFlow</p>
        </div>
      </footer>
    </div>
  );
}
