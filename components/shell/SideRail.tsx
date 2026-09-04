"use client";

import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/primitives/avatar";
import { ScrollArea } from "@/components/ui/primitives/scroll-area";
import { LogoutButton } from "./LogoutButton";
import { NavLink } from "./NavLink";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";
import { initials } from "./utils";
import { isActiveHref, visibleNavItems } from "./nav-items";
import type { ShellUser } from "./types";

/**
 * Persistent left rail (DESIGN.md > Sidebar): hidden below 768px — the
 * bottom tab bar + drawer take over there — icon-only 64px on tablet, the
 * full 304px `--rail-w` with labels from 1024px up.
 */
export function SideRail({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const items = visibleNavItems(user.canViewManagementDashboard);

  return (
    <aside
      aria-label="Primary"
      className="hidden h-dvh w-16 shrink-0 flex-col border-r border-outline-low bg-surface-1 md:flex lg:w-[304px]"
    >
      <div className="flex h-[76px] shrink-0 items-center border-b border-outline-low px-ds-md lg:px-ds-2xl">
        <Wordmark
          className="mx-auto lg:mx-0"
          labelClassName="hidden truncate lg:inline"
        />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav
          aria-label="Main"
          className="flex flex-col gap-ds-xxs px-ds-md py-ds-2xl lg:px-ds-2xl"
        >
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActiveHref(pathname, item.href)}
              variant="rail"
            />
          ))}
        </nav>
      </ScrollArea>

      <div className="flex shrink-0 flex-col gap-ds-xs border-t border-outline-low px-ds-md py-ds-lg lg:px-ds-2xl">
        <div
          className="flex items-center justify-center gap-ds-lg rounded-lg px-0 py-ds-md lg:justify-start lg:px-ds-lg"
          title={user.name}
        >
          <Avatar size="sm" className="shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-primary-med to-primary-high font-semibold text-primary-onaccent">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-body-1 font-medium text-text-high">
              {user.name}
            </p>
            <p className="truncate text-caption-1 text-text-low">
              {user.role} · {user.department}
            </p>
          </div>
        </div>

        <ThemeToggle />
        <LogoutButton />
      </div>
    </aside>
  );
}
