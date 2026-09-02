"use client";

import { useRouter } from "next/navigation";
import { type RefObject, useState } from "react";
import { MenuIcon, SignOutIcon } from "./icons";
import type { ShellUser } from "./types";
import { Wordmark } from "./Wordmark";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

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
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Network failure still ends the client session — the server-side
      // cookie is cleared on the next authenticated request either way.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-surface">
      <div className="flex h-full items-center gap-sm px-md lg:px-lg">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onOpenDrawer}
          aria-controls={drawerId}
          aria-expanded={drawerOpen}
          className="-ml-sm grid size-11 shrink-0 place-items-center rounded-sm text-muted transition-colors duration-100 ease-move hover:bg-surface-sunken hover:text-text md:hidden"
        >
          <MenuIcon />
          <span className="sr-only">Open navigation</span>
        </button>

        <Wordmark className="mr-auto" />

        <div className="flex items-center gap-sm">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-body-sm font-medium text-text">{user.name}</p>
            <p className="text-caption text-muted">
              {user.role} · {user.department}
            </p>
          </div>
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface-sunken font-data text-caption font-medium text-muted"
          >
            {initials(user.name)}
          </span>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="ml-2xs flex min-h-11 items-center gap-2xs rounded-sm px-sm text-body-sm font-medium text-muted transition-colors duration-100 ease-move hover:bg-surface-sunken hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SignOutIcon />
            <span className="sr-only lg:not-sr-only">
              {signingOut ? "Signing out…" : "Sign out"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
