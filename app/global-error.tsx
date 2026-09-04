"use client";

import { useEffect } from "react";
import "./globals.css";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, where
 * `app/error.tsx` never mounts. It replaces the whole document, so it renders
 * its own `<html>`/`<body>` and deliberately avoids `next/link`, the shell, and
 * any web font: at this point the router or the network may be
 * the thing that failed, so everything here is plain HTML over the design
 * tokens in `globals.css`.
 */
export default function GlobalError({
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
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-surface-shell">
        <main className="mx-auto flex w-full max-w-form flex-1 flex-col justify-center px-ds-2xl py-ds-9xl">
          <p className="annotation">
            ProjectFlow · Application error
          </p>
          <h1 className="mt-ds-md text-balance text-display-1 font-semibold text-text-high">
            ProjectFlow couldn’t start
          </h1>
          <p className="mt-ds-xxs max-w-[58ch] text-pretty text-para text-muted-foreground">
            The application failed before any page could be rendered. Reloading
            usually clears it. If it doesn’t, the service is likely down. Tell
            IT support rather than retrying.
          </p>

          <div className="mt-ds-5xl flex flex-wrap items-center gap-ds-md">
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center justify-center rounded-sm bg-primary-wash px-ds-2xl text-body-1 font-semibold text-primary-high shadow-primary-button transition-colors duration-100 ease-move hover:brightness-110"
            >
              Reload ProjectFlow
            </button>
            <a
              href="mailto:it-support@anwargroup.example"
              className="inline-flex min-h-11 items-center justify-center rounded-sm px-ds-2xl text-body-1 font-medium text-primary-high transition-colors duration-100 ease-move hover:bg-surface-2"
            >
              Email IT support
            </a>
          </div>

          {error.digest && (
            <p className="mt-ds-7xl border-t border-border pt-ds-2xl text-caption-1 text-muted-foreground">
              Reference:{" "}
              <span className="font-mono text-text-high">{error.digest}</span>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
