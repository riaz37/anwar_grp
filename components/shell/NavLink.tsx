"use client";

import Link from "next/link";
import type { NavItem } from "./nav-items";

/**
 * `rail` is responsive by CSS rather than by prop: icons-only at 768–1023px,
 * icon + label at ≥1024px (DESIGN.md > Layout). The label stays in the
 * accessibility tree at every breakpoint via `sr-only`/`not-sr-only`, and the
 * `title` attribute gives sighted tablet users a tooltip.
 *
 * Row recipe is DESIGN.md > Sidebar's: 40px row, `rounded-lg`, active state
 * gets a `primary-wash` fill, `primary-high` label at 600 weight, and
 * `shadow-e1` for the glossy/tactile lift every filled surface gets.
 */
type Variant = "rail" | "drawer";

const BASE =
  "group relative flex h-10 items-center gap-ds-lg rounded-lg text-body-1 font-medium outline-none " +
  "transition-colors duration-150 ease-move " +
  "text-text-med hover:bg-outline-base hover:text-text-high " +
  "focus-visible:ring-2 focus-visible:ring-ring/60 " +
  "aria-[current=page]:bg-primary-wash aria-[current=page]:font-semibold aria-[current=page]:text-primary-high aria-[current=page]:shadow-e1";

const VARIANTS: Record<Variant, string> = {
  rail: "justify-center px-0 lg:justify-start lg:px-ds-lg",
  drawer: "px-ds-lg",
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
