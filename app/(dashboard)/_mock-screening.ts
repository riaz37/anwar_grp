import type { DocumentRef, ScreeningAssessment } from "@/lib/types/domain";
import { personById } from "./_mock-reference";

/**
 * TEMPORARY mock data for the Screening & Assessment section of the
 * application view (spec Sec 6 > Screening and Assessment).
 *
 * Same convention as `_mock-candidates.ts` — everything returned is already
 * the API-facing shape from `lib/types/domain.ts`.
 *
 * SWAP POINTS
 *   app/(dashboard)/candidates/[id]/page.tsx
 *     getMockScreening(applicationId)
 *       -> await fetchScreening(applicationId);
 *          // GET /api/v1/applications/{id}/screening  -> 200 | 404
 *          // A 404 is not an error here: "not recorded yet" is the common
 *          //  case and the UI renders its empty state from it.
 *
 *   components/screening/ScreeningForm.tsx
 *     submitScreening()
 *       -> POST /api/v1/applications/{id}/screening   (first save)
 *       -> PATCH /api/v1/applications/{id}/screening  (subsequent edits)
 *
 * Only three of the ten seeded applications carry a record, deliberately: the
 * empty state is the state a recruiter sees most often, so it has to be
 * exercised by the fixtures rather than assumed.
 */

function timestampDaysAgo(offset: number, hour = 11): string {
  const date = new Date();
  date.setUTCHours(hour, 20, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
}

function assessmentDoc(
  id: string,
  fileName: string,
  daysAgo: number,
  uploadedBy: string,
): DocumentRef {
  return {
    id,
    fileName,
    contentType: "application/pdf",
    sizeBytes: 240_000 + ((fileName.length * 6_133) % 700_000),
    uploadedAt: timestampDaysAgo(daysAgo),
    uploadedBy,
  };
}

type ScreeningSeed = Omit<
  ScreeningAssessment,
  "recordedBy" | "recordedAt" | "updatedAt"
> & {
  recordedById: string;
  recordedDaysAgo: number;
  updatedDaysAgo: number;
};

const SEEDS: readonly ScreeningSeed[] = [
  {
    // Farhana Rahman → REQ-2026-114. Full record: phone screen, paper case
    // study, marked, evaluator signed off. This is the "read-only summary"
    // path in the UI.
    id: "scr_8814",
    applicationId: "app_8814",
    eligibility: "ELIGIBLE",
    screeningComments:
      "Six years in export merchandising, three of them on knit. Handled buyer communication directly for H&M and Lindex. Comfortable with the volume this requisition carries. No visa or relocation constraints.",
    telephoneOutcome: "COMPLETED",
    availability: "Serving 30-day notice — earliest start 8 Oct 2026.",
    recommendation: "PROCEED_TO_ASSESSMENT",
    assessmentType: "CASE_STUDY",
    assessmentScore: 78,
    assessmentMaxScore: 100,
    attendance: "ATTENDED",
    documents: [
      assessmentDoc(
        "doc_asmt_8814_a",
        "farhana-rahman-case-study.pdf",
        33,
        "Sadia Karim",
      ),
      assessmentDoc(
        "doc_asmt_8814_b",
        "farhana-rahman-marking-sheet.pdf",
        32,
        "Kamrul Hasan",
      ),
    ],
    evaluatorRecommendation: "RECOMMEND",
    evaluatorComments:
      "Costing section was strong. Lost marks on the shipment-delay scenario — recovered the schedule but did not escalate to the buyer. Worth probing at interview.",
    recordedById: "usr_recruiter_1",
    recordedDaysAgo: 41,
    updatedDaysAgo: 32,
    version: 4,
  },
  {
    // Jubayer Ahmed → REQ-2026-121. Screening done, assessment sat but not yet
    // marked: `assessmentScore: null` with attendance ATTENDED is the "half
    // recorded" state the form has to be able to save and re-open.
    id: "scr_8874",
    applicationId: "app_8874",
    eligibility: "ELIGIBLE",
    screeningComments:
      "Two years on plant maintenance at a competitor. Diploma rather than the B.Sc the requisition asks for — hiring manager confirmed the diploma is acceptable with the experience.",
    telephoneOutcome: "COMPLETED",
    availability: "Immediately available.",
    recommendation: "PROCEED_TO_ASSESSMENT",
    assessmentType: "WRITTEN_PAPER",
    assessmentScore: null,
    assessmentMaxScore: 50,
    attendance: "ATTENDED",
    documents: [
      assessmentDoc(
        "doc_asmt_8874_a",
        "jubayer-ahmed-answer-sheet.pdf",
        2,
        "Mahmudul Haque",
      ),
    ],
    evaluatorRecommendation: null,
    evaluatorComments: "",
    recordedById: "usr_recruiter_2",
    recordedDaysAgo: 12,
    updatedDaysAgo: 2,
    version: 3,
  },
  {
    // Rifat Chowdhury → REQ-2026-121. Assessment skipped for the role, so the
    // record has to state that out loud rather than leave the fields blank.
    id: "scr_8845",
    applicationId: "app_8845",
    eligibility: "ELIGIBLE_WITH_RESERVATION",
    screeningComments:
      "Strong commercial background but no exposure to the ERP the department runs. Reservation is training time, not capability.",
    telephoneOutcome: "COMPLETED",
    availability: "60-day notice. Flexible on the start date if needed.",
    recommendation: "PROCEED_TO_INTERVIEW",
    assessmentType: "NONE",
    assessmentScore: null,
    assessmentMaxScore: 100,
    attendance: "NOT_APPLICABLE",
    documents: [],
    evaluatorRecommendation: null,
    evaluatorComments: "",
    recordedById: "usr_recruiter_1",
    recordedDaysAgo: 19,
    updatedDaysAgo: 11,
    version: 2,
  },
];

export function getMockScreening(
  applicationId: string,
): ScreeningAssessment | null {
  const seed = SEEDS.find((entry) => entry.applicationId === applicationId);
  if (!seed) return null;

  const { recordedById, recordedDaysAgo, updatedDaysAgo, ...rest } = seed;
  return {
    ...rest,
    recordedBy: personById(recordedById),
    recordedAt: timestampDaysAgo(recordedDaysAgo),
    updatedAt: timestampDaysAgo(updatedDaysAgo),
  };
}
