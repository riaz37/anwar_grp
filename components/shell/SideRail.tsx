"use client";

import { usePathname } from "next/navigation";
import { NavLink } from "./NavLink";
import { isActiveHref, NAV_ITEMS } from "./nav-items";

/**
 * Persistent left rail. Hidden below 768px (the bottom bar + drawer take over),
 * 64px icons-only on tablet, 240px with labels on desktop.
 */
export function SideRail() {
  const pathname = usePathname();

  return (
    // Outer element stretches to the full page height so the rail surface has
    // no seam on long pages; the inner nav is what sticks to the viewport.
    <div className="hidden w-16 shrink-0 border-r border-border bg-surface md:block lg:w-60">
      <nav
        aria-label="Main"
        className="sticky top-14 px-sm py-md lg:px-md"
      >
        <ul className="flex flex-col gap-2xs">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                active={isActiveHref(pathname, item.href)}
                variant="rail"
              />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
