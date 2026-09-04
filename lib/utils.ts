import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * DESIGN.md's type scale, as declared under `@theme` in `app/globals.css`.
 *
 * tailwind-merge has to be told about these. Its default config decides what
 * `text-<x>` means by validating `<x>`: a known size or an arbitrary value is
 * a font-size, and *anything else falls through to text-colour*. So
 * `text-caption` was being filed as a colour, which meant a later
 * `text-muted-foreground` in the same `cn()` call silently deleted it — the
 * class vanished from the DOM and the element rendered at the inherited size.
 * That is invisible in review and only shows up as "the wrong font size".
 */
const FONT_SIZES = [
  "caption-1",
  "caption-2",
  "body-1",
  "body-2",
  "para",
  "title-1",
  "heading-1",
  "heading-2",
  "display-1",
  "metric",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZES] }],
    },
  },
});

/**
 * shadcn/ui's class composer: `clsx` resolves conditionals, `tailwind-merge`
 * then drops earlier utilities that a later one overrides so a `className`
 * prop always wins over a component's own defaults.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
