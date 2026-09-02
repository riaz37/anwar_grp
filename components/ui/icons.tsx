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

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </Icon>
  );
}

/**
 * WhatsApp: the handset-in-a-speech-bubble silhouette, drawn on the same 24px
 * grid and 1.5px stroke as every other icon here rather than pasted in as the
 * brand mark — a filled green logo inside a monochrome ops UI would read as
 * decoration, and DESIGN.md reserves colour for status meaning.
 */
export function WhatsAppIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11.5a8 8 0 0 1-11.9 7L4 19.5l1.1-4A8 8 0 1 1 20 11.5Z" />
      <path d="M9.2 9.1c.2-.5.5-.5.8-.5h.5c.2 0 .4 0 .5.4l.6 1.4c0 .2 0 .4-.1.5l-.4.4c-.1.2-.2.3 0 .6a5.6 5.6 0 0 0 2.4 2.1c.3.1.4 0 .5-.1l.5-.6c.2-.2.3-.2.5-.1l1.4.7c.2.1.3.2.3.4a1.6 1.6 0 0 1-1.6 1.5 6.7 6.7 0 0 1-5.5-5.1 2.6 2.6 0 0 1 .2-1.6Z" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 1.8" />
    </Icon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 10.3c0 4.6-5.5 9.4-6.7 10.4a.5.5 0 0 1-.6 0C10.5 19.7 5 14.9 5 10.3a7 7 0 0 1 14 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="6.5" width="12" height="11" rx="1.5" />
      <path d="m15 11 5.5-3v8L15 13z" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9.5" cy="8.5" r="3" />
      <path d="M3.5 19a6 6 0 0 1 12 0" />
      <path d="M16 5.9a3 3 0 0 1 0 5.2M17 14.2a5.5 5.5 0 0 1 3.5 4.8" />
    </Icon>
  );
}

/** Retry / resend — a closed loop with an arrowhead, not a spinner. */
export function RetryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12a7 7 0 1 1-2.6-5.4" />
      <path d="M19.5 4.5V9h-4.5" />
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
