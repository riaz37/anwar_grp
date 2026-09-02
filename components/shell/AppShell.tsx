"use client";

import { usePathname } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { MobileTabBar } from "./MobileTabBar";
import { NavDrawer } from "./NavDrawer";
import { SideRail } from "./SideRail";
import { TopBar } from "./TopBar";
import type { ShellUser } from "./types";

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
        className="sr-only rounded-sm border border-border bg-surface px-md text-body-sm font-medium text-accent-ink focus:not-sr-only focus:absolute focus:left-md focus:top-md focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center"
      >
        Skip to main content
      </a>

      <TopBar
        user={user}
        drawerId={drawerId}
        drawerOpen={drawerOpen}
        menuButtonRef={menuButtonRef}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <div className="flex flex-1">
        <SideRail />
        <main
          id="main"
          className="min-w-0 flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-2xl"
        >
          <div className="mx-auto w-full max-w-[1440px] px-md py-lg lg:px-xl lg:py-xl">
            {children}
          </div>
        </main>
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
