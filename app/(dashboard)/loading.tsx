import { Skeleton } from "@/components/ui/primitives/skeleton";

/**
 * Content-area skeleton for in-shell navigation (rail/top bar stay mounted —
 * only this segment suspends).
 *
 * Shaped like the frame every page in this group actually renders — a
 * `PageHeader` block (title, one-line description, rule) above a 12-column
 * content grid — so the header doesn't jump position when the real page
 * resolves. It stops short of mimicking each page's body: DESIGN.md > Motion
 * scopes animation to what aids comprehension, and a per-route pixel-copy of
 * every list would be decoration.
 *
 * Blocks are shadcn/ui `Skeleton`, so the pulse timing and surface stay in one
 * place instead of being restated as utility strings per placeholder.
 */
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading page…</span>

      <div className="border-b border-border pb-ds-5xl" aria-hidden="true">
        <Skeleton className="h-8 w-64 max-w-full rounded-sm" />
        <Skeleton className="mt-ds-md h-4 w-full max-w-[52ch] rounded-sm" />
      </div>

      <div
        className="mt-ds-5xl grid grid-cols-1 gap-ds-5xl lg:grid-cols-12"
        aria-hidden="true"
      >
        <div className="flex flex-col gap-ds-md lg:col-span-7">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-sm" />
          ))}
        </div>
        <div className="flex flex-col gap-ds-md lg:col-span-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}
