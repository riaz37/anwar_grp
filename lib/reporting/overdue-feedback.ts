import "server-only";
import { InterviewStatus } from "@prisma/client";
import { prisma } from "../prisma";

/**
 * Overdue-feedback report (BUILD_PLAN.md Sec 2.7 background jobs; PDF
 * "Decisions and Approvals" implies feedback must actually land before a
 * decision can be made, so "who hasn't submitted yet" needs to be
 * surfaceable/remindable).
 *
 * Kept as a SEPARATE report from lib/reporting/recruiter-dashboard.ts
 * rather than folded into its "my tasks" output — documented choice:
 * recruiter-dashboard's tasks are keyed on
 * `Application.nextActionOwnerId`, a single-owner field that models
 * "whose job is the *application's* next step." An overdue evaluation
 * is owned by a PANELIST, a role recruiter-dashboard doesn't scope for
 * at all, and there can be several outstanding per interview (one per
 * panelist), not one next action per application. Reusing that field
 * would mean either overloading nextActionOwnerId with a
 * not-actually-the-owner value or adding a parallel per-panelist
 * "my tasks" merge into a function that today is a clean single-owner
 * query — not worth it for what is otherwise a fully separate read
 * model with its own shape (candidateName, panelistName, hoursOverdue).
 * A future "my tasks" unification is a reasonable follow-up, not done
 * here.
 *
 * Threshold: 24 hours past `Interview.scheduledAt` (a reasonable,
 * documented choice — not specified verbatim in the PDF/BUILD_PLAN).
 * Chosen because same-day feedback is the norm for interview panels;
 * 24h gives panelists an overnight buffer before nagging them, while
 * still catching stale feedback well within the same hiring cycle.
 */
export const OVERDUE_FEEDBACK_THRESHOLD_HOURS = 24;

export interface OverdueFeedbackItem {
  interviewId: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  requisitionId: string;
  requisitionTitle: string;
  roundNumber: number;
  scheduledAt: string;
  hoursOverdue: number;
  panelistId: string;
  panelistName: string;
}

/**
 * Interviews whose scheduledAt is more than OVERDUE_FEEDBACK_THRESHOLD_HOURS
 * in the past, CANCELLED interviews excluded, joined against assigned
 * panelists who have no *submitted* Evaluation row yet (a draft in
 * progress still counts as outstanding — only submittedAt clears it).
 * One row per (interview, missing panelist).
 */
export async function getOverdueFeedback(
  now: Date = new Date(),
  thresholdHours: number = OVERDUE_FEEDBACK_THRESHOLD_HOURS,
): Promise<OverdueFeedbackItem[]> {
  const cutoff = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);

  const interviews = await prisma.interview.findMany({
    where: {
      scheduledAt: { lt: cutoff },
      status: { not: InterviewStatus.CANCELLED },
    },
    include: {
      panelists: { include: { user: { select: { id: true, name: true } } } },
      evaluations: {
        where: { submittedAt: { not: null } },
        select: { panelistId: true },
      },
      application: {
        select: {
          id: true,
          candidate: { select: { id: true, name: true } },
          requisition: { select: { id: true, position: true } },
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const items: OverdueFeedbackItem[] = [];
  for (const interview of interviews) {
    const submittedPanelistIds = new Set(
      interview.evaluations.map((e) => e.panelistId),
    );
    const hoursOverdue = Math.floor(
      (now.getTime() - interview.scheduledAt.getTime()) / (60 * 60 * 1000),
    );
    for (const panelist of interview.panelists) {
      if (submittedPanelistIds.has(panelist.userId)) continue;
      items.push({
        interviewId: interview.id,
        applicationId: interview.application.id,
        candidateId: interview.application.candidate.id,
        candidateName: interview.application.candidate.name,
        requisitionId: interview.application.requisition.id,
        requisitionTitle: interview.application.requisition.position,
        roundNumber: interview.roundNumber,
        scheduledAt: interview.scheduledAt.toISOString(),
        hoursOverdue,
        panelistId: panelist.userId,
        panelistName: panelist.user.name,
      });
    }
  }

  return items;
}
