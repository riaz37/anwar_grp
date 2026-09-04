"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveHref, PRIMARY_NAV_ITEMS } from "./nav-items";

/**
 * Mobile bottom bar — Home / My Work / Portfolio only. Management Dashboard
 * lives in the slide-out drawer (BUILD_PLAN.md Sec 5, decision 5).
 */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-outline-low bg-surface-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-3">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const active = isActiveHref(pathname, item.href);
          const ItemIcon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                /* Touch has no hover, so `active:` is the only press feedback
                   available here; without it a tap on a slow route change
                   looks like it did nothing. */
                className={`relative flex min-h-16 flex-col items-center justify-center gap-ds-xs text-caption-1 font-medium transition-colors duration-150 ease-move active:bg-outline-base ${
                  active ? "text-primary-high" : "text-text-low"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-6 top-0 h-[2px] rounded-full bg-primary-med ${
                    active ? "block" : "hidden"
                  }`}
                />
                <ItemIcon />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
