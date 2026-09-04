import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      /* No `dark:` utilities: theme is `[data-theme="light"]` on <html>, so
         Tailwind's prefers-color-scheme dark variant would fire independently
         of the theme the user actually picked. Every colour is a
         theme-reactive variable instead. `shadow-input-inner` is the inset
         named by DESIGN.md §5 for text fields. */
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-ds-xl py-1 text-base shadow-input-inner transition-[color,border-color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-text-low disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
