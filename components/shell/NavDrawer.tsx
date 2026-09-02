"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons";
import { NavLink } from "./NavLink";
import { isActiveHref, NAV_ITEMS } from "./nav-items";
import type { ShellUser } from "./types";

/**
 * Mobile slide-out navigation carrying all nine items (the bottom bar only
 * surfaces three). Stays mounted so the exit transition can run; `inert` keeps
 * it out of the tab order and the accessibility tree while closed.
 *
 * Motion: 300ms enter / 225ms exit (75% of enter, per DESIGN.md > Motion,
 * "medium 250–400ms — panel/drawer open").
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      id={id}
      inert={!open}
      className={`fixed inset-0 z-40 md:hidden ${open ? "" : "pointer-events-none"}`}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 bg-[#14131a]/45 transition-opacity ease-exit ${
          open ? "opacity-100 duration-300 ease-enter" : "opacity-0 duration-200"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`absolute inset-y-0 left-0 flex w-70 max-w-[85vw] flex-col border-r border-border bg-surface transition-transform ease-exit ${
          open
            ? "translate-x-0 duration-300 ease-enter"
            : "-translate-x-full duration-200"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border pl-md pr-sm">
          <p className="font-display text-subhead font-semibold">Navigation</p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-sm text-muted transition-colors duration-100 ease-move hover:bg-surface-sunken hover:text-text"
          >
            <CloseIcon />
            <span className="sr-only">Close navigation</span>
          </button>
        </div>

        <nav
          aria-label="All sections"
          className="flex-1 overflow-y-auto px-sm py-md"
        >
          <ul className="flex flex-col gap-2xs">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={isActiveHref(pathname, item.href)}
                  variant="drawer"
                  onNavigate={onClose}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-border px-md py-md pb-[calc(16px+env(safe-area-inset-bottom))]">
          <p className="text-body-sm font-medium text-text">{user.name}</p>
          <p className="text-caption text-muted">
            {user.role} · {user.department}
          </p>
        </div>
      </div>
    </div>
  );
}
