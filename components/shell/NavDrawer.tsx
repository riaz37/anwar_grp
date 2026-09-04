"use client";

import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/primitives/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/primitives/sheet";
import { LogoutButton } from "./LogoutButton";
import { NavLink } from "./NavLink";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";
import { initials } from "./utils";
import { isActiveHref, visibleNavItems } from "./nav-items";
import type { ShellUser } from "./types";

/**
 * Mobile slide-out navigation carrying every nav item and the same bottom
 * block (profile, theme, sign-out) the desktop rail's footer has — the rail
 * itself is hidden below 768px, so this is the only place those controls are
 * reachable on a phone.
 *
 * Built on shadcn/ui's `Sheet` — i.e. Radix Dialog. Radix owns the focus trap,
 * the Escape handler, body scroll-lock, `aria-modal`, marking the rest of the
 * page inert, and restoring focus to the menu button on close.
 */
export function NavDrawer({
  id,
  open,
  onClose,
  user,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  user: ShellUser;
}) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        id={id}
        side="left"
        aria-label="Navigation"
        className="w-[272px] max-w-[85vw] gap-0 border-outline-low bg-surface-1 p-0 data-[state=closed]:duration-[240ms] data-[state=open]:duration-[320ms] md:hidden [&>button]:size-9 [&>button]:top-3.5 [&>button]:right-3.5 [&>button]:grid [&>button]:place-items-center [&>button]:rounded-lg [&>button]:text-text-med [&>button]:hover:bg-outline-base [&>button]:hover:text-text-high"
      >
        <SheetHeader className="h-[76px] shrink-0 flex-row items-center border-b border-outline-low p-0 px-ds-2xl">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Wordmark />
        </SheetHeader>

        <nav
          aria-label="All sections"
          className="flex flex-1 flex-col gap-ds-xxs overflow-y-auto px-ds-2xl py-ds-2xl"
        >
          {visibleNavItems(user.canViewManagementDashboard).map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActiveHref(pathname, item.href)}
              variant="drawer"
              onNavigate={onClose}
            />
          ))}
        </nav>

        <div className="flex shrink-0 flex-col gap-ds-xs border-t border-outline-low px-ds-2xl py-ds-lg pb-[calc(16px+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-ds-lg rounded-lg px-ds-lg py-ds-md">
            <Avatar size="sm" className="shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-primary-med to-primary-high font-semibold text-primary-onaccent">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
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
      </SheetContent>
    </Sheet>
  );
}
