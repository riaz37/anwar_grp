import Link from "next/link";

/**
 * Wordmark only — no logo design. The brass mark is an outlined square so it
 * holds contrast in both light and dark surfaces without a filled swatch.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`flex min-h-11 items-center gap-sm rounded-sm ${className}`}
    >
      <span
        aria-hidden="true"
        className="grid size-6 shrink-0 place-items-center rounded-sm border-[1.5px] border-accent font-display text-caption font-semibold text-accent-ink"
      >
        A
      </span>
      <span className="font-display text-subhead font-semibold tracking-[-0.015em] text-text">
        Talent<span className="text-accent-ink">Flow</span>
      </span>
      <span className="sr-only">— Anwar Group, home</span>
    </Link>
  );
}
