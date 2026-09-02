import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ApplicationDetail } from "@/components/applications/ApplicationPanel";
import { CandidateWorkspace } from "@/components/candidates/CandidateWorkspace";
import { DetailItem, DetailList } from "@/components/ui/DetailList";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDate, todayIsoDate } from "@/lib/format";
import {
  CANDIDATE_SOURCE_LABELS,
  USER_ROLE_LABELS,
  type StageHistoryEntry,
} from "@/lib/types/domain";
import type { ApplicationJoining } from "@/lib/types/joining";
import { getApplicationApproval } from "../../_mock-approvals";
import {
  getMockCandidate,
  getMockStageHistory,
} from "../../_mock-candidates";
import { getMockCommunications, getMockTemplates } from "../../_mock-communications";
import { getEvaluationRounds, resolveViewer } from "../../_mock-evaluations";
import { getMockInterviews } from "../../_mock-interviews";
import { getMockJoiningChecklist } from "../../_mock-joining";
import { getMockRequisition } from "../../_mock-requisitions";
import { getMockScreening } from "../../_mock-screening";
import {
  MOCK_COMPANY_NAME,
  MOCK_COORDINATORS,
  MOCK_CURRENT_USER,
  MOCK_CURRENT_USER_CONTACT,
  MOCK_EVALUATION_FORMS,
  MOCK_HIRING_MANAGERS,
  MOCK_PANEL_MEMBERS,
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
  searchParams,
}: PageProps<"/candidates/[id]">) {
  const { id } = await params;

  /* ────────────────────────────────────────────────────────────────────────
   * DEV-ONLY viewer override — NOT A FEATURE. Remove with the mock data.
   *
   * The evaluation surface renders four genuinely different things depending
   * on who is looking (own form / blind gate / unblinded panel feedback /
   * consolidated results), and a single seeded session can only ever be one
   * of them. `?as=<userId>` picks a mock viewer so all four are reachable
   * while the real session is a stub; it is fenced behind NODE_ENV so it can
   * never resolve in a production build, and nothing in the UI links to it.
   *
   * SWAP POINT — `const viewer = await requireSession()`; delete the override,
   * the `searchParams` argument, `resolveViewer` and `MOCK_VIEWERS`.
   * See `_mock-evaluations.ts` for the four demo URLs.
   * ──────────────────────────────────────────────────────────────────────── */
  const query = await searchParams;
  const asParam = typeof query.as === "string" ? query.as : undefined;
  const override =
    process.env.NODE_ENV === "production" ? null : resolveViewer(asParam);
  const viewer = override ?? MOCK_CURRENT_USER;

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

  // SWAP POINTS — one bundle per application, fetched together for the same
  // reason the stage history is: the tab strip is client-side, so switching
  // applications must not cost a round trip.
  //   GET /api/v1/applications/{id}/screening        (404 = not recorded yet)
  //   GET /api/v1/applications/{id}/interviews
  //   GET /api/v1/applications/{id}/communications
  //   GET /api/v1/applications/{id}/approval-request   (404 = not started yet)
  //   GET /api/v1/approval-chain-configs?businessUnitId=&departmentId=
  //                                      &positionLevel=
  //     — both behind `getApplicationApproval`; see `_mock-approvals.ts` for
  //       the full contract, including which non-200s are expected states
  //       rather than failures.
  //   GET /api/v1/applications/{id}/joining-checklist   ([] = not started yet)
  //     — see `_mock-joining.ts`.
  // `department`/`businessUnit` come from the application's requisition
  // (GET /api/v1/requisitions/{id}); they are carried here because the message
  // templates interpolate them and `ApplicationSummary` does not hold them.

  /* Resolved once, on the server, and threaded into every application's joining
     bundle: "overdue" is the only clock-dependent thing the Joining tab renders,
     and a server pass and a client rehydration that disagreed about today's date
     would mismatch on exactly the rows that matter. */
  const today = todayIsoDate();

  const detailByApplication: Record<string, ApplicationDetail> =
    Object.fromEntries(
      candidate.applications.map((application) => {
        const requisition = getMockRequisition(application.requisitionId);
        const interviews = getMockInterviews(application.id);
        const joining: ApplicationJoining = {
          items: getMockJoiningChecklist(application.id),
          targetJoiningDate: requisition?.targetJoiningDate ?? null,
          today,
          /* Default owners for the standard checklist. With the real API these
             resolve server-side from the requisition and the users table
             (GET /api/v1/users?role=…); the point is that the seed hands IT's
             items to IT rather than dumping thirteen rows on the recruiter. */
          seedOwnerByFunction: {
            RECRUITER: application.assignedRecruiter.id,
            HIRING_MANAGER:
              requisition?.hiringManager.id ?? application.assignedRecruiter.id,
            IT: "usr_it_1",
            ADMIN: "usr_admin_1",
            HR: "usr_hr_1",
          },
        };
        return [
          application.id,
          {
            screening: getMockScreening(application.id),
            interviews,
            joining,
            // Blind-until-submit is applied HERE, server-side, before the
            // payload is serialized to the browser — never in a component.
            // A blinded viewer's props contain no peer evaluation at all.
            evaluationRounds: getEvaluationRounds(interviews, viewer),
            communications: getMockCommunications(application.id),
            // Resolved here for the same reason: `viewerDecidableStepId` is an
            // authorization answer, and the client is never the thing that
            // answers it.
            approval: getApplicationApproval(application, viewer),
            department: requisition?.department.name ?? "—",
            businessUnit: requisition?.businessUnit.name ?? "—",
          } satisfies ApplicationDetail,
        ];
      }),
    );

  // SWAP POINTS — GET /api/v1/message-templates, GET /api/v1/users?role=…,
  // GET /api/v1/evaluation-forms (Phase 4). The recruiter's own contact
  // details come from the session's user record server-side.
  const sectionsConfig = {
    templates: getMockTemplates(),
    panelMembers: MOCK_PANEL_MEMBERS,
    /* Joining reaches outside recruiting by design — IT, Administration and HR
       own six of the spec's own thirteen items — so the owner picker is a
       superset of the panel list, not the same list. */
    joiningOwners: [
      ...MOCK_RECRUITERS.map((person) => ({ ...person, role: "Recruiter" })),
      ...MOCK_HIRING_MANAGERS.map((person) => ({
        ...person,
        role: "Hiring manager",
      })),
      ...MOCK_COORDINATORS,
    ],
    evaluationForms: MOCK_EVALUATION_FORMS,
    candidate: {
      name: candidate.name,
      email: candidate.email,
      mobile: candidate.mobile,
    },
    recruiter: {
      name: viewer.name,
      email: MOCK_CURRENT_USER_CONTACT.email,
      mobile: MOCK_CURRENT_USER_CONTACT.mobile,
    },
    companyName: MOCK_COMPANY_NAME,
  };

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
          {override && (
            /* DEV-ONLY, see the block at the top of this file. Rendered so a
               screenshot of an impersonated view can never be mistaken for the
               real one. */
            <p className="mb-md rounded-sm border border-info-soft bg-info-soft px-md py-sm text-body-sm text-info-ink">
              Development view — showing this workspace as{" "}
              <strong className="font-semibold">{override.name}</strong> (
              {USER_ROLE_LABELS[override.role]}). Remove{" "}
              <code className="font-mono">?as=</code> from the URL to return to
              the signed-in user.
            </p>
          )}
          <CandidateWorkspace
            applications={candidate.applications}
            historyByApplication={historyByApplication}
            detailByApplication={detailByApplication}
            sectionsConfig={sectionsConfig}
            people={people}
            currentUser={viewer}
            viewerId={override ? override.id : undefined}
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
