"use client";

import Link from "next/link";
import type { NavItem } from "./nav-items";

/**
 * `rail` is responsive by CSS rather than by prop: icons-only at 768–1023px,
 * icon + label at ≥1024px (DESIGN.md > Layout). The label stays in the
 * accessibility tree at every breakpoint via `sr-only`/`not-sr-only`, and the
 * `title` attribute gives sighted tablet users a tooltip.
 */
type Variant = "rail" | "drawer";

const BASE =
  "group relative flex min-h-11 items-center gap-sm rounded-sm text-body-sm font-medium " +
  "transition-colors duration-100 ease-move " +
  "text-muted hover:bg-surface-sunken hover:text-text " +
  "aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent-ink " +
  // 3px brass marker on the active item — the only place nav uses accent fill.
  "before:absolute before:left-0 before:top-1/2 before:hidden before:h-5 before:w-[3px] " +
  "before:-translate-y-1/2 before:rounded-full before:bg-accent " +
  "aria-[current=page]:before:block";

const VARIANTS: Record<Variant, string> = {
  rail: "justify-center px-sm lg:justify-start lg:px-md",
  drawer: "px-md",
};

const LABELS: Record<Variant, string> = {
  rail: "sr-only lg:not-sr-only lg:truncate",
  drawer: "truncate",
};

export function NavLink({
  item,
  active,
  variant,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  variant: Variant;
  onNavigate?: () => void;
}) {
  const { icon: ItemIcon, label, href } = item;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={variant === "rail" ? label : undefined}
      onClick={onNavigate}
      className={`${BASE} ${VARIANTS[variant]}`}
    >
      <ItemIcon className="shrink-0" />
      <span className={LABELS[variant]}>{label}</span>
    </Link>
  );
}
