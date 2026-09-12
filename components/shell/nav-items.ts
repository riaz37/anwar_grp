import type { ComponentType, SVGProps } from "react";
import {
  ChatIcon,
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
  /** Hidden unless `ShellUser.canViewManagementDashboard` — the page itself
   *  redirects roles without VIEW_MANAGEMENT_DASHBOARD (lib/project-authz.ts),
   *  so a visible-but-bouncing link is worse than not showing it at all. */
  restricted?: boolean;
};

/**
 * Primary navigation for Anwar AI ProjectFlow: Home, My Work (role-scoped
 * assignments), Portfolio (all projects), Management Dashboard, and the PMO
 * agent Chat. See DESIGN.md > Layout.
 *
 * The client nav is a UX convenience, never the authorization boundary
 * (PROJECT_PLAN.md Sec 2.5) — `visibleNavItems` only avoids showing links a
 * role can't use; the server-side permission check is the real gate.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Home", href: "/home", icon: HomeIcon, primary: true },
  { label: "My Work", href: "/my-work", icon: TasksIcon, primary: true },
  { label: "Portfolio", href: "/projects", icon: ProjectsIcon, primary: true },
  {
    label: "Management Dashboard",
    href: "/dashboard",
    icon: ReportsIcon,
    restricted: true,
  },
  {
    label: "Chat",
    href: "/chat",
    icon: ChatIcon,
    restricted: true,
  },
] as const;

export function visibleNavItems(
  canViewManagementDashboard: boolean,
): readonly NavItem[] {
  return NAV_ITEMS.filter(
    (item) => !item.restricted || canViewManagementDashboard,
  );
}

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.primary);

export function isActiveHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
