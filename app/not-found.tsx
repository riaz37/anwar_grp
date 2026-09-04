import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { StatusScreen } from "@/components/status/StatusScreen";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      codeLabel="Not found"
      title="That page isn’t here"
      actions={
        <>
          {/* Home, not the management dashboard: most roles can't view
              `/dashboard` and would be bounced straight back out. */}
          <ButtonLink href="/home" variant="primary">
            Go to home
          </ButtonLink>
          <ButtonLink href="/projects" variant="ghost">
            Browse the portfolio
          </ButtonLink>
        </>
      }
      footnote="If you followed a link from inside ProjectFlow, tell your AI Team Lead which page it was on. A stale project reference is worth fixing at the source."
    >
      <p>
        The address doesn’t match any page, or it points at a project that has
        since been removed. It’s also possible your role doesn’t have access to
        it.
      </p>
    </StatusScreen>
  );
}
