"use client";

import { usePathname } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { MobileTabBar } from "./MobileTabBar";
import { NavDrawer } from "./NavDrawer";
import { SideRail } from "./SideRail";
import { TopBar } from "./TopBar";
import type { ShellUser } from "./types";

/**
 * Rail + canvas (DESIGN.md > Sidebar / Top bar): the sidebar owns its own
 * header and spans the full viewport height; the top bar is scoped to the
 * canvas column beside it, not the full width.
 */
export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const drawerId = useId();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Any route change (including browser back/forward) closes the drawer.
  // Adjusted during render rather than in an effect so there's no flash of an
  // open drawer over the new page — https://react.dev/learn/you-might-not-need-an-effect
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setDrawerOpen(false);
  }

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-lg border border-outline-med bg-surface-1 px-ds-lg text-body-1 font-medium text-text-high focus:not-sr-only focus:absolute focus:left-ds-lg focus:top-ds-lg focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center"
      >
        Skip to main content
      </a>

      <div className="flex h-dvh overflow-hidden bg-surface-shell">
        <SideRail user={user} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            user={user}
            drawerId={drawerId}
            drawerOpen={drawerOpen}
            menuButtonRef={menuButtonRef}
            onOpenDrawer={() => setDrawerOpen(true)}
          />

          <main
            id="main"
            className="min-h-0 flex-1 overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0"
          >
            <div className="mx-auto w-full max-w-[1440px] px-ds-2xl py-ds-4xl lg:px-ds-9xl lg:py-ds-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>

      <NavDrawer
        id={drawerId}
        open={drawerOpen}
        onClose={closeDrawer}
        user={user}
      />
      <MobileTabBar />
    </>
  );
}
