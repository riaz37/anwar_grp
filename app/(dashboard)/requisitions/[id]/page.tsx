import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequisitionApplications } from "@/components/requisitions/RequisitionApplications";
import { DetailItem, DetailList, Panel } from "@/components/ui/DetailList";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { RequisitionStatusPill } from "@/components/ui/StatusPill";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  isTerminalStage,
  POSITION_LEVEL_LABELS,
} from "@/lib/types/domain";
import { getMockApplicationsForRequisition } from "../../_mock-candidates";
import { getMockRequisition } from "../../_mock-requisitions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/requisitions/[id]">): Promise<Metadata> {
  const { id } = await params;
  const requisition = getMockRequisition(id);
  return {
    title: requisition
      ? `${requisition.ref} — ${requisition.position}`
      : "Requisition",
  };
}

export default async function RequisitionDetailPage({
  params,
}: PageProps<"/requisitions/[id]">) {
  const { id } = await params;

  // SWAP POINT — see `app/(dashboard)/_mock-requisitions.ts`:
  //   const requisition = await fetchRequisition(id);  // GET /api/v1/requisitions/{id}
  const requisition = getMockRequisition(id);
  if (!requisition) notFound();

  // SWAP POINT — GET /api/v1/requisitions/{id}/applications
  const applications = getMockApplicationsForRequisition(requisition.id);
  const live = applications.filter(
    (application) => !isTerminalStage(application.stage),
  );

  return (
    <>
      <PageHeader
        backHref="/requisitions"
        backLabel="All requisitions"
        eyebrow={requisition.ref}
        title={requisition.position}
        description={`${requisition.businessUnit.name} · ${requisition.department.name}`}
        meta={
          <RequisitionStatusPill
            status={requisition.approvalStatus}
            size="md"
          />
        }
      />

      <div className="mt-lg grid grid-cols-1 gap-lg xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-lg">
          <Panel id="req-details" title="Requisition details">
            <DetailList columns={2}>
              <DetailItem label="Business unit">
                {requisition.businessUnit.name}
              </DetailItem>
              <DetailItem label="Department">
                {requisition.department.name}
              </DetailItem>
              <DetailItem label="Position">{requisition.position}</DetailItem>
              <DetailItem label="Position level">
                {POSITION_LEVEL_LABELS[requisition.positionLevel]}
              </DetailItem>
              <DetailItem label="Vacancy count" numeric>
                {requisition.vacancyCount}
              </DetailItem>
              <DetailItem label="Target joining date" numeric>
                {formatDate(requisition.targetJoiningDate)}
              </DetailItem>
              <DetailItem label="Hiring manager">
                {requisition.hiringManager.name}
              </DetailItem>
              <DetailItem label="Assigned recruiter">
                {requisition.assignedRecruiter.name}
              </DetailItem>
              <DetailItem label="Approval status">
                <RequisitionStatusPill status={requisition.approvalStatus} />
              </DetailItem>
              <DetailItem label="Last updated" numeric>
                {formatDateTime(requisition.updatedAt)}
              </DetailItem>
              {requisition.notes && (
                <DetailItem label="Notes" span>
                  {requisition.notes}
                </DetailItem>
              )}
            </DetailList>
          </Panel>

          <Panel
            id="req-applications"
            title="Candidates"
            description={`${live.length} live of ${applications.length} application${
              applications.length === 1 ? "" : "s"
            } against ${requisition.vacancyCount} vacanc${
              requisition.vacancyCount === 1 ? "y" : "ies"
            }.`}
          >
            <RequisitionApplications applications={applications} />
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-[calc(56px+var(--spacing-lg))] xl:self-start">
          <Panel
            id="req-erf"
            title="ERF / RRF"
            description="The signed requisition form this vacancy was raised on."
          >
            {/* Real presigned-upload flow (Phase 1, BUILD_PLAN.md Sec 2.6).
                Persistence of the resulting Document row is the documented
                TODO(backend) in `components/ui/DocumentUpload.tsx`. */}
            <DocumentUpload
              ownerType="REQUISITION"
              ownerId={requisition.id}
              label="Attachment"
              hint="Scan or export of the approved form."
              document={requisition.erfRrfDocument}
            />
          </Panel>
        </aside>
      </div>
    </>
  );
}
