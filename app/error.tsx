"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { RetryIcon } from "@/components/ui/icons";
import { StatusScreen } from "@/components/status/StatusScreen";

export default function RouteError({
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
    <StatusScreen
      code="500"
      codeLabel="Request failed"
      title="We couldn’t load this page"
      actions={
        <>
          <Button variant="primary" onClick={reset}>
            <RetryIcon />
            Try again
          </Button>
          <ButtonLink href="/home" variant="ghost">
            Go to home
          </ButtonLink>
        </>
      }
      footnote={
        error.digest ? (
          <>
            Quote this reference to IT support:{" "}
            <span className="font-mono text-text-high">{error.digest}</span>
          </>
        ) : (
          "If this keeps happening, contact IT support with what you were doing."
        )
      }
    >
      <p>
        Something failed while rendering this view. Nothing you had already
        saved is affected. Retrying re-runs the request.
      </p>
    </StatusScreen>
  );
}
