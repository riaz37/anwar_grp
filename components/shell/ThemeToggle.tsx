"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/primitives/switch";
import { DarkThemeIcon, LightThemeIcon } from "./icons";

const subscribeNoop = () => () => {};

/** True only once mounted on the client — subscribes to nothing, so there's
 *  no setState-in-effect cascade, just a snapshot that differs between the
 *  server render and the client's first paint. */
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

/**
 * Light/dark toggle for the sidebar's bottom block (DESIGN.md > Sidebar).
 * Two states only — `next-themes` already resolves the OS preference into
 * `dark` or `light` on first load (`defaultTheme="system" enableSystem` in
 * `app/layout.tsx`); this control never exposes a third "system" option.
 *
 * Reads after mount so SSR markup (which cannot know the resolved theme)
 * stays stable and there's no hydration mismatch.
 *
 * Responsive by CSS, matching `NavLink`'s `rail` variant: icon + switch only
 * at 768–1023px, label visible from 1024px up.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = !mounted || resolvedTheme !== "light";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <div className="flex h-10 items-center justify-center gap-ds-lg rounded-lg px-0 text-body-1 font-medium text-text-med lg:justify-between lg:px-ds-lg">
      <span className="hidden items-center gap-ds-lg lg:flex">
        {isDark ? <DarkThemeIcon /> : <LightThemeIcon />}
        <span className="truncate">{isDark ? "Dark theme" : "Light theme"}</span>
      </span>
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        aria-label={label}
        disabled={!mounted}
      />
    </div>
  );
}
