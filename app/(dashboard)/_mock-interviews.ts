import type { InterviewRound } from "@/lib/types/domain";
import { MOCK_EVALUATION_FORMS, personById } from "./_mock-reference";

/**
 * TEMPORARY mock data for the Interviews section of the application view
 * (spec Sec 6 > Interview Scheduling).
 *
 * SWAP POINTS
 *   app/(dashboard)/candidates/[id]/page.tsx
 *     getMockInterviews(applicationId)
 *       -> await fetchInterviews(applicationId);
 *          // GET /api/v1/applications/{id}/interviews -> InterviewRound[]
 *          // Reschedule history is expected *nested* on each round rather
 *          //  than as a second call: the spec requires it to be visible, and
 *          //  a round is never rendered without it.
 *
 *   components/interviews/InterviewForm.tsx
 *     submitInterview()
 *       -> POST  /api/v1/applications/{id}/interviews   (schedule a round)
 *       -> PATCH /api/v1/interviews/{id}                (edit a round)
 *
 *   components/interviews/RescheduleForm.tsx
 *     submitReschedule()
 *       -> POST /api/v1/interviews/{id}/reschedule
 *          { toDate, toTime, reason, version }
 *          The reschedule is its own endpoint, not a PATCH of date/time,
 *          because it must append an `InterviewRescheduleHistory` row
 *          atomically — a PATCH that silently skipped the history row would
 *          break the spec's "Rescheduling history" requirement.
 *
 * Fixtures cover the three shapes the UI has to handle: an application with no
 * rounds at all, one with a single upcoming round, and one with two rounds
 * where the second has been moved twice (so the history timeline is exercised
 * with more than one entry).
 */

