import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Not found" };

/**
 * In-shell 404. Without this, a `notFound()` from `/projects/[id]` falls
 * through to the root `app/not-found.tsx`, which renders outside `AppShell` —
 * a signed-in user loses the rail and every route back in the same instant
 * they hit a stale project link.
 */
export default function DashboardNotFound() {
  return (
    <>
      <PageHeader
        eyebrow="404"
        title="That record isn’t here"
        description="The project, milestone, or page you opened no longer exists, or your role doesn’t have access to it."
        backHref="/projects"
        backLabel="Back to portfolio"
      />

      <div className="mt-ds-5xl flex flex-wrap items-center gap-ds-md">
        <ButtonLink href="/projects" variant="primary">
          Browse the portfolio
        </ButtonLink>
        <ButtonLink href="/my-work" variant="ghost">
          Go to my work
        </ButtonLink>
      </div>
    </>
  );
}
