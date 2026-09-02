import type { Metadata } from "next";
import { CandidatesTable } from "@/components/candidates/CandidatesTable";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlusIcon } from "@/components/ui/icons";
import { isTerminalStage } from "@/lib/types/domain";
import { getMockCandidates } from "../_mock-candidates";

export const metadata: Metadata = {
  title: "Candidates",
};

export const dynamic = "force-dynamic";

export default function CandidatesPage() {
  // SWAP POINT — see `app/(dashboard)/_mock-candidates.ts`:
  //   const candidates = await fetchCandidates();  // GET /api/v1/candidates
  const candidates = getMockCandidates();

  const applications = candidates.flatMap(
    (candidate) => candidate.applications,
  );
  const live = applications.filter(
    (application) => !isTerminalStage(application.stage),
  );

  return (
    <>
      <PageHeader
        title="Candidates"
        description="One profile per person. Applications sit on top, so the same candidate can be considered for several requisitions without being entered twice."
        actions={
          <ButtonLink href="/candidates/new" variant="primary">
            <PlusIcon />
            Add candidate
          </ButtonLink>
        }
      />

      <p className="mt-md flex flex-wrap items-center gap-x-md gap-y-2xs text-body-sm text-muted">
        <span>
          <span className="font-data tabular-nums text-text">
            {candidates.length}
          </span>{" "}
          profiles
        </span>
        <span>
          <span className="font-data tabular-nums text-text">
            {live.length}
          </span>{" "}
          live applications
        </span>
        <span>
          <span className="font-data tabular-nums text-text">
            {applications.length - live.length}
          </span>{" "}
          closed
        </span>
      </p>

      <div className="mt-lg">
        <CandidatesTable candidates={candidates} />
      </div>
    </>
  );
}
