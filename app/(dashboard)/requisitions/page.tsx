import type { Metadata } from "next";
import { RequisitionsTable } from "@/components/requisitions/RequisitionsTable";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlusIcon } from "@/components/ui/icons";
import { getMockRequisitions } from "../_mock-requisitions";

export const metadata: Metadata = {
  title: "Requisitions",
};

/** Role-scoped and time-relative once wired to the API — never prerendered. */
export const dynamic = "force-dynamic";

export default function RequisitionsPage() {
  // SWAP POINT — see `app/(dashboard)/_mock-requisitions.ts`:
  //   const requisitions = await fetchRequisitions();  // GET /api/v1/requisitions
  const requisitions = getMockRequisitions();

  const open = requisitions.filter(
    (requisition) => requisition.approvalStatus === "OPEN",
  );
  const openVacancies = open.reduce(
    (total, requisition) => total + requisition.vacancyCount,
    0,
  );

  return (
    <>
      <PageHeader
        title="Requisitions"
        description="What the group is hiring for, who signed it off, and which recruiter is accountable for filling it."
        actions={
          <ButtonLink href="/requisitions/new" variant="primary">
            <PlusIcon />
            Register requisition
          </ButtonLink>
        }
      />

      <p className="mt-md flex flex-wrap items-center gap-x-md gap-y-2xs text-body-sm text-muted">
        <span className="flex items-center gap-xs">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          <span className="font-data tabular-nums text-text">{open.length}</span>
          open
        </span>
        <span>
          <span className="font-data tabular-nums text-text">
            {openVacancies}
          </span>{" "}
          vacancies to fill
        </span>
      </p>

      <div className="mt-lg">
        <RequisitionsTable requisitions={requisitions} />
      </div>
    </>
  );
}
