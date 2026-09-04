"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignOutIcon } from "./icons";

/**
 * Sign-out control shared by the desktop sidebar's bottom block and the
 * mobile drawer footer (DESIGN.md > Sidebar). The request/redirect logic is
 * unchanged from the previous TopBar-hosted implementation — only where it's
 * rendered moved.
 *
 * Responsive by CSS, matching `NavLink`'s `rail` variant: icon-only at
 * 768–1023px, icon + label from 1024px up.
 */
export function LogoutButton() {
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
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      aria-busy={signingOut}
      title="Sign out"
      className="group flex h-10 w-full cursor-pointer items-center justify-center gap-ds-lg rounded-lg px-0 text-body-1 font-medium text-text-med outline-none transition-colors duration-150 ease-move hover:bg-outline-base hover:text-text-high focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-progress disabled:opacity-60 lg:justify-start lg:px-ds-lg"
    >
      <SignOutIcon className="shrink-0" />
      <span className="sr-only lg:not-sr-only lg:truncate">
        {signingOut ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );
}