function dateDaysFromNow(offset: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function timestampDaysAgo(offset: number, hour = 9): string {
  const date = new Date();
  date.setUTCHours(hour, 45, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
}

function formName(id: string | null): string | null {
  if (!id) return null;
  return MOCK_EVALUATION_FORMS.find((form) => form.id === id)?.name ?? null;
}

interface RescheduleSeed {
  fromDay: number;
  fromTime: string;
  toDay: number;
  toTime: string;
  reason: string;
  by: string;
  daysAgo: number;
}

type InterviewSeed = Omit<
  InterviewRound,
  | "panel"
  | "evaluationFormName"
  | "rescheduleHistory"
  | "createdAt"
  | "updatedAt"
> & {
  panelIds: readonly string[];
  reschedules: readonly RescheduleSeed[];
  createdDaysAgo: number;
  updatedDaysAgo: number;
};

const SEEDS: readonly InterviewSeed[] = [
  {
    id: "int_8814_r1",
    applicationId: "app_8814",
    roundNumber: 1,
    title: "Functional round",
    scheduledDate: dateDaysFromNow(-14),
    scheduledTime: "11:00",
    durationMinutes: 45,
    mode: "IN_PERSON",
    location: "Head office, Gulshan-1 — Meeting room 4B",
    onlineLink: null,
    // Three panelists on purpose: this is the round `_mock-evaluations.ts`
    // uses to exercise the blind-until-submit gate, and "2 of 3 submitted"
    // is a more honest test of that copy than "1 of 2".
    panelIds: ["usr_hm_1", "usr_panel_3", "usr_panel_4"],
    evaluationFormId: "evf_functional",
    candidateInstructions:
      "Please arrive 15 minutes early and bring a printed CV plus your NID. Ask for Talent Acquisition at reception.",
    status: "COMPLETED",
    reschedules: [],
    createdDaysAgo: 21,
    updatedDaysAgo: 14,
    version: 3,
  },
  {
    id: "int_8814_r2",
    applicationId: "app_8814",
    roundNumber: 2,
    title: "Leadership round",
    scheduledDate: dateDaysFromNow(2),
    scheduledTime: "15:30",
    durationMinutes: 60,
    mode: "ONLINE",
    location: null,
    onlineLink: "https://meet.example.com/anwar-merch-r2",
    panelIds: ["usr_hm_4", "usr_panel_1", "usr_recruiter_1"],
    evaluationFormId: "evf_leadership",
    candidateInstructions:
      "Join five minutes early to check audio. If the link fails, call the recruiter on the number in this message.",
    status: "RESCHEDULED",
    reschedules: [
      {
        fromDay: -5,
        fromTime: "10:00",
        toDay: -1,
        toTime: "16:00",
        reason:
          "Panel member Nusrat Jahan was called to the Gazipur unit for a buyer audit.",
        by: "usr_recruiter_1",
        daysAgo: 8,
      },
      {
        fromDay: -1,
        fromTime: "16:00",
        toDay: 2,
        toTime: "15:30",
        reason:
          "Candidate requested a later date — clashed with her current employer's month-end shipment.",
        by: "usr_recruiter_1",
        daysAgo: 3,
      },
    ],
    createdDaysAgo: 12,
    updatedDaysAgo: 3,
    version: 6,
  },
  {
    id: "int_8845_r1",
    applicationId: "app_8845",
    roundNumber: 1,
    title: "Technical round",
    scheduledDate: dateDaysFromNow(1),
    scheduledTime: "10:30",
    durationMinutes: 45,
    mode: "IN_PERSON",
    location: "Anwar Cement, Plant Operations block — Interview room 2",
    onlineLink: null,
    panelIds: ["usr_hm_5", "usr_panel_5"],
    evaluationFormId: "evf_standard",
    candidateInstructions:
      "Transport from the Dhaka office leaves at 08:00. Confirm with the recruiter by Thursday if you need a seat.",
    status: "SCHEDULED",
    reschedules: [],
    createdDaysAgo: 3,
    updatedDaysAgo: 3,
    version: 1,
  },
  {
    id: "int_8866_r1",
    applicationId: "app_8866",
    roundNumber: 1,
    title: "Technical round",
    scheduledDate: dateDaysFromNow(-2),
    scheduledTime: "14:00",
    durationMinutes: 60,
    mode: "ONLINE",
    location: null,
    onlineLink: "https://meet.example.com/anwar-design-r1",
    panelIds: ["usr_hm_2", "usr_panel_4"],
    evaluationFormId: "evf_standard",
    candidateInstructions:
      "Have your portfolio open and ready to share on screen.",
    status: "COMPLETED",
    reschedules: [],
    createdDaysAgo: 8,
    updatedDaysAgo: 2,
    version: 2,
  },
];

function hydrate(seed: InterviewSeed): InterviewRound {
  const {
    panelIds,
    reschedules,
    createdDaysAgo,
    updatedDaysAgo,
    evaluationFormId,
    ...rest
  } = seed;

  return {
    ...rest,
    evaluationFormId,
    evaluationFormName: formName(evaluationFormId),
    panel: panelIds.map(personById),
    rescheduleHistory: reschedules.map((entry, index) => ({
      id: `${seed.id}_rs_${index}`,
      interviewId: seed.id,
      fromDate: dateDaysFromNow(entry.fromDay),
      fromTime: entry.fromTime,
      toDate: dateDaysFromNow(entry.toDay),
      toTime: entry.toTime,
      reason: entry.reason,
      changedBy: personById(entry.by),
      changedAt: timestampDaysAgo(entry.daysAgo),
    })),
    createdAt: timestampDaysAgo(createdDaysAgo),
    updatedAt: timestampDaysAgo(updatedDaysAgo),
  };
}

export function getMockInterviews(applicationId: string): InterviewRound[] {
  return SEEDS.filter((seed) => seed.applicationId === applicationId)
    .map(hydrate)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

/**
 * One round by id — needed by the evaluation server actions, which know the
 * interview but not the application it hangs off.
 *
 * SWAP POINT — GET /api/v1/interviews/{id} (the route already exists).
 */
export function getMockInterview(interviewId: string): InterviewRound | null {
  const seed = SEEDS.find((entry) => entry.id === interviewId);
  return seed ? hydrate(seed) : null;
}
