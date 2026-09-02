import type {
  ApplicationStage,
  ApplicationSummary,
  CandidateSource,
  CandidateWithApplications,
  DocumentRef,
  DuplicateMatch,
  StageHistoryEntry,
} from "@/lib/types/domain";
import { personById } from "./_mock-reference";
import { getMockRequisition } from "./_mock-requisitions";

/**
 * TEMPORARY mock data for the Candidates list, the Candidate Workspace and
 * the per-application stage views.
 *
 * Same convention as `_mock-tasks.ts`. Everything returned is already the
 * API-facing shape from `lib/types/domain.ts`.
 *
 * SWAP POINTS
 *   app/(dashboard)/candidates/page.tsx
 *     const candidates = getMockCandidates();
 *       -> const candidates = await fetchCandidates(searchParams);
 *          // GET /api/v1/candidates?q=&source=&recruiterId=&stage=
 *
 *   app/(dashboard)/candidates/[id]/page.tsx
 *     const candidate = getMockCandidate(id);
 *       -> const candidate = await fetchCandidate(id);
 *          // GET /api/v1/candidates/{id}
 *          // + GET /api/v1/candidates/{id}/applications
 *     const history = getMockStageHistory(applicationId);
 *       -> await fetchStageHistory(applicationId);
 *          // GET /api/v1/applications/{id}/stage-history
 *
 *   findMockDuplicates()  — see its own doc comment; this is the stand-in for
 *   the backend's exact-match dedup check.
 *
 * Several candidates deliberately hold two or three applications: spec Sec 6
 * requires the candidate profile to be separate from the job application, and
 * BUILD_PLAN.md Sec 5 decision #6 turns that into the Workspace tab strip.
 * The tab strip is only exercised by multi-application candidates, so the
 * fixtures have to contain some.
 */

