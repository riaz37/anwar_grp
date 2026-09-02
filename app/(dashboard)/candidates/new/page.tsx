import type { Metadata } from "next";
import {
  CandidateForm,
  type RequisitionOption,
} from "@/components/candidates/CandidateForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { MOCK_RECRUITERS } from "../../_mock-reference";
import { getMockRequisitions } from "../../_mock-requisitions";

export const metadata: Metadata = {
  title: "Add candidate",
};

export const dynamic = "force-dynamic";

export default function NewCandidatePage() {
  // SWAP POINT — `_mock-requisitions.ts`:
  //   GET /api/v1/requisitions?status=OPEN
  // A candidate can only be applied to a requisition that is actually open for
  // sourcing, which is why drafts and approved-but-not-open ones are excluded.
  const openRequisitions: RequisitionOption[] = getMockRequisitions()
    .filter((requisition) => requisition.approvalStatus === "OPEN")
    .map((requisition) => ({
      id: requisition.id,
      ref: requisition.ref,
      position: requisition.position,
      recruiterId: requisition.assignedRecruiter.id,
    }));

  return (
    <>
      <PageHeader
        backHref="/candidates"
        backLabel="All candidates"
        title="Add candidate"
        description="Records the person and their first application. Both are needed — an application is what carries a stage, a recruiter and a next action."
      />

      {/* Forms cap at 720px (DESIGN.md > Layout). */}
      <div className="mt-xl max-w-[720px]">
        <CandidateForm
          requisitions={openRequisitions}
          recruiters={MOCK_RECRUITERS}
        />
      </div>
    </>
  );
}
