import type { Requisition } from "@/lib/types/domain";
import { orgUnitById, personById } from "./_mock-reference";

/**
 * TEMPORARY mock data for the Requisitions list + detail views.
 *
 * Same convention as `_mock-tasks.ts`. The returned shape is already the
 * API-facing `Requisition` contract from `lib/types/domain.ts`, so nothing
 * downstream changes when this is replaced.
 *
 * SWAP POINTS
 *   app/(dashboard)/requisitions/page.tsx
 *     const requisitions = getMockRequisitions();
 *       -> const requisitions = await fetchRequisitions(searchParams);
 *          // GET /api/v1/requisitions?status=&businessUnitId=&recruiterId=&q=
 *
 *   app/(dashboard)/requisitions/[id]/page.tsx
 *     const requisition = getMockRequisition(id);
 *       -> const requisition = await fetchRequisition(id);
 *          // GET /api/v1/requisitions/{id}
 *
 * Dates are generated relative to today so "target joining in 12 days" style
 * reading stays realistic in a demo.
 */

function daysFromNow(offset: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function timestampDaysAgo(offset: number): string {
  const date = new Date();
  date.setUTCHours(9, 30, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
}

type Seed = Omit<
  Requisition,
  | "businessUnit"
  | "department"
  | "hiringManager"
  | "assignedRecruiter"
  | "targetJoiningDate"
  | "createdAt"
  | "updatedAt"
> & {
  businessUnitId: string;
  departmentId: string;
  hiringManagerId: string;
  assignedRecruiterId: string;
  targetJoiningInDays: number;
  createdDaysAgo?: number;
  updatedDaysAgo?: number;
};

const SEEDS: readonly Seed[] = [
  {
    id: "req_114",
    ref: "REQ-2026-114",
    businessUnitId: "bu_textiles",
    departmentId: "dep_merch",
    position: "Senior Merchandiser",
    vacancyCount: 2,
    positionLevel: "SENIOR",
    hiringManagerId: "usr_hm_1",
    assignedRecruiterId: "usr_recruiter_1",
    targetJoiningInDays: 26,
    approvalStatus: "OPEN",
    erfRrfDocument: {
      id: "doc_erf_114",
      fileName: "ERF-2026-114-senior-merchandiser.pdf",
      contentType: "application/pdf",
      sizeBytes: 284_113,
      uploadedAt: timestampDaysAgo(34),
      uploadedBy: "Kamrul Hasan",
    },
    notes:
      "Replacement for two resignations in the woven division. Buyer-facing role — English fluency is a hard requirement.",
    version: 7,
  },
  {
    id: "req_098",
    ref: "REQ-2026-098",
    businessUnitId: "bu_textiles",
    departmentId: "dep_prod",
    position: "Production Planning Officer",
    vacancyCount: 1,
    positionLevel: "MID",
    hiringManagerId: "usr_hm_3",
    assignedRecruiterId: "usr_recruiter_1",
    targetJoiningInDays: 12,
    approvalStatus: "OPEN",
    erfRrfDocument: {
      id: "doc_erf_098",
      fileName: "RRF-2026-098-production-planning.pdf",
      contentType: "application/pdf",
      sizeBytes: 197_402,
      uploadedAt: timestampDaysAgo(58),
      uploadedBy: "Abdullah Al Mamun",
    },
    version: 12,
  },
  {
    id: "req_120",
    ref: "REQ-2026-120",
    businessUnitId: "bu_corp",
    departmentId: "dep_finance",
    position: "Accounts Executive",
    vacancyCount: 3,
    positionLevel: "JUNIOR",
    hiringManagerId: "usr_hm_2",
    assignedRecruiterId: "usr_recruiter_2",
    targetJoiningInDays: 40,
    approvalStatus: "OPEN",
    erfRrfDocument: {
      id: "doc_erf_120",
      fileName: "ERF-2026-120-accounts-executive.pdf",
      contentType: "application/pdf",
      sizeBytes: 152_888,
      uploadedAt: timestampDaysAgo(21),
      uploadedBy: "Shirin Sultana",
    },
    version: 4,
  },
  {
    id: "req_121",
    ref: "REQ-2026-121",
    businessUnitId: "bu_corp",
    departmentId: "dep_it",
    position: "IT Support Engineer",
    vacancyCount: 1,
    positionLevel: "MID",
    hiringManagerId: "usr_hm_5",
    assignedRecruiterId: "usr_recruiter_1",
    targetJoiningInDays: 18,
    approvalStatus: "OPEN",
    erfRrfDocument: null,
    notes:
      "ERF signed off verbally by the CTO on 12 Aug — scanned copy still to be attached.",
    version: 3,
  },
  {
    id: "req_117",
    ref: "REQ-2026-117",
    businessUnitId: "bu_corp",
    departmentId: "dep_hr",
    position: "HR Officer — Payroll",
    vacancyCount: 1,
    positionLevel: "MID",
    hiringManagerId: "usr_hm_2",
    assignedRecruiterId: "usr_recruiter_1",
    targetJoiningInDays: 9,
    approvalStatus: "OPEN",
    erfRrfDocument: {
      id: "doc_erf_117",
      fileName: "ERF-2026-117-hr-officer-payroll.pdf",
      contentType: "application/pdf",
      sizeBytes: 176_204,
      uploadedAt: timestampDaysAgo(41),
      uploadedBy: "Shirin Sultana",
    },
    version: 9,
  },
  {
    id: "req_123",
    ref: "REQ-2026-123",
    businessUnitId: "bu_textiles",
    departmentId: "dep_design",
    position: "Textile Design Assistant",
    vacancyCount: 2,
    positionLevel: "ENTRY",
    hiringManagerId: "usr_hm_4",
    assignedRecruiterId: "usr_recruiter_3",
    targetJoiningInDays: 55,
    approvalStatus: "APPROVED",
    erfRrfDocument: {
      id: "doc_erf_123",
      fileName: "ERF-2026-123-design-assistant.pdf",
      contentType: "application/pdf",
      sizeBytes: 131_770,
      uploadedAt: timestampDaysAgo(9),
      uploadedBy: "Nusrat Jahan",
    },
    version: 2,
  },
  {
    id: "req_124",
    ref: "REQ-2026-124",
    businessUnitId: "bu_cement",
    departmentId: "dep_logistics",
    position: "Logistics Coordinator",
    vacancyCount: 1,
    positionLevel: "MID",
    hiringManagerId: "usr_hm_3",
    assignedRecruiterId: "usr_recruiter_1",
    targetJoiningInDays: 33,
    approvalStatus: "OPEN",
    erfRrfDocument: {
      id: "doc_erf_124",
      fileName: "RRF-2026-124-logistics-coordinator.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 62_119,
      uploadedAt: timestampDaysAgo(14),
      uploadedBy: "Abdullah Al Mamun",
    },
    version: 5,
  },
  {
    id: "req_105",
    ref: "REQ-2026-105",
    businessUnitId: "bu_textiles",
    departmentId: "dep_quality",
    position: "Quality Control Inspector",
    vacancyCount: 4,
    positionLevel: "ENTRY",
    hiringManagerId: "usr_hm_1",
    assignedRecruiterId: "usr_recruiter_2",
    targetJoiningInDays: 6,
    approvalStatus: "FILLED",
    erfRrfDocument: {
      id: "doc_erf_105",
      fileName: "ERF-2026-105-qc-inspector.pdf",
      contentType: "application/pdf",
      sizeBytes: 210_559,
      uploadedAt: timestampDaysAgo(76),
      uploadedBy: "Kamrul Hasan",
    },
    version: 18,
  },
  {
    id: "req_126",
    ref: "REQ-2026-126",
    businessUnitId: "bu_cement",
    departmentId: "dep_plant",
    position: "Shift Engineer — Kiln",
    vacancyCount: 2,
    positionLevel: "SENIOR",
    hiringManagerId: "usr_hm_5",
    assignedRecruiterId: "usr_recruiter_4",
    targetJoiningInDays: 61,
    approvalStatus: "AWAITING_APPROVAL",
    erfRrfDocument: {
      id: "doc_erf_126",
      fileName: "ERF-2026-126-shift-engineer.pdf",
      contentType: "application/pdf",
      sizeBytes: 240_930,
      uploadedAt: timestampDaysAgo(3),
      uploadedBy: "Zahid Iqbal",
    },
    notes: "Waiting on Plant Director sign-off before sourcing starts.",
    version: 1,
  },
  {
    id: "req_127",
    ref: "REQ-2026-127",
    businessUnitId: "bu_landmark",
    departmentId: "dep_sales",
    position: "Sales Executive — Residential",
    vacancyCount: 5,
    positionLevel: "JUNIOR",
    hiringManagerId: "usr_hm_4",
    assignedRecruiterId: "usr_recruiter_3",
    targetJoiningInDays: 74,
    approvalStatus: "DRAFT",
    erfRrfDocument: null,
    version: 1,
  },
  {
    id: "req_112",
    ref: "REQ-2026-112",
    businessUnitId: "bu_landmark",
    departmentId: "dep_sales",
    position: "Property Valuation Analyst",
    vacancyCount: 1,
    positionLevel: "MID",
    hiringManagerId: "usr_hm_4",
    assignedRecruiterId: "usr_recruiter_4",
    targetJoiningInDays: -8,
    approvalStatus: "ON_HOLD",
    erfRrfDocument: {
      id: "doc_erf_112",
      fileName: "ERF-2026-112-valuation-analyst.pdf",
      contentType: "application/pdf",
      sizeBytes: 168_004,
      uploadedAt: timestampDaysAgo(63),
      uploadedBy: "Nusrat Jahan",
    },
    notes: "Paused pending the Q4 headcount review.",
    version: 6,
  },
  {
    id: "req_090",
    ref: "REQ-2026-090",
    businessUnitId: "bu_corp",
    departmentId: "dep_it",
    position: "Network Administrator",
    vacancyCount: 1,
    positionLevel: "SENIOR",
    hiringManagerId: "usr_hm_5",
    assignedRecruiterId: "usr_recruiter_2",
    targetJoiningInDays: -22,
    approvalStatus: "CLOSED",
    erfRrfDocument: null,
    notes: "Closed unfilled — the requirement was absorbed by the MSP contract.",
    version: 11,
  },
];

function hydrate(seed: Seed): Requisition {
  const {
    businessUnitId,
    departmentId,
    hiringManagerId,
    assignedRecruiterId,
    targetJoiningInDays,
    createdDaysAgo,
    updatedDaysAgo,
    ...rest
  } = seed;

  return {
    ...rest,
    businessUnit: orgUnitById(businessUnitId),
    department: orgUnitById(departmentId),
    hiringManager: personById(hiringManagerId),
    assignedRecruiter: personById(assignedRecruiterId),
    targetJoiningDate: daysFromNow(targetJoiningInDays),
    createdAt: timestampDaysAgo(createdDaysAgo ?? 45),
    updatedAt: timestampDaysAgo(updatedDaysAgo ?? 2),
  };
}

export function getMockRequisitions(): Requisition[] {
  return SEEDS.map(hydrate);
}

export function getMockRequisition(id: string): Requisition | null {
  const seed = SEEDS.find((candidate) => candidate.id === id);
  return seed ? hydrate(seed) : null;
}
