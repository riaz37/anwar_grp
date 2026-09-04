import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Variants are bound to DESIGN.md's tokens rather than shadcn's default
 * palette. Two reasons they are edited here instead of per call site:
 *
 *   1. `dark:` does not work in this app. Theme is `[data-theme="light"]` on
 *      <html>, so Tailwind's built-in dark variant (prefers-color-scheme) fires
 *      independently of the theme the user actually chose. Every colour below
 *      therefore comes from a theme-reactive CSS variable and there is no
 *      `dark:` utility anywhere in this file.
 *   2. Shadows collapse to ~3% alpha in light mode, so no variant may depend on
 *      one to be visible. `default` still carries shadow-primary-button because
 *      that recipe is mostly *inset* highlight, which reads in both themes.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-ds-md rounded-lg font-semibold whitespace-nowrap outline-none transition-[filter,background-color,border-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      /* Disabled is a per-variant style, not a blanket opacity. Fading the
         primary variant to 40% in light mode dropped an olive label on a pale
         yellow fill to roughly 1.4:1 — a button you cannot read is worse than
         one that is obviously off, so it repaints to a neutral surface instead. */
      variant: {
        default:
          "border border-black/[0.09] bg-primary-med text-primary-onaccent shadow-primary-button hover:brightness-105 disabled:border-outline-low disabled:bg-surface-3 disabled:text-text-med disabled:shadow-none",
        secondary:
          "border border-outline-med bg-surface-2 text-text-med hover:border-outline-high hover:bg-surface-3 hover:text-text-high disabled:opacity-50",
        outline:
          "border border-outline-med bg-transparent text-text-med hover:border-outline-high hover:bg-outline-base hover:text-text-high disabled:opacity-50",
        ghost:
          "text-text-med hover:bg-outline-base hover:text-text-high disabled:opacity-50",
        destructive:
          "border border-danger-outline bg-danger-wash text-danger-high hover:bg-danger-med/20 disabled:border-outline-low disabled:bg-surface-3 disabled:text-text-med",
        link: "text-text-high underline underline-offset-4 decoration-outline-high hover:decoration-current disabled:opacity-50",
      },
      size: {
        default: "h-9 px-ds-2xl text-[13px] has-[>svg]:px-ds-xl",
        xs: "h-6 gap-ds-xs px-ds-md text-[11px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-ds-sm px-ds-xl text-[12px] has-[>svg]:px-ds-lg [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-ds-5xl text-[14px] has-[>svg]:px-ds-2xl",
        /* Marketing/landing CTAs: pill shape + a scale/brighten hover instead
           of the app-chrome brightness-only hover. */
        hero: "h-10 gap-1 rounded-pill px-ds-xl py-ds-md text-body-1",
        "hero-lg": "h-12 gap-1 rounded-pill px-ds-2xl py-ds-xl text-title-1",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        size: ["hero", "hero-lg"],
        class:
          "transition-all duration-300 ease-out hover:scale-[1.03] hover:brightness-110 hover:filter active:scale-[0.96]",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
