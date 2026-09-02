import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Domain icons for the requisition/candidate surface. Same drawing rules as
 * `components/shell/icons.tsx` (24px grid, 1.5px stroke, no fill) — kept in a
 * separate file so the shell's nav icon set stays exactly the nine spec'd
 * navigation entries.
 */
function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </Icon>
  );
}

export function PaperclipIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 11.5 12.4 18a4 4 0 0 1-5.7-5.7l7-7a2.6 2.6 0 0 1 3.7 3.7l-7 7a1.2 1.2 0 0 1-1.7-1.7l6.4-6.4" />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v10" />
      <path d="m8 10.5 4 3.5 4-3.5" />
      <path d="M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5" />
      <path d="m10.5 6.5-5 5.5 5 5.5" />
    </Icon>
  );
}

/** Ascending/descending marker for sortable table headers. */
export function SortIcon({
  direction,
  ...props
}: IconProps & { direction: "asc" | "desc" | "none" }) {
  return (
    <Icon width="14" height="14" {...props}>
      {direction !== "desc" && <path d="m7 11 5-5 5 5" />}
      {direction !== "asc" && <path d="m7 13 5 5 5-5" />}
    </Icon>
  );
}
