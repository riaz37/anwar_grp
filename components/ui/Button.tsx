import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  Button as Primitive,
  buttonVariants,
} from "@/components/ui/primitives/button";
import { cn } from "@/lib/utils";

/**
 * Application-facing button.
 *
 * The internals are shadcn/ui's Radix-backed `Button` (focus-visible ring,
 * `asChild` slotting, CVA variants, 44px hit area — see
 * `primitives/button.tsx`). This module exists only to keep the app's own
 * vocabulary: three deliberate weights, because not every action is primary. A
 * view has at most one `primary`; everything else is `secondary` (bordered) or
 * `ghost` (text-only).
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";

/** App weight → shadcn CVA variant. */
const VARIANT: Record<
  ButtonVariant,
  NonNullable<Parameters<typeof buttonVariants>[0]>["variant"]
> = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  destructive: "destructive",
  link: "link",
};

export function Button({
  variant = "secondary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <Primitive type="button" variant={VARIANT[variant]} className={className} {...props}>
      {children}
    </Primitive>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  /* `asChild` hands the styling to `next/link` so the anchor keeps real
     navigation semantics (middle-click, prefetch) instead of a button
     pretending to be a link. */
  return (
    <Primitive asChild variant={VARIANT[variant]} className={className}>
      <Link href={href}>{children}</Link>
    </Primitive>
  );
}

export { buttonVariants, cn };
