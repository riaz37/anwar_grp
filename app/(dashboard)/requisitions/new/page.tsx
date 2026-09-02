import type { Metadata } from "next";
import { RequisitionForm } from "@/components/requisitions/RequisitionForm";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  MOCK_BUSINESS_UNITS,
  MOCK_DEPARTMENTS,
  MOCK_HIRING_MANAGERS,
  MOCK_RECRUITERS,
} from "../../_mock-reference";

export const metadata: Metadata = {
  title: "Register requisition",
};

export const dynamic = "force-dynamic";

export default function NewRequisitionPage() {
  // SWAP POINT — see `app/(dashboard)/_mock-reference.ts` for the four
  // reference lookups this page needs (business units, departments,
  // recruiters, hiring managers).
  return (
    <>
      <PageHeader
        backHref="/requisitions"
        backLabel="All requisitions"
        title="Register requisition"
        description="Everything the approval chain and the recruiter need. Save it as a draft if the ERF/RRF is still being signed."
      />

      {/* Forms cap at 720px (DESIGN.md > Layout). */}
      <div className="mt-xl max-w-[720px]">
        <RequisitionForm
          businessUnits={MOCK_BUSINESS_UNITS}
          departments={MOCK_DEPARTMENTS}
          recruiters={MOCK_RECRUITERS}
          hiringManagers={MOCK_HIRING_MANAGERS}
        />
      </div>
    </>
  );
}
