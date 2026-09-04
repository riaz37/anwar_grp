"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Thin wrapper around sonner so every toast picks up this app's design tokens
 * (dark by default, `[data-theme="light"]` override) instead of sonner's own
 * light/dark palette.
 *
 * The theme comes from `next-themes` — `ThemeProvider` in `app/layout.tsx` is
 * wired with `attribute="data-theme"`, so this hook is the only thing that
 * knows which of the two palettes is actually painted.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      /* Keeps toasts clear of the fixed mobile bottom tab bar: 64px bar plus
         the home-indicator inset. */
      offset={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-xl border border-outline-low bg-surface-1 text-text-high shadow-e2 backdrop-blur-[75px]",
          description: "text-text-med",
          actionButton: "bg-primary-med text-primary-onaccent",
          cancelButton: "bg-surface-2 text-text-med",
          success: "!border-success-outline [&_[data-icon]]:text-success-high",
          error: "!border-danger-outline [&_[data-icon]]:text-danger-high",
          warning: "!border-warn-outline [&_[data-icon]]:text-warn-high",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
