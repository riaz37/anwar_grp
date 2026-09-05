import type { ReactNode } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Wordmark } from "@/components/shell/Wordmark";

/**
 * Public shell for the landing page.
 *
 * This route group sits outside `(dashboard)`, so it carries none of the
 * authenticated app chrome — no rail, no top bar, no theme toggle. The page
 * itself (not this layout) checks the session and redirects signed-in
 * visitors to `/home`, so a logged-out masthead is the only state this shell
 * ever renders. The only route out is `/login`.
 *
 * Visual idea: the whole marketing surface is treated as a specification
 * sheet — hairline rules, monospaced ordinals, nothing centred. The masthead
 * opens with a short accent tick at the very top edge, the same "gauge mark"
 * the section ordinals use, so the brand pigment appears once as structure
 * rather than as decoration sprayed over every panel.
 */

const CONTENTS: { href: string; label: string }[] = [
  { href: "#guarantees", label: "The guarantees" },
  { href: "#pipeline", label: "The pipeline" },
  { href: "#health", label: "Health" },
  { href: "#authority", label: "Authority" },
  { href: "#portfolio", label: "Demo portfolio" },
];

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface-shell">
      <a
        href="#main"
        /* `text-high` on `surface-3`, not the accent: at 40% lime the accent
           cannot hold 4.5:1 on a light surface (DESIGN.md > Accessibility),
           and a skip link is the one control that must always be readable. */
        className="sr-only z-50 rounded-sm border border-outline-med bg-surface-3 px-ds-2xl py-ds-lg text-body-1 font-semibold text-text-high shadow-e2 outline-none focus:not-sr-only focus:absolute focus:top-ds-lg focus:left-ds-lg focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        Skip to content
      </a>

      {/* Gauge tick: 64px of accent against the full-width hairline. */}
      <div aria-hidden="true" className="h-px w-full bg-outline-med">
        <div className="mx-auto w-full max-w-page px-ds-2xl lg:px-ds-7xl">
          <div className="h-px w-16 bg-primary-med" />
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-outline-low bg-surface-shell/85 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 w-full max-w-page items-center justify-between gap-ds-2xl px-ds-2xl py-ds-xl lg:px-ds-7xl">
          <Wordmark href="/" />
          <div className="flex items-center gap-ds-2xl">
            <span className="annotation hidden md:inline">
              Internal system
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

      <footer className="border-t border-outline-med">
        <div className="mx-auto w-full max-w-page px-ds-2xl py-ds-9xl lg:px-ds-7xl">
          <div className="flex flex-col gap-ds-9xl lg:flex-row lg:justify-between">
            <p className="max-w-[52ch] text-pretty text-body-1 text-text-med">
              ProjectFlow is maintained by AI &amp; Digital Transformation,
              Corporate IT, Anwar Group. Access requires an Anwar Group account.
              Every stage change, blocker, delay reason and scope change is
              attributed to a person and timestamped.
            </p>

            <nav aria-label="Page contents" className="lg:min-w-[16rem]">
              <p className="annotation">Contents</p>
              <ul className="mt-ds-2xl flex flex-wrap gap-x-ds-5xl gap-y-ds-xs lg:flex-col lg:gap-y-ds-xs">
                {CONTENTS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex min-h-11 items-center text-body-1 text-text-med transition-colors duration-150 ease-move hover:text-text-high lg:min-h-0 lg:py-ds-xxs"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <p className="annotation mt-ds-9xl border-t border-outline-low pt-ds-5xl">
            ProjectFlow &middot; Anwar Group
          </p>
        </div>
      </footer>
    </div>
  );
}
