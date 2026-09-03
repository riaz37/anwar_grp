import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Three button weights, deliberately: not every action is primary. A view has
 * at most one `primary` — everything else is `secondary` (bordered) or `ghost`
 * (text-only). All share a 44px minimum hit area per DESIGN.md > Accessibility.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-xs rounded-sm px-md text-body-sm font-medium " +
  "transition-colors duration-100 ease-move disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent-ink font-semibold text-surface hover:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface text-text hover:bg-surface-sunken",
  ghost: "text-accent-ink hover:bg-accent-soft",
};

export function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}
