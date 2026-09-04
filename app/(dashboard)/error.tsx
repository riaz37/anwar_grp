"use client";

import { useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, ButtonLink } from "@/components/ui/Button";
import { RetryIcon } from "@/components/ui/icons";

/**
 * In-shell error boundary. Without this, a thrown error anywhere under
 * `(dashboard)` falls through to the root `app/error.tsx`, which renders
 * outside `AppShell` — a signed-in user loses the rail and every route back
 * at the exact moment something breaks. Mirrors the reasoning in
 * `app/(dashboard)/not-found.tsx`.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Replace with the production logger once one is wired up app-wide.
    console.error(error);
  }, [error]);

  return (
    <>
      <PageHeader
        eyebrow="500"
        title="We couldn’t load this page"
        description="Something failed while rendering this view. Nothing you had already saved is affected. Retrying re-runs the request."
        backHref="/projects"
        backLabel="Back to portfolio"
      />

      <div className="mt-ds-5xl flex flex-wrap items-center gap-ds-md">
        <Button variant="primary" onClick={reset}>
          <RetryIcon />
          Try again
        </Button>
        <ButtonLink href="/home" variant="ghost">
          Go to home
        </ButtonLink>
      </div>

      <p className="mt-ds-5xl max-w-[62ch] text-body-1 text-muted-foreground">
        {error.digest ? (
          <>
            Quote this reference to IT support:{" "}
            <span className="font-mono text-text-high">{error.digest}</span>
          </>
        ) : (
          "If this keeps happening, contact IT support with what you were doing."
        )}
      </p>
    </>
  );
}
