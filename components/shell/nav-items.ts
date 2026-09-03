import type { ComponentType, SVGProps } from "react";
import {
  HomeIcon,
  ProjectsIcon,
  ReportsIcon,
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
 * Primary navigation for Anwar AI ProjectFlow: Home, My Work (role-scoped
 * assignments), Portfolio (all projects), and Management Dashboard. See
 * DESIGN.md > Layout.
 *
 * Role-based visibility filtering happens here once sessions are wired; the
 * client nav is a UX convenience, never the authorization boundary
 * (BUILD_PLAN.md Sec 2.5).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", href: "/", icon: HomeIcon, primary: true },
  { label: "My Work", href: "/my-work", icon: TasksIcon, primary: true },
  { label: "Portfolio", href: "/projects", icon: ProjectsIcon, primary: true },
  { label: "Management Dashboard", href: "/dashboard", icon: ReportsIcon },
] as const;

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.primary);

export function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
