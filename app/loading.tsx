import { LogoMark } from "@/components/shell/LogoMark";

/**
 * Cold-load fallback only (first paint of a route segment, e.g. the
 * `(dashboard)` layout resolving its session/department query). Once the
 * shell is mounted, `(dashboard)/loading.tsx` takes over so the rail/top bar
 * never unmount between page navigations.
 */
export default function RootLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-full flex-1 flex-col items-center justify-center gap-ds-md bg-surface-shell py-16"
    >
      <LogoMark className="size-8 animate-pulse text-primary-high" aria-hidden="true" />
      <p className="text-body-1 text-muted-foreground">Loading ProjectFlow…</p>
    </div>
  );
}
