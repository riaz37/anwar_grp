import Link from "next/link";
import { LogoMark } from "./LogoMark";

/**
 * The mark holds contrast on both light and dark surfaces without a filled
 * swatch (`currentColor` fill inherits `text-primary-high`).
 *
 * `href` defaults to the authenticated home. The public landing page passes
 * `/` instead, so a logged-out visitor clicking the masthead is not bounced
 * through a redirect into the sign-in screen.
 */
export function Wordmark({
  className = "",
  href = "/home",
  labelClassName = "truncate",
}: {
  className?: string;
  href?: string;
  /** Controls the label's visibility independent of the mark itself, so the
   *  same component can be icon-only on the 768–1023px rail and full on the
   *  304px desktop rail / mobile drawer (DESIGN.md > Layout). Pass e.g.
   *  `"hidden truncate lg:inline"` for a rail that only labels itself once
   *  it's wide enough to hold the word. */
  labelClassName?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex h-10 items-center gap-ds-lg rounded-lg outline-none transition-colors duration-150 ease-move focus-visible:ring-2 focus-visible:ring-ring/60 ${className}`}
    >
      <LogoMark className="size-8 shrink-0 rounded-lg bg-primary-wash p-1.5 text-primary-high transition-colors duration-150 ease-move" />
      <span
        className={`${labelClassName} text-title-1 font-semibold tracking-[-0.01em] text-text-high`}
      >
        Project<span className="text-primary-high">Flow</span>
      </span>
      <span className="sr-only">, Anwar Group, home</span>
    </Link>
  );
}
