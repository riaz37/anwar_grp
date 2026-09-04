"use client";

import { usePathname } from "next/navigation";
import type { RefObject } from "react";
import { MenuIcon } from "./icons";
import { isActiveHref, visibleNavItems } from "./nav-items";
import { Wordmark } from "./Wordmark";
import type { ShellUser } from "./types";

/**
 * Scoped to the canvas column, not the full viewport width — the sidebar
 * carries its own header (DESIGN.md > Sidebar), so this bar's only job is
 * "where you are" (breadcrumb/page title) plus the mobile menu trigger.
 * 76px height, `outline-med` bottom hairline (DESIGN.md > Top bar).
 */
export function TopBar({
  user,
  onOpenDrawer,
  drawerId,
  drawerOpen,
  menuButtonRef,
}: {
  user: ShellUser;
  onOpenDrawer: () => void;
  drawerId: string;
  drawerOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const pathname = usePathname();
  const activeItem = visibleNavItems(user.canViewManagementDashboard).find(
    (item) => isActiveHref(pathname, item.href),
  );

  return (
    <header className="sticky top-0 z-30 flex h-[76px] shrink-0 items-center gap-ds-2xl border-b border-outline-med bg-surface-shell px-ds-2xl lg:px-ds-5xl">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenDrawer}
        aria-controls={drawerId}
        aria-expanded={drawerOpen}
        className="-ml-ds-md grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-text-med outline-none transition-colors duration-150 ease-move hover:bg-outline-base hover:text-text-high focus-visible:ring-2 focus-visible:ring-ring/60 md:hidden"
      >
        <MenuIcon />
        <span className="sr-only">Open navigation</span>
      </button>

      <Wordmark className="md:hidden" labelClassName="truncate" />

      <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
        <ol className="flex min-w-0 items-center gap-ds-md">
          <li className="truncate text-caption-1 uppercase tracking-[0.08em] text-text-low">
            ProjectFlow
          </li>
          {activeItem && (
            <>
              <li aria-hidden="true" className="text-text-low/60">
                /
              </li>
              <li
                aria-current="page"
                className="truncate text-title-1 font-semibold text-text-high"
              >
                {activeItem.label}
              </li>
            </>
          )}
        </ol>
      </nav>
    </header>
  );
}
