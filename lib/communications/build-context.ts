import { formatDate, formatDuration, formatTime } from "@/lib/format";
import {
  INTERVIEW_MODE_LABELS,
  type ApplicationSummary,
  type Candidate,
  type InterviewRound,
} from "@/lib/types/domain";

/**
 * Builds the value map the template renderer interpolates.
 *
 * The single rule this module exists to enforce: it can only produce values
 * for paths that are on the allowlist in `./field-allowlist.ts`. Nothing here
 * reads a screening comment, a stage-history note or a rejection reason — the
 * data is simply never assembled, which is what "structurally not in the
 * allowlist" (BUILD_PLAN.md Sec 2.8) means in practice. A field being absent
 * here is a stronger guarantee than a filter applied further down.
 *
 * Keys deliberately go *missing* rather than empty-string when there is no
 * value: the renderer marks a missing allowlisted field visibly in the preview
 * so the recruiter sees the gap before approving, instead of sending a message
 * with a blank where the joining date should be.
 */

export interface MessageContextInput {
  application: ApplicationSummary;
  candidate: Pick<Candidate, "name" | "email" | "mobile">;
  /** Denormalised requisition fields the application row does not carry. */
  department: string;
  businessUnit: string;
  recruiter: { name: string; email: string; mobile: string };
  companyName: string;
  /** The round an interview-related message is about, if one is selected. */
  interview: InterviewRound | null;
  /** Free text the recruiter supplies on the draft form, for document asks. */
  documentRequestList?: string;
  /** ISO calendar date; absent until a joining date exists on the record. */
  joiningDate?: string;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function buildMessageContext(
  input: MessageContextInput,
): Record<string, string> {
  const values: Record<string, string> = {
    "candidate.name": input.candidate.name,
    "candidate.first_name": firstName(input.candidate.name),
    "candidate.email": input.candidate.email,
    "candidate.mobile": input.candidate.mobile,

    "position.title": input.application.requisitionTitle,
    "position.department": input.department,
    "position.business_unit": input.businessUnit,
    "position.requisition_ref": input.application.requisitionRef,

    "recruiter.name": input.recruiter.name,
    "recruiter.email": input.recruiter.email,
    "recruiter.mobile": input.recruiter.mobile,

    "company.name": input.companyName,
  };

  const interview = input.interview;
  if (interview) {
    values["interview.round"] = String(interview.roundNumber);
    values["interview.title"] = interview.title;
    values["interview.date"] = formatDate(interview.scheduledDate);
    values["interview.time"] = formatTime(interview.scheduledTime);
    values["interview.duration"] = formatDuration(interview.durationMinutes);
    values["interview.mode"] = INTERVIEW_MODE_LABELS[interview.mode];
    values["interview.panel"] = interview.panel
      .map((person) => person.name)
      .join(", ");
    if (interview.candidateInstructions) {
      values["interview.instructions"] = interview.candidateInstructions;
    }
    /* Location and link are mutually exclusive on the record, but templates
       written for either channel reference `interview.location` — so an online
       round resolves that path to its joining link rather than leaving the
       candidate with a blank "Where". */
    if (interview.mode === "ONLINE") {
      if (interview.onlineLink) {
        values["interview.online_link"] = interview.onlineLink;
        values["interview.location"] = interview.onlineLink;
      }
    } else if (interview.location) {
      values["interview.location"] = interview.location;
    }
  }

  if (input.documentRequestList?.trim()) {
    values["document.request_list"] = input.documentRequestList.trim();
  }
  if (input.joiningDate) {
    values["joining.date"] = formatDate(input.joiningDate);
  }

  return values;
}
