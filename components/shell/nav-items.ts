import type { ComponentType, SVGProps } from "react";
import {
  AdministrationIcon,
  CandidatesIcon,
  HomeIcon,
  InterviewsIcon,
  JoiningIcon,
  MessagesIcon,
  ReportsIcon,
  RequisitionsIcon,
  TasksIcon,
} from "./icons";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Surfaced in the mobile bottom bar (DESIGN.md > Layout, mobile <768px). */
  primary?: boolean;
};

/**
 * Fixed 9-item navigation from Sec 7 of the assignment spec. The order and
 * membership of this list are specified, not a design choice — see DESIGN.md
 * > Layout ("a layout that serves the nav structure, not reinterprets it").
 *
 * Role-based visibility filtering happens here once sessions are wired; the
 * client nav is a UX convenience, never the authorization boundary
 * (BUILD_PLAN.md Sec 2.5).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon, primary: true },
  { label: "My Tasks", href: "/tasks", icon: TasksIcon, primary: true },
  { label: "Requisitions", href: "/requisitions", icon: RequisitionsIcon },
  { label: "Candidates", href: "/candidates", icon: CandidatesIcon, primary: true },
  { label: "Interviews", href: "/interviews", icon: InterviewsIcon },
  { label: "Messages", href: "/messages", icon: MessagesIcon },
  { label: "Joining", href: "/joining", icon: JoiningIcon },
  { label: "Reports", href: "/reports", icon: ReportsIcon },
  { label: "Administration", href: "/administration", icon: AdministrationIcon },
] as const;

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.primary);

export function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
