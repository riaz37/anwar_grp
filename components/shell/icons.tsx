import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Line icons drawn on a 24px grid, 1.5px stroke, no fills — deliberately
 * plain so navigation reads as structure, not decoration (DESIGN.md >
 * Aesthetic Direction: "typography and spacing do the work").
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

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 10.2 12 4l8 6.2V19a1 1 0 0 1-1 1h-4v-5.5H9V20H5a1 1 0 0 1-1-1z" />
    </Icon>
  );
}

export function TasksIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 7 2 2 3.5-3.5M4 16l2 2 3.5-3.5" />
      <path d="M13 7.5h7M13 16.5h7" />
    </Icon>
  );
}

export function RequisitionsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h4" />
    </Icon>
  );
}

export function CandidatesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9.5" cy="8.5" r="3" />
      <path d="M4 19c0-2.8 2.5-4.5 5.5-4.5S15 16.2 15 19" />
      <path d="M16 6.2a3 3 0 0 1 0 5.6M18 19c0-2.2-.8-3.6-2-4.4" />
    </Icon>
  );
}

export function InterviewsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="1.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
      <path d="m9.5 14.5 1.8 1.8 3.4-3.4" />
    </Icon>
  );
}

export function MessagesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 14.5a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.5V6a1.5 1.5 0 0 1 1.5-1.5h12A1.5 1.5 0 0 1 20 6z" />
      <path d="M9 8.5h7M9 12h4.5" />
    </Icon>
  );
}

export function JoiningIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14" />
      <path d="M11 12h8m0 0-3-3m3 3-3 3" />
    </Icon>
  );
}

export function ReportsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16" />
      <path d="M7.5 20v-6M12 20V6.5M16.5 20v-9" />
    </Icon>
  );
}

export function AdministrationIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2" />
      <circle cx="9" cy="16" r="2" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function SignOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 5.5V4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H14v-1.5" />
      <path d="M10.5 12h9m0 0-3-3m3 3-3 3" />
    </Icon>
  );
}

export function EmptyTasksIcon(props: IconProps) {
  return (
    <Icon width="32" height="32" {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
      <path d="m9 14.5 2 2 4-4" />
    </Icon>
  );
}
