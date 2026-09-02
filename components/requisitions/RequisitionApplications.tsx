import Link from "next/link";
import { StagePill } from "@/components/ui/StatusPill";
import { TH_BASE } from "@/components/ui/table";
import { dueLabel, urgencyOf } from "@/components/tasks/types";
import type { ApplicationSummary } from "@/lib/types/domain";

/**
 * Candidates linked to one requisition. Shows every field spec Sec 5 makes
 * mandatory for an active application — stage, assigned recruiter, next
 * action, action owner, due date — so the requisition view answers "who is in
 * this pipeline and what is holding each of them up" without a second click.
 */

const CELL = "px-xs py-sm align-top text-body-sm sm:px-sm md:px-md";

const URGENCY_TEXT = {
  overdue: "text-error-ink",
  today: "text-warning-ink",
  upcoming: "text-muted",
} as const;

export function RequisitionApplications({
  applications,
}: {
  applications: ApplicationSummary[];
}) {
  if (applications.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-lg py-xl text-center">
        <p className="text-body text-text">No candidates linked yet</p>
        <p className="mx-auto mt-sm max-w-[52ch] text-body-sm text-muted">
          Adding a candidate against this requisition creates an application —
          the record that carries a stage, a recruiter and a next action.
        </p>
        <Link href="/candidates/new" className="link mt-md inline-block text-body-sm">
          Add a candidate
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[44rem] border-collapse text-body-sm">
        <caption className="sr-only">
          Candidates applying to this requisition, with each application’s
          stage, recruiter, next action, owner and due date.
        </caption>
        <thead className="border-b border-border bg-surface-sunken">
          <tr>
            <th scope="col" className={TH_BASE}>
              Candidate
            </th>
            <th scope="col" className={TH_BASE}>
              Stage
            </th>
            <th scope="col" className={`${TH_BASE} hidden lg:table-cell`}>
              Recruiter
            </th>
            <th scope="col" className={TH_BASE}>
              Next action
            </th>
            <th scope="col" className={`${TH_BASE} hidden lg:table-cell`}>
              Owner
            </th>
            <th scope="col" className={TH_BASE}>
              Due
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {applications.map((application) => {
            const urgency = urgencyOf(application.dueDate);
            return (
              <tr
                key={application.id}
                className="transition-colors duration-100 ease-move hover:bg-surface-sunken"
              >
                <td className={CELL}>
                  <Link
                    href={`/candidates/${application.candidateId}`}
                    className="rounded-sm font-medium text-accent-ink underline decoration-transparent underline-offset-2 transition-colors duration-100 ease-move hover:decoration-current"
                  >
                    {application.candidateName}
                  </Link>
                </td>
                <td className={CELL}>
                  <StagePill stage={application.stage} />
                </td>
                <td className={`${CELL} hidden text-muted lg:table-cell`}>
                  {application.assignedRecruiter.name}
                </td>
                <td className={`${CELL} text-text`}>{application.nextAction}</td>
                <td className={`${CELL} hidden text-muted lg:table-cell`}>
                  {application.actionOwner.name}
                </td>
                <td
                  className={`${CELL} whitespace-nowrap font-data tabular-nums ${URGENCY_TEXT[urgency]}`}
                >
                  {dueLabel(application.dueDate)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
