import type { SVGProps } from "react";

/**
 * Brand mark: three ascending bars inside a rounded square, the current
 * (middle-height, accent-filled) bar standing for "one current stage" — the
 * product's core idea (DESIGN.md > Product Context) — without an illustrative
 * cliche. Static by design (DESIGN.md > Motion: no decorative animation);
 * the only motion is the ordinary `currentColor` hover already used by every
 * other icon in the shell.
 */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect
        x="1.25"
        y="1.25"
        width="21.5"
        height="21.5"
        rx="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 15.5v-2.75M12 15.5V8.5M16 15.5v-5.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8.5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