function daysFromNow(offset: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function timestampDaysAgo(offset: number): string {
  const date = new Date();
  date.setUTCHours(10, 15, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
}

function cv(id: string, fileName: string, daysAgo: number): DocumentRef {
  return {
    id,
    fileName,
    contentType: "application/pdf",
    sizeBytes: 180_000 + (fileName.length * 7_919) % 900_000,
    uploadedAt: timestampDaysAgo(daysAgo),
    uploadedBy: "Sadia Karim",
  };
}

interface ApplicationSeed {
  id: string;
  requisitionId: string;
  stage: ApplicationStage;
  recruiterId: string;
  nextAction: string;
  ownerId: string;
  dueInDays: number;
  stageChangedDaysAgo: number;
  appliedDaysAgo: number;
  version: number;
  /** Stage transitions, oldest first. `daysAgo` is relative to today. */
  history: { stage: ApplicationStage; daysAgo: number; by: string; note?: string }[];
}

interface CandidateSeed {
  id: string;
  name: string;
  mobile: string;
  email: string;
  source: CandidateSource;
  cvDocument: DocumentRef | null;
  createdDaysAgo: number;
  version: number;
  applications: ApplicationSeed[];
}

const SEEDS: readonly CandidateSeed[] = [
  {
    id: "cand_2201",
    name: "Farhana Rahman",
    mobile: "+8801711 204 553",
    email: "farhana.rahman@example.com",
    source: "JOB_PORTAL",
    cvDocument: cv("doc_cv_2201", "farhana-rahman-cv.pdf", 46),
    createdDaysAgo: 46,
    version: 3,
    applications: [
      {
        id: "app_8814",
        requisitionId: "req_114",
        stage: "FEEDBACK_PENDING",
        recruiterId: "usr_recruiter_1",
        nextAction: "Chase evaluation from Nusrat Jahan (Panel 2)",
        ownerId: "usr_recruiter_1",
        dueInDays: -4,
        stageChangedDaysAgo: 9,
        appliedDaysAgo: 46,
        version: 11,
        history: [
          { stage: "NEW", daysAgo: 46, by: "usr_recruiter_1" },
          { stage: "SCREENING", daysAgo: 41, by: "usr_recruiter_1" },
          {
            stage: "ASSESSMENT",
            daysAgo: 33,
            by: "usr_recruiter_1",
            note: "Merchandising case study, scored 78/100.",
          },
          { stage: "INTERVIEW", daysAgo: 21, by: "usr_recruiter_1" },
          {
            stage: "FEEDBACK_PENDING",
            daysAgo: 9,
            by: "usr_recruiter_1",
            note: "Panel of three; two evaluations submitted.",
          },
        ],
      },
      {
        id: "app_8620",
        requisitionId: "req_124",
        stage: "REDIRECTED",
        recruiterId: "usr_recruiter_1",
        nextAction: "None — profile redirected to REQ-2026-114",
        ownerId: "usr_recruiter_1",
        dueInDays: -30,
        stageChangedDaysAgo: 44,
        appliedDaysAgo: 52,
        version: 4,
        history: [
          { stage: "NEW", daysAgo: 52, by: "usr_recruiter_1" },
          { stage: "SCREENING", daysAgo: 48, by: "usr_recruiter_1" },
          {
            stage: "REDIRECTED",
            daysAgo: 44,
            by: "usr_recruiter_1",
            note: "Stronger fit for the Senior Merchandiser vacancy.",
          },
        ],
      },
      {
        id: "app_8402",
        requisitionId: "req_098",
        stage: "REJECTED",
        recruiterId: "usr_recruiter_2",
        nextAction: "None — closed at screening",
        ownerId: "usr_recruiter_2",
        dueInDays: -60,
        stageChangedDaysAgo: 74,
        appliedDaysAgo: 82,
        version: 3,
        history: [
          { stage: "NEW", daysAgo: 82, by: "usr_recruiter_2" },
          { stage: "SCREENING", daysAgo: 79, by: "usr_recruiter_2" },
          {
            stage: "REJECTED",
            daysAgo: 74,
            by: "usr_recruiter_2",
            note: "No planning-systems experience for this requisition.",
          },
        ],
      },
    ],
  },
  {
    id: "cand_2177",
    name: "Md. Tanvir Hasan",
    mobile: "+8801819 663 210",
    email: "tanvir.hasan@example.com",
    source: "REFERRAL",
    cvDocument: cv("doc_cv_2177", "md-tanvir-hasan-cv.pdf", 61),
    createdDaysAgo: 61,
    version: 2,
    applications: [
      {
        id: "app_8790",
        requisitionId: "req_098",
        stage: "APPROVAL",
        recruiterId: "usr_recruiter_1",
        nextAction: "Submit selection approval to Head of Operations",
        ownerId: "usr_recruiter_1",
        dueInDays: -2,
        stageChangedDaysAgo: 6,
        appliedDaysAgo: 61,
        version: 14,
        history: [
          { stage: "NEW", daysAgo: 61, by: "usr_recruiter_1" },
          { stage: "SCREENING", daysAgo: 57, by: "usr_recruiter_1" },
          { stage: "ASSESSMENT", daysAgo: 44, by: "usr_recruiter_1" },
          { stage: "INTERVIEW", daysAgo: 28, by: "usr_recruiter_1" },
          { stage: "FEEDBACK_PENDING", daysAgo: 17, by: "usr_recruiter_1" },
          {
            stage: "APPROVAL",
            daysAgo: 6,
            by: "usr_recruiter_1",
            note: "Panel average 4.2/5; hiring manager recommends hire.",
          },
        ],
      },
      {
        id: "app_8511",
        requisitionId: "req_120",
        stage: "WITHDRAWN",
        recruiterId: "usr_recruiter_2",
        nextAction: "None — candidate withdrew",
        ownerId: "usr_recruiter_2",
        dueInDays: -40,
        stageChangedDaysAgo: 51,
        appliedDaysAgo: 66,
        version: 5,
        history: [
          { stage: "NEW", daysAgo: 66, by: "usr_recruiter_2" },
          { stage: "SCREENING", daysAgo: 62, by: "usr_recruiter_2" },
          {
            stage: "WITHDRAWN",
            daysAgo: 51,
            by: "usr_recruiter_2",
            note: "Preferred the Production Planning vacancy.",
          },
        ],
      },
    ],
  },
  {
    id: "cand_2233",
    name: "Ayesha Siddika",
    mobile: "+8801521 447 902",
    email: "ayesha.siddika@example.com",
    source: "CV_UPLOAD",
    cvDocument: cv("doc_cv_2233", "ayesha-siddika-cv.pdf", 12),
    createdDaysAgo: 12,
    version: 1,
    applications: [
      {
        id: "app_8832",
        requisitionId: "req_120",
        stage: "SCREENING",
        recruiterId: "usr_recruiter_1",
        nextAction: "Record eligibility assessment",
        ownerId: "usr_recruiter_1",
        dueInDays: -1,
        stageChangedDaysAgo: 5,
        appliedDaysAgo: 12,
        version: 3,
        history: [
          { stage: "NEW", daysAgo: 12, by: "usr_recruiter_1" },
          { stage: "SCREENING", daysAgo: 5, by: "usr_recruiter_1" },
        ],
      },
    ],
  },
  {
    id: "cand_2240",
    name: "Rifat Chowdhury",
    mobile: "+8801733 118 470",
    email: "rifat.chowdhury@example.com",
    source: "HEADHUNTER",
    cvDocument: cv("doc_cv_2240", "rifat-chowdhury-cv.pdf", 24),
    createdDaysAgo: 24,
    version: 2,
    applications: [
      {
        id: "app_8845",
        requisitionId: "req_121",
        stage: "INTERVIEW",
        recruiterId: "usr_recruiter_1",
        nextAction: "Confirm panel availability for Thursday slot",
        ownerId: "usr_recruiter_1",
        dueInDays: 0,
        stageChangedDaysAgo: 3,
        appliedDaysAgo: 24,
        version: 6,
        history: [
          { stage: "NEW", daysAgo: 24, by: "usr_recruiter_1" },
          { stage: "SCREENING", daysAgo: 19, by: "usr_recruiter_1" },
          { stage: "ASSESSMENT", daysAgo: 11, by: "usr_recruiter_1" },
          { stage: "INTERVIEW", daysAgo: 3, by: "usr_recruiter_1" },
        ],
      },
      {
        id: "app_8309",
        requisitionId: "req_090",
        stage: "CLOSED",
        recruiterId: "usr_recruiter_2",
        nextAction: "None — requisition closed unfilled",
        ownerId: "usr_recruiter_2",
        dueInDays: -25,
        stageChangedDaysAgo: 30,
        appliedDaysAgo: 88,
        version: 8,
        history: [
          { stage: "NEW", daysAgo: 88, by: "usr_recruiter_2" },
          { stage: "SCREENING", daysAgo: 84, by: "usr_recruiter_2" },
          { stage: "INTERVIEW", daysAgo: 66, by: "usr_recruiter_2" },
          {
            stage: "CLOSED",
            daysAgo: 30,
            by: "usr_recruiter_2",
            note: "Requisition withdrawn — work absorbed by the MSP contract.",
          },
        ],
      },
    ],
  },
  {
    id: "cand_2248",
    name: "Sabina Yeasmin",
    mobile: "+8801912 550 318",
    email: "sabina.yeasmin@example.com",
    source: "INTERNAL_POOL",
    cvDocument: cv("doc_cv_2248", "sabina-yeasmin-cv.pdf", 38),
    createdDaysAgo: 38,
    version: 4,
    applications: [
      {
        id: "app_8851",
        requisitionId: "req_117",
        stage: "SELECTED",
        recruiterId: "usr_recruiter_1",
        nextAction: "Send offer message for approval",
        ownerId: "usr_recruiter_1",
        dueInDays: 0,
        stageChangedDaysAgo: 2,
        appliedDaysAgo: 38,
        version: 15,
        history: [
          { stage: "NEW", daysAgo: 38, by: "usr_recruiter_1" },
          { stage: "SCREENING", daysAgo: 35, by: "usr_recruiter_1" },
          { stage: "ASSESSMENT", daysAgo: 29, by: "usr_recruiter_1" },
          { stage: "INTERVIEW", daysAgo: 18, by: "usr_recruiter_1" },
          { stage: "FEEDBACK_PENDING", daysAgo: 12, by: "usr_recruiter_1" },
          { stage: "APPROVAL", daysAgo: 7, by: "usr_recruiter_1" },
          {
            stage: "SELECTED",
            daysAgo: 2,
            by: "usr_hm_2",
            note: "Approved by HR Head and Finance Director.",
          },
        ],
      },
    ],
  },
  {
    id: "cand_2190",
    name: "Imran Kabir",
    mobile: "+8801677 903 145",
    email: "imran.kabir@example.com",
    source: "RECRUITMENT_EVENT",
    cvDocument: cv("doc_cv_2190", "imran-kabir-cv.pdf", 70),
    createdDaysAgo: 70,
    version: 5,
    applications: [
      {
        id: "app_8802",
        requisitionId: "req_105",
        stage: "JOINING",
        recruiterId: "usr_recruiter_1",
        nextAction: "Collect NID copy and academic certificates",
        ownerId: "usr_recruiter_1",
        dueInDays: 0,
        stageChangedDaysAgo: 4,
        appliedDaysAgo: 70,
        version: 21,
        history: [
          { stage: "NEW", daysAgo: 70, by: "usr_recruiter_2" },
          { stage: "SCREENING", daysAgo: 66, by: "usr_recruiter_2" },
          { stage: "ASSESSMENT", daysAgo: 58, by: "usr_recruiter_2" },
          { stage: "INTERVIEW", daysAgo: 44, by: "usr_recruiter_1" },
          { stage: "FEEDBACK_PENDING", daysAgo: 36, by: "usr_recruiter_1" },
          { stage: "APPROVAL", daysAgo: 24, by: "usr_recruiter_1" },
          { stage: "SELECTED", daysAgo: 14, by: "usr_hm_1" },
          { stage: "JOINING", daysAgo: 4, by: "usr_recruiter_1" },
        ],
      },
    ],
  },
  {
    id: "cand_2255",
    name: "Nazia Islam",
    mobile: "+8801845 776 021",
    email: "nazia.islam@example.com",
    source: "MANUAL_ENTRY",
    cvDocument: null,
    createdDaysAgo: 4,
    version: 1,
    applications: [
      {
        id: "app_8860",
        requisitionId: "req_123",
        stage: "NEW",
        recruiterId: "usr_recruiter_1",
        nextAction: "Review CV against requisition criteria",
        ownerId: "usr_recruiter_1",
        dueInDays: 2,
        stageChangedDaysAgo: 4,
        appliedDaysAgo: 4,
        version: 1,
        history: [{ stage: "NEW", daysAgo: 4, by: "usr_recruiter_1" }],
      },
    ],
  },
  {
    id: "cand_2261",
    name: "Shahriar Alam",
    mobile: "+8801556 330 887",
    email: "shahriar.alam@example.com",
    source: "SPREADSHEET_IMPORT",
    cvDocument: cv("doc_cv_2261", "shahriar-alam-cv.pdf", 29),
    createdDaysAgo: 29,
    version: 2,
    applications: [
      {
        id: "app_8866",
        requisitionId: "req_124",
        stage: "INTERVIEW",
        recruiterId: "usr_recruiter_1",
        nextAction: "Share consolidated interview results with Dept. Head",
        ownerId: "usr_recruiter_1",
        dueInDays: 3,
        stageChangedDaysAgo: 6,
        appliedDaysAgo: 29,
        version: 9,
        history: [
          { stage: "NEW", daysAgo: 29, by: "usr_recruiter_1" },
          { stage: "SCREENING", daysAgo: 25, by: "usr_recruiter_1" },
          { stage: "ASSESSMENT", daysAgo: 16, by: "usr_recruiter_1" },
          { stage: "INTERVIEW", daysAgo: 6, by: "usr_recruiter_1" },
        ],
      },
      {
        id: "app_8871",
        requisitionId: "req_126",
        stage: "ON_HOLD",
        recruiterId: "usr_recruiter_4",
        nextAction: "Re-open once the requisition is approved",
        ownerId: "usr_recruiter_4",
        dueInDays: 9,
        stageChangedDaysAgo: 3,
        appliedDaysAgo: 15,
        version: 4,
        history: [
          { stage: "NEW", daysAgo: 15, by: "usr_recruiter_4" },
          { stage: "SCREENING", daysAgo: 10, by: "usr_recruiter_4" },
          {
            stage: "ON_HOLD",
            daysAgo: 3,
            by: "usr_recruiter_4",
            note: "Requisition still awaiting Plant Director sign-off.",
          },
        ],
      },
    ],
  },
  {
    id: "cand_2268",
    name: "Tahmina Akhter",
    mobile: "+8801726 041 559",
    email: "tahmina.akhter@example.com",
    source: "REFERRAL",
    cvDocument: cv("doc_cv_2268", "tahmina-akhter-cv.pdf", 92),
    createdDaysAgo: 92,
    version: 6,
    applications: [
      {
        id: "app_8705",
        requisitionId: "req_105",
        stage: "JOINED",
        recruiterId: "usr_recruiter_2",
        nextAction: "None — joining completed",
        ownerId: "usr_recruiter_2",
        dueInDays: -12,
        stageChangedDaysAgo: 12,
        appliedDaysAgo: 92,
        version: 26,
        history: [
          { stage: "NEW", daysAgo: 92, by: "usr_recruiter_2" },
          { stage: "SCREENING", daysAgo: 88, by: "usr_recruiter_2" },
          { stage: "ASSESSMENT", daysAgo: 80, by: "usr_recruiter_2" },
          { stage: "INTERVIEW", daysAgo: 66, by: "usr_recruiter_2" },
          { stage: "FEEDBACK_PENDING", daysAgo: 58, by: "usr_recruiter_2" },
          { stage: "APPROVAL", daysAgo: 46, by: "usr_recruiter_2" },
          { stage: "SELECTED", daysAgo: 35, by: "usr_hm_1" },
          { stage: "JOINING", daysAgo: 26, by: "usr_recruiter_2" },
          {
            stage: "JOINED",
            daysAgo: 12,
            by: "usr_recruiter_2",
            note: "Reported to the Gazipur unit; ID card and induction done.",
          },
        ],
      },
    ],
  },
  {
    id: "cand_2272",
    name: "Jubayer Ahmed",
    mobile: "+8801988 214 630",
    email: "jubayer.ahmed@example.com",
    source: "JOB_PORTAL",
    cvDocument: cv("doc_cv_2272", "jubayer-ahmed-cv.pdf", 17),
    createdDaysAgo: 17,
    version: 1,
    applications: [
      {
        id: "app_8874",
        requisitionId: "req_121",
        stage: "ASSESSMENT",
        recruiterId: "usr_recruiter_2",
        nextAction: "Record paper-assessment result",
        ownerId: "usr_recruiter_2",
        dueInDays: 5,
        stageChangedDaysAgo: 2,
        appliedDaysAgo: 17,
        version: 4,
        history: [
          { stage: "NEW", daysAgo: 17, by: "usr_recruiter_2" },
          { stage: "SCREENING", daysAgo: 12, by: "usr_recruiter_2" },
          { stage: "ASSESSMENT", daysAgo: 2, by: "usr_recruiter_2" },
        ],
      },
    ],
  },
];

function hydrateApplication(
  seed: ApplicationSeed,
  candidate: CandidateSeed,
): ApplicationSummary {
  const requisition = getMockRequisition(seed.requisitionId);
  return {
    id: seed.id,
    candidateId: candidate.id,
    candidateName: candidate.name,
    requisitionId: seed.requisitionId,
    requisitionRef: requisition?.ref ?? seed.requisitionId,
    requisitionTitle: requisition?.position ?? "—",
    stage: seed.stage,
    assignedRecruiter: personById(seed.recruiterId),
    nextAction: seed.nextAction,
    actionOwner: personById(seed.ownerId),
    dueDate: daysFromNow(seed.dueInDays),
    stageChangedAt: timestampDaysAgo(seed.stageChangedDaysAgo),
    appliedAt: timestampDaysAgo(seed.appliedDaysAgo),
    version: seed.version,
  };
}

function hydrateCandidate(seed: CandidateSeed): CandidateWithApplications {
  return {
    id: seed.id,
    name: seed.name,
    mobile: seed.mobile,
    email: seed.email,
    source: seed.source,
    cvDocument: seed.cvDocument,
    createdAt: timestampDaysAgo(seed.createdDaysAgo),
    version: seed.version,
    applications: seed.applications.map((application) =>
      hydrateApplication(application, seed),
    ),
  };
}

export function getMockCandidates(): CandidateWithApplications[] {
  return SEEDS.map(hydrateCandidate);
}

export function getMockCandidate(id: string): CandidateWithApplications | null {
  const seed = SEEDS.find((candidate) => candidate.id === id);
  return seed ? hydrateCandidate(seed) : null;
}

/** Every application across every candidate — used by the requisition detail
 *  view to list the pipeline for one requisition. */
export function getMockApplications(): ApplicationSummary[] {
  return SEEDS.flatMap((candidate) =>
    candidate.applications.map((application) =>
      hydrateApplication(application, candidate),
    ),
  );
}

export function getMockApplicationsForRequisition(
  requisitionId: string,
): ApplicationSummary[] {
  return getMockApplications().filter(
    (application) => application.requisitionId === requisitionId,
  );
}

/** Append-only transition log for one application (spec Sec 5). */
export function getMockStageHistory(applicationId: string): StageHistoryEntry[] {
  const candidate = SEEDS.find((seed) =>
    seed.applications.some((application) => application.id === applicationId),
  );
  const application = candidate?.applications.find(
    (entry) => entry.id === applicationId,
  );
  if (!application) return [];

  return application.history.map((entry, index) => ({
    id: `${applicationId}_sh_${index}`,
    applicationId,
    fromStage: index === 0 ? null : application.history[index - 1].stage,
    toStage: entry.stage,
    changedBy: personById(entry.by),
    changedAt: timestampDaysAgo(entry.daysAgo),
    note: entry.note,
  }));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Duplicate-candidate check
 * ────────────────────────────────────────────────────────────────────────── */

function normaliseMobile(value: string): string {
  return value.replace(/[^\d]/g, "").replace(/^0+/, "");
}

/**
 * Stand-in for the backend's exact-match dedup check (spec Sec 4,
 * "Duplicate-candidate warnings"; fuzzy matching is explicitly out of scope
 * per BUILD_PLAN.md).
 *
 * TODO(backend): replace the body of this function with
 *   GET /api/v1/candidates/dedup-check?email=&mobile=
 * returning `DuplicateMatch[]`. The signature and return type are already the
 * intended contract — `components/candidates/CandidateForm.tsx` calls this
 * behind a 400ms debounce and renders whatever comes back, so only this
 * function changes. Matching must stay server-side: it reads candidates the
 * requesting recruiter may not otherwise be able to list.
 *
 * Demo trigger: type `farhana.rahman@example.com` (or any other seeded email
 * above) into the new-candidate form's email field.
 */
export function findMockDuplicates(params: {
  email: string;
  mobile: string;
}): DuplicateMatch[] {
  const email = params.email.trim().toLowerCase();
  const mobile = normaliseMobile(params.mobile);

  return SEEDS.flatMap((seed) => {
    const matchedOn: Array<"email" | "mobile"> = [];
    if (email && seed.email.toLowerCase() === email) matchedOn.push("email");
    if (mobile && normaliseMobile(seed.mobile) === mobile) {
      matchedOn.push("mobile");
    }
    if (matchedOn.length === 0) return [];

    return [
      {
        candidateId: seed.id,
        name: seed.name,
        email: seed.email,
        mobile: seed.mobile,
        matchedOn,
        applicationCount: seed.applications.length,
      },
    ];
  });
}
