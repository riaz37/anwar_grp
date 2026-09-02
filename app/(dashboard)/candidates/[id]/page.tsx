import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CandidateWorkspace } from "@/components/candidates/CandidateWorkspace";
import { DetailItem, DetailList } from "@/components/ui/DetailList";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate } from "@/lib/format";
import {
  CANDIDATE_SOURCE_LABELS,
  type StageHistoryEntry,
} from "@/lib/types/domain";
import {
  getMockCandidate,
  getMockStageHistory,
} from "../../_mock-candidates";
import {
  MOCK_CURRENT_USER,
  MOCK_HIRING_MANAGERS,
  MOCK_RECRUITERS,
} from "../../_mock-reference";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/candidates/[id]">): Promise<Metadata> {
  const { id } = await params;
  const candidate = getMockCandidate(id);
  return { title: candidate ? candidate.name : "Candidate" };
}

/**
 * Candidate Workspace — BUILD_PLAN.md Sec 5 decision #6.
 *
 * The shared profile (spec Sec 6's minimum details: name, mobile, email, CV,
 * source) is a persistent panel; the per-application tab strip below it is the
 * only part that changes when you switch applications. Spec Sec 7 requires the
 * workspace to display candidate name, position, current stage, assigned
 * recruiter, next action and due date — the first is in the header, the rest
 * are in the active tab's panel.
 */
export default async function CandidateWorkspacePage({
  params,
}: PageProps<"/candidates/[id]">) {
  const { id } = await params;

  // SWAP POINT — see `app/(dashboard)/_mock-candidates.ts`:
  //   const candidate = await fetchCandidate(id);   // GET /api/v1/candidates/{id}
  const candidate = getMockCandidate(id);
  if (!candidate) notFound();

  // SWAP POINT — GET /api/v1/applications/{id}/stage-history, one per tab.
  // Fetched together here because the tab strip is client-side: switching tabs
  // must not cost a round trip.
  const historyByApplication: Record<string, StageHistoryEntry[]> =
    Object.fromEntries(
      candidate.applications.map((application) => [
        application.id,
        getMockStageHistory(application.id),
      ]),
    );

  // SWAP POINT — `_mock-reference.ts`; the real list is
  // GET /api/v1/users?role=RECRUITER,HIRING_MANAGER (action owners).
  const people = [...MOCK_RECRUITERS, ...MOCK_HIRING_MANAGERS];

  return (
    <>
      <PageHeader
        backHref="/candidates"
        backLabel="All candidates"
        eyebrow={candidate.id}
        title={candidate.name}
        description={`${candidate.applications.length} application${
          candidate.applications.length === 1 ? "" : "s"
        } on file · added ${formatDate(candidate.createdAt.slice(0, 10))}`}
      />

      <div className="mt-lg grid grid-cols-1 gap-lg xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Tab strip + active application. First in the DOM so keyboard and
            screen-reader users reach the working area before the reference
            profile; at ≥1280px it takes the wide column and the profile sits
            beside it. */}
        <div className="min-w-0">
          <h2 className="sr-only">Applications</h2>
          <CandidateWorkspace
            applications={candidate.applications}
            historyByApplication={historyByApplication}
            people={people}
            currentUser={MOCK_CURRENT_USER}
          />
        </div>

        <aside
          aria-labelledby="candidate-profile-heading"
          className="rounded-md border border-border bg-surface px-md py-md lg:px-lg lg:py-lg xl:sticky xl:top-[calc(56px+var(--spacing-lg))] xl:self-start"
        >
          <h2
            id="candidate-profile-heading"
            className="text-subhead text-text"
          >
            Profile
          </h2>
          <p className="mt-2xs text-body-sm text-muted">
            Shared across every application below.
          </p>

          <div className="mt-md">
            <DetailList columns={1}>
              <DetailItem label="Mobile" numeric>
                <a href={`tel:${candidate.mobile.replace(/\s/g, "")}`} className="link">
                  {candidate.mobile}
                </a>
              </DetailItem>
              <DetailItem label="Email">
                <a href={`mailto:${candidate.email}`} className="link break-all">
                  {candidate.email}
                </a>
              </DetailItem>
              <DetailItem label="Source">
                {CANDIDATE_SOURCE_LABELS[candidate.source]}
              </DetailItem>
            </DetailList>
          </div>

          <div className="mt-lg border-t border-border pt-md">
            {/* Real presigned-upload flow (Phase 1). No `onUploaded` handler is
                passed because this is a server component — persistence is the
                TODO(backend) documented in `components/ui/DocumentUpload.tsx`. */}
            <DocumentUpload
              ownerType="CANDIDATE"
              ownerId={candidate.id}
              label="CV"
              hint="One current CV per candidate."
              document={candidate.cvDocument}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
