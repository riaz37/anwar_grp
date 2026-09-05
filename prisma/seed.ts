import { PrismaClient, Role, ProjectStage, ProjectHealth, TaskStatus, MilestoneStatus, DelayReasonCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { STAGE_GATE_TEMPLATES } from "../lib/stage-gate-templates";

const prisma = new PrismaClient();

const SEED_PASSWORD = "ProjectFlow!2026";
const DAY = 24 * 60 * 60 * 1000;
const now = new Date();

const STAGE_ORDER: ProjectStage[] = [
  "IDEA",
  "DISCOVERY",
  "REQUIREMENTS_DESIGN",
  "APPROVAL",
  "DEVELOPMENT",
  "INTERNAL_TESTING",
  "BUSINESS_TESTING_UAT",
  "DEPLOYMENT",
  "STABILIZATION",
  "COMPLETED",
];

const addDays = (n: number) => new Date(now.getTime() + n * DAY);

// ---------------------------------------------------------------------------
// Org structure — a diversified conglomerate: several operating business
// units plus a central AI/IT function that executes projects on their
// behalf. Mirrors how the assignment's roles actually work in a real
// company (a business unit requests, the central team builds).
// ---------------------------------------------------------------------------

type BuKey = "cement" | "steel" | "ceramics" | "realestate" | "corporate";

const BUSINESS_UNITS: Record<
  BuKey,
  { name: string; departments: Record<string, string> }
> = {
  cement: {
    name: "Anwar Cement Ltd.",
    departments: { plant: "Plant Operations", sales: "Sales & Distribution" },
  },
  steel: {
    name: "Anwar Ispat Ltd.",
    departments: { production: "Production", qa: "Quality Assurance" },
  },
  ceramics: {
    name: "Bengal Fine Ceramics",
    departments: { design: "Product Design", retail: "Retail Operations" },
  },
  realestate: {
    name: "Anwar Group Real Estate",
    departments: { projectdev: "Project Development", crm: "Sales & CRM" },
  },
  corporate: {
    name: "Corporate IT & Digital Transformation",
    departments: {
      ai: "AI & Digital Transformation",
      it: "Enterprise IT",
      data: "Data & Analytics",
    },
  },
};

interface SeedUser {
  email: string;
  name: string;
  role: Role;
  bu: BuKey;
  dept: string;
}

const USERS: SeedUser[] = [
  { email: "management@anwargroup.test", name: "Anwar Chowdhury", role: "MANAGEMENT", bu: "corporate", dept: "ai" },
  { email: "md@anwargroup.test", name: "Golam Mostofa", role: "MANAGEMENT", bu: "corporate", dept: "it" },
  { email: "teamlead@anwargroup.test", name: "Farzana Rahman", role: "AI_TEAM_LEAD", bu: "corporate", dept: "ai" },
  { email: "teamlead2@anwargroup.test", name: "Imran Kabir", role: "AI_TEAM_LEAD", bu: "corporate", dept: "data" },
  { email: "analyst@anwargroup.test", name: "Nusrat Jahan", role: "AI_ANALYST", bu: "corporate", dept: "ai" },
  { email: "analyst2@anwargroup.test", name: "Shanto Das", role: "AI_ANALYST", bu: "corporate", dept: "ai" },
  { email: "analyst3@anwargroup.test", name: "Mehjabin Chowdhury", role: "AI_ANALYST", bu: "corporate", dept: "data" },
  { email: "developer@anwargroup.test", name: "Tanvir Ahmed", role: "DEVELOPER", bu: "corporate", dept: "ai" },
  { email: "developer2@anwargroup.test", name: "Rakibul Islam", role: "DEVELOPER", bu: "corporate", dept: "ai" },
  { email: "developer3@anwargroup.test", name: "Sabbir Hossain", role: "DEVELOPER", bu: "corporate", dept: "it" },
  { email: "developer4@anwargroup.test", name: "Proma Akter", role: "DEVELOPER", bu: "corporate", dept: "data" },
  { email: "owner@anwargroup.test", name: "Kamrul Hasan", role: "BUSINESS_OWNER", bu: "cement", dept: "plant" },
  { email: "owner.cement2@anwargroup.test", name: "Shirin Sultana", role: "BUSINESS_OWNER", bu: "cement", dept: "sales" },
  { email: "owner.steel@anwargroup.test", name: "Habibur Rahman", role: "BUSINESS_OWNER", bu: "steel", dept: "production" },
  { email: "owner.steel2@anwargroup.test", name: "Nasima Begum", role: "BUSINESS_OWNER", bu: "steel", dept: "qa" },
  { email: "owner.ceramics@anwargroup.test", name: "Zahid Iqbal", role: "BUSINESS_OWNER", bu: "ceramics", dept: "design" },
  { email: "owner.ceramics2@anwargroup.test", name: "Farhana Yasmin", role: "BUSINESS_OWNER", bu: "ceramics", dept: "retail" },
  { email: "owner.realestate@anwargroup.test", name: "Mahbub Alam", role: "BUSINESS_OWNER", bu: "realestate", dept: "projectdev" },
  { email: "owner.realestate2@anwargroup.test", name: "Sultana Kamal", role: "BUSINESS_OWNER", bu: "realestate", dept: "crm" },
];

// ---------------------------------------------------------------------------
// Project specs. `stage` is where the project sits today; `started`/`arrived`
// (days ago) bookend its stage-history trail. Milestones/tasks/blockers use
// day offsets from `now` (negative = past/overdue). Health is computed from
// this data, never hardcoded, so it always matches what's on screen.
// ---------------------------------------------------------------------------

interface MilestoneSpec {
  name: string;
  owner: string;
  dueOffset: number;
  status: MilestoneStatus;
  completedOffset?: number;
}

interface TaskSpec {
  action: string;
  owner: string;
  deadlineOffset?: number;
  status: TaskStatus;
  milestoneIndex?: number;
}

interface BlockerSpec {
  description: string;
  impact: string;
  requiredAction?: string;
  raisedBy: string;
  resolvedOffset?: number;
  resolvedBy?: string;
  resolutionNotes?: string;
}

interface ScopeChangeSpec {
  reason: string;
  deliveryImpact?: string;
  requestedBy: string;
}

interface DelayReasonSpec {
  milestoneIndex: number;
  category: DelayReasonCategory;
  note: string;
  recordedBy: string;
}

interface ProjectSpec {
  name: string;
  bu: BuKey;
  dept: string;
  businessProblem: string;
  expectedOutcome: string;
  stage: ProjectStage;
  owner: string;
  analyst?: string;
  developer?: string;
  started: number;
  arrived: number;
  deliveryOffset: number;
  checklistProgress?: number;
  nextAction: string;
  nextActionOwner: string;
  nextActionOffset?: number;
  milestones?: MilestoneSpec[];
  tasks?: TaskSpec[];
  blockers?: BlockerSpec[];
  scopeChanges?: ScopeChangeSpec[];
  delayReasons?: DelayReasonSpec[];
}

const A = "analyst@anwargroup.test";
const A2 = "analyst2@anwargroup.test";
const A3 = "analyst3@anwargroup.test";
const D = "developer@anwargroup.test";
const D2 = "developer2@anwargroup.test";
const D3 = "developer3@anwargroup.test";
const D4 = "developer4@anwargroup.test";
const TL = "teamlead@anwargroup.test";
const TL2 = "teamlead2@anwargroup.test";

const PROJECTS: ProjectSpec[] = [
  // --- IDEA -----------------------------------------------------------
  {
    name: "Cement Bag Weight Verification AI",
    bu: "cement", dept: "plant",
    businessProblem: "Bag weight variance at the packing line is caught by manual spot-checks, missing under/over-fill batches.",
    expectedOutcome: "Camera + load-cell fusion model flags out-of-tolerance bags in real time on the packing line.",
    stage: "IDEA", owner: "owner@anwargroup.test", started: 4, arrived: 4, deliveryOffset: 150,
    nextAction: "Schedule idea review with Plant Operations leadership.", nextActionOwner: TL, nextActionOffset: 5,
  },
  {
    name: "Steel Coil Defect Vision Inspection",
    bu: "steel", dept: "production",
    businessProblem: "Surface defects on rolled coils are caught downstream by customers, after shipment.",
    expectedOutcome: "Line-mounted vision system flags surface defects before coiling, cutting customer returns.",
    stage: "IDEA", owner: "owner.steel@anwargroup.test", started: 6, arrived: 6, deliveryOffset: 160,
    nextAction: "Gather sample defect images from the last 6 months for feasibility review.", nextActionOwner: A2, nextActionOffset: 7,
  },
  {
    name: "Ceramics Tile Design Recommender",
    bu: "ceramics", dept: "design",
    businessProblem: "Showroom designers manually browse the catalogue to match customer room photos to tile lines.",
    expectedOutcome: "Upload a room photo, get ranked tile-line recommendations by style and colour palette.",
    stage: "IDEA", owner: "owner.ceramics@anwargroup.test", started: 2, arrived: 2, deliveryOffset: 140,
    nextAction: "Confirm catalogue image rights and licensing for training data.", nextActionOwner: TL2, nextActionOffset: 6,
  },
  {
    name: "Site Visit Scheduling Assistant",
    bu: "realestate", dept: "crm",
    businessProblem: "Sales reps double-book site visits across projects, causing customer no-shows.",
    expectedOutcome: "Assistant proposes conflict-free visit slots and confirms via SMS automatically.",
    stage: "IDEA", owner: "owner.realestate2@anwargroup.test", started: 3, arrived: 3, deliveryOffset: 120,
    nextAction: "Interview 3 sales reps on current booking workflow.", nextActionOwner: A3, nextActionOffset: 8,
  },

  // --- DISCOVERY --------------------------------------------------------
  {
    name: "Predictive Maintenance for Kiln Sensors",
    bu: "cement", dept: "plant",
    businessProblem: "Unplanned kiln shutdowns cost roughly 14 hours of downtime per incident.",
    expectedOutcome: "Sensor-driven model predicts bearing/motor failure 48h ahead, cutting unplanned downtime.",
    stage: "DISCOVERY", owner: "owner@anwargroup.test", analyst: A, started: 22, arrived: 8, deliveryOffset: 130,
    nextAction: "Map current sensor coverage against required telemetry.", nextActionOwner: A, nextActionOffset: 4,
    milestones: [{ name: "Discovery workshop with plant engineers", owner: A, dueOffset: 3, status: "PENDING" }],
  },
  {
    name: "Steel Scrap Yield Forecasting",
    bu: "steel", dept: "qa",
    businessProblem: "Scrap yield per melt varies 8-15% with no leading indicator, complicating procurement.",
    expectedOutcome: "Forecast model predicts scrap yield per charge mix, tightening procurement planning.",
    stage: "DISCOVERY", owner: "owner.steel2@anwargroup.test", analyst: A3, started: 18, arrived: 6, deliveryOffset: 110,
    nextAction: "Pull 24 months of charge-mix and yield history from the plant MIS.", nextActionOwner: A3, nextActionOffset: 3,
    milestones: [{ name: "Discovery workshop with melt shop team", owner: A3, dueOffset: 5, status: "PENDING" }],
  },
  {
    name: "Employee Helpdesk Copilot",
    bu: "corporate", dept: "it",
    businessProblem: "IT helpdesk tickets take an average of 6 hours to triage before reaching the right specialist.",
    expectedOutcome: "An LLM-assisted triage bot classifies and routes 60% of tickets automatically.",
    stage: "DISCOVERY", owner: TL, analyst: A2, started: 15, arrived: 5, deliveryOffset: 100,
    nextAction: "Shadow the helpdesk team for a week to log ticket categories.", nextActionOwner: A2, nextActionOffset: 2,
    milestones: [{ name: "Discovery workshop with IT support team", owner: A2, dueOffset: 2, status: "PENDING" }],
  },

  // --- REQUIREMENTS_DESIGN ----------------------------------------------
  {
    name: "Dealer Credit Risk Scoring",
    bu: "cement", dept: "sales",
    businessProblem: "Dealer credit limits are set on tenure alone, with no payment-behaviour signal.",
    expectedOutcome: "Risk score blends payment history and order volume to recommend dynamic credit limits.",
    stage: "REQUIREMENTS_DESIGN", owner: "owner.cement2@anwargroup.test", analyst: A, started: 35, arrived: 10, deliveryOffset: 95,
    checklistProgress: 0.5,
    nextAction: "Finalize scoring feature list with Finance and Sales.", nextActionOwner: A, nextActionOffset: 4,
    milestones: [{ name: "Requirements sign-off", owner: A, dueOffset: 6, status: "PENDING" }],
  },
  {
    name: "Showroom Footfall Analytics",
    bu: "ceramics", dept: "retail",
    businessProblem: "Showroom conversion rate is unknown — no count of visitors vs. purchases.",
    expectedOutcome: "Entry-camera counting with POS integration gives per-showroom conversion dashboards.",
    stage: "REQUIREMENTS_DESIGN", owner: "owner.ceramics2@anwargroup.test", analyst: A2, started: 30, arrived: 9, deliveryOffset: 85,
    checklistProgress: 0.75,
    nextAction: "Confirm camera placement and privacy signage across 5 pilot showrooms.", nextActionOwner: A2, nextActionOffset: 5,
    milestones: [{ name: "Solution design review", owner: A2, dueOffset: 4, status: "PENDING" }],
  },
  {
    name: "Construction Progress Photo Auditor",
    bu: "realestate", dept: "projectdev",
    businessProblem: "Weekly site-progress reports rely on manual photo review against the construction schedule.",
    expectedOutcome: "Vision model compares site photos to schedule milestones and flags slippage automatically.",
    stage: "REQUIREMENTS_DESIGN", owner: "owner.realestate@anwargroup.test", analyst: A3, started: 28, arrived: 7, deliveryOffset: 105,
    checklistProgress: 0.25,
    nextAction: "Collect 12 months of labeled site-photo archives from 3 projects.", nextActionOwner: A3, nextActionOffset: 6,
    milestones: [{ name: "Requirements sign-off", owner: A3, dueOffset: 7, status: "PENDING" }],
  },

  // --- APPROVAL -----------------------------------------------------------
  {
    name: "Invoice OCR & 3-Way Match",
    bu: "corporate", dept: "it",
    businessProblem: "AP clerks re-key vendor invoices for 3-way match against PO and GRN, a 2-day cycle.",
    expectedOutcome: "OCR extraction auto-matches invoice, PO and GRN, cutting AP cycle time to same-day.",
    stage: "APPROVAL", owner: "md@anwargroup.test", analyst: A2, developer: D3, started: 45, arrived: 12, deliveryOffset: 80,
    nextAction: "Present business case and budget ask to Management for sign-off.", nextActionOwner: TL, nextActionOffset: 3,
  },
  {
    name: "Furnace Energy Optimization Model",
    bu: "steel", dept: "production",
    businessProblem: "Furnace energy consumption per tonne varies 6% shift-to-shift with no operator guidance.",
    expectedOutcome: "Model recommends real-time furnace setpoints, targeting a 4% energy reduction per tonne.",
    stage: "APPROVAL", owner: "owner.steel@anwargroup.test", analyst: A3, developer: D4, started: 50, arrived: 14, deliveryOffset: 90,
    nextAction: "Get CapEx sign-off for setpoint-control integration.", nextActionOwner: TL2, nextActionOffset: 5,
  },

  // --- DEVELOPMENT (bulk, mixed health) -----------------------------------
  {
    name: "Claims Intake Automation",
    bu: "corporate", dept: "ai",
    businessProblem: "Claims intake is manual, re-keyed from scanned PDFs, and takes 3 business days to reach an adjuster.",
    expectedOutcome: "OCR + classification pipeline routes 80% of claims to the correct queue within 1 hour of submission.",
    stage: "DEVELOPMENT", owner: TL, analyst: A, developer: D, started: 45, arrived: 20, deliveryOffset: 25,
    checklistProgress: 0.33,
    nextAction: "Wire OCR output into claims-routing rules engine.", nextActionOwner: D, nextActionOffset: 5,
    milestones: [
      { name: "Discovery", owner: A, dueOffset: -35, status: "DONE", completedOffset: -34 },
      { name: "Requirements & Design sign-off", owner: A, dueOffset: -25, status: "DONE", completedOffset: -24 },
      { name: "Core OCR pipeline", owner: D, dueOffset: -2, status: "IN_PROGRESS" },
      { name: "UAT", owner: "owner.cement2@anwargroup.test", dueOffset: 18, status: "PENDING" },
    ],
    tasks: [
      { action: "Wire OCR output into claims-routing rules engine.", owner: D, status: "IN_PROGRESS", milestoneIndex: 2, deadlineOffset: 5 },
      { action: "Confirm UAT participants and schedule with claims department.", owner: A, status: "PENDING", deadlineOffset: 15 },
    ],
    blockers: [
      { description: "Vendor sandbox credentials not provisioned.", impact: "OCR pipeline milestone cannot be started.", requiredAction: "IT to provision sandbox API key from claims vendor portal.", raisedBy: D, resolvedOffset: -1, resolvedBy: TL, resolutionNotes: "Credentials issued; pipeline work resumed." },
    ],
    delayReasons: [{ milestoneIndex: 2, category: "INTEGRATION_DEPENDENCY", note: "Waiting on the claims-vendor OCR API sandbox credentials, requested 3 days ago.", recordedBy: D }],
  },
  {
    name: "Cement Demand Forecasting Engine",
    bu: "cement", dept: "sales",
    businessProblem: "Regional demand forecasts are built from a spreadsheet trend line, missing seasonal swings.",
    expectedOutcome: "SKU-level demand forecast per region feeds production planning 6 weeks out.",
    stage: "DEVELOPMENT", owner: "owner.cement2@anwargroup.test", analyst: A, developer: D2, started: 50, arrived: 18, deliveryOffset: 30,
    checklistProgress: 0.66,
    nextAction: "Backtest forecast model against Q2 actuals.", nextActionOwner: D2, nextActionOffset: 2,
    milestones: [
      { name: "Feature pipeline complete", owner: D2, dueOffset: -8, status: "DONE", completedOffset: -7 },
      { name: "Model backtest vs. Q2 actuals", owner: D2, dueOffset: 2, status: "IN_PROGRESS" },
      { name: "Planning-tool integration", owner: D2, dueOffset: 20, status: "PENDING" },
    ],
    tasks: [{ action: "Backtest forecast model against Q2 actuals.", owner: D2, status: "IN_PROGRESS", milestoneIndex: 1, deadlineOffset: 2 }],
  },
  {
    name: "Steel Quality Defect Classifier",
    bu: "steel", dept: "qa",
    businessProblem: "Ultrasonic test data is reviewed manually by QA technicians, a bottleneck at peak volume.",
    expectedOutcome: "Classifier flags likely-defective coils from ultrasonic scans for technician review.",
    stage: "DEVELOPMENT", owner: "owner.steel2@anwargroup.test", analyst: A3, developer: D4, started: 55, arrived: 22, deliveryOffset: 15,
    checklistProgress: 0.33,
    nextAction: "Escalate labeled-data access with the QA lab.", nextActionOwner: A3, nextActionOffset: 1,
    milestones: [
      { name: "Labeled dataset ready", owner: A3, dueOffset: -5, status: "IN_PROGRESS" },
      { name: "Model v1 trained", owner: D4, dueOffset: 22, status: "PENDING" },
    ],
    tasks: [{ action: "Escalate labeled-data access with the QA lab.", owner: A3, status: "PENDING", deadlineOffset: 1 }],
    blockers: [
      { description: "QA lab has not granted access to the historical ultrasonic scan archive.", impact: "Labeling work cannot start; model training blocked.", requiredAction: "QA lab manager to approve data-sharing request.", raisedBy: A3 },
    ],
  },
  {
    name: "Ceramics Inventory Reorder Bot",
    bu: "ceramics", dept: "retail",
    businessProblem: "Showroom reorders are placed on gut feel, causing frequent stockouts of fast-moving lines.",
    expectedOutcome: "Reorder bot proposes weekly restock quantities per showroom from sales velocity.",
    stage: "DEVELOPMENT", owner: "owner.ceramics2@anwargroup.test", analyst: A2, developer: D, started: 40, arrived: 16, deliveryOffset: 35,
    checklistProgress: 0.66,
    nextAction: "Review week-1 pilot reorder proposals with the retail team.", nextActionOwner: A2, nextActionOffset: 6,
    milestones: [
      { name: "Sales-velocity model trained", owner: D, dueOffset: -6, status: "DONE", completedOffset: -5 },
      { name: "Pilot in 3 showrooms", owner: A2, dueOffset: 10, status: "PENDING" },
    ],
    tasks: [{ action: "Review week-1 pilot reorder proposals with the retail team.", owner: A2, status: "PENDING", deadlineOffset: 6 }],
  },
  {
    name: "Property Lead Scoring Model",
    bu: "realestate", dept: "crm",
    businessProblem: "Sales reps chase leads in the order they arrive, not by likelihood to close.",
    expectedOutcome: "Lead score prioritizes the CRM queue by predicted close probability.",
    stage: "DEVELOPMENT", owner: "owner.realestate2@anwargroup.test", analyst: A3, developer: D3, started: 38, arrived: 14, deliveryOffset: 28,
    checklistProgress: 0.33,
    nextAction: "Ship scoring API to CRM staging environment.", nextActionOwner: D3, nextActionOffset: 8,
    milestones: [
      { name: "Model v1 trained", owner: D3, dueOffset: -4, status: "DONE", completedOffset: -3 },
      { name: "CRM staging integration", owner: D3, dueOffset: 8, status: "IN_PROGRESS" },
    ],
    tasks: [{ action: "Ship scoring API to CRM staging environment.", owner: D3, status: "IN_PROGRESS", milestoneIndex: 1, deadlineOffset: 8 }],
  },
  {
    name: "Contract Clause Extraction Tool",
    bu: "corporate", dept: "ai",
    businessProblem: "Legal reviews vendor contracts clause-by-clause manually, a 3-4 hour task per contract.",
    expectedOutcome: "Tool extracts and flags non-standard clauses for legal review, cutting review time by half.",
    stage: "DEVELOPMENT", owner: "md@anwargroup.test", analyst: A2, developer: D2, started: 42, arrived: 17, deliveryOffset: 22,
    checklistProgress: 0.33,
    nextAction: "Validate clause-extraction accuracy on the standard MSA template.", nextActionOwner: D2, nextActionOffset: 3,
    milestones: [
      { name: "Clause taxonomy finalized", owner: A2, dueOffset: -10, status: "DONE", completedOffset: -9 },
      { name: "Extraction accuracy validation", owner: D2, dueOffset: 3, status: "IN_PROGRESS" },
    ],
    tasks: [{ action: "Validate clause-extraction accuracy on the standard MSA template.", owner: D2, status: "IN_PROGRESS", milestoneIndex: 1, deadlineOffset: 3 }],
    scopeChanges: [{ reason: "Legal requested coverage for NDAs in addition to MSAs.", deliveryImpact: "Adds ~2 weeks for a second clause taxonomy pass.", requestedBy: "md@anwargroup.test" }],
  },

  // --- INTERNAL_TESTING -----------------------------------------------
  {
    name: "Dealer WhatsApp Order Bot",
    bu: "cement", dept: "sales",
    businessProblem: "Dealers call in orders during business hours only, delaying order capture after hours.",
    expectedOutcome: "WhatsApp bot captures and confirms dealer orders around the clock.",
    stage: "INTERNAL_TESTING", owner: "owner@anwargroup.test", analyst: A, developer: D, started: 60, arrived: 10, deliveryOffset: 20,
    nextAction: "Run internal test suite against edge-case order formats.", nextActionOwner: D, nextActionOffset: 4,
    milestones: [
      { name: "Internal test pass", owner: D, dueOffset: 4, status: "IN_PROGRESS" },
      { name: "UAT with pilot dealers", owner: A, dueOffset: 16, status: "PENDING" },
    ],
    tasks: [{ action: "Run internal test suite against edge-case order formats.", owner: D, status: "IN_PROGRESS", milestoneIndex: 0, deadlineOffset: 4 }],
  },
  {
    name: "Warehouse Slotting Optimizer",
    bu: "steel", dept: "production",
    businessProblem: "Finished-goods warehouse slotting is fixed, causing long picker travel for fast movers.",
    expectedOutcome: "Optimizer re-slots inventory weekly by pick frequency, cutting picker travel time.",
    stage: "INTERNAL_TESTING", owner: "owner.steel@anwargroup.test", analyst: A3, developer: D4, started: 65, arrived: 12, deliveryOffset: 10,
    nextAction: "Fix slotting-conflict edge case found in internal test.", nextActionOwner: D4, nextActionOffset: 1,
    milestones: [{ name: "Internal test pass", owner: D4, dueOffset: 1, status: "IN_PROGRESS" }],
    tasks: [{ action: "Fix slotting-conflict edge case found in internal test.", owner: D4, status: "IN_PROGRESS", milestoneIndex: 0, deadlineOffset: 1 }],
  },
  {
    name: "HR Resume Screening Assistant",
    bu: "corporate", dept: "it",
    businessProblem: "HR manually screens 200+ resumes per open role against the job description.",
    expectedOutcome: "Assistant ranks resumes against the JD and surfaces the top 20% for recruiter review.",
    stage: "INTERNAL_TESTING", owner: TL2, analyst: A2, developer: D3, started: 58, arrived: 9, deliveryOffset: 18,
    nextAction: "Bias-check ranking output across a sample of 500 historical resumes.", nextActionOwner: A2, nextActionOffset: 6,
    milestones: [{ name: "Internal test pass", owner: D3, dueOffset: 6, status: "IN_PROGRESS" }],
    tasks: [{ action: "Bias-check ranking output across a sample of 500 historical resumes.", owner: A2, status: "IN_PROGRESS", milestoneIndex: 0, deadlineOffset: 6 }],
  },

  // --- BUSINESS_TESTING_UAT ---------------------------------------------
  {
    name: "Ceramics Price Recommendation Engine",
    bu: "ceramics", dept: "design",
    businessProblem: "Tile-line pricing is set annually, missing demand and input-cost shifts within the year.",
    expectedOutcome: "Engine recommends quarterly price adjustments per tile line from demand and cost signals.",
    stage: "BUSINESS_TESTING_UAT", owner: "owner.ceramics@anwargroup.test", analyst: A2, developer: D, started: 75, arrived: 15, deliveryOffset: 12,
    checklistProgress: 0.5,
    nextAction: "Collect UAT feedback from the pricing committee.", nextActionOwner: A2, nextActionOffset: 5,
    milestones: [{ name: "UAT sign-off", owner: A2, dueOffset: 5, status: "IN_PROGRESS" }],
    tasks: [{ action: "Collect UAT feedback from the pricing committee.", owner: A2, status: "IN_PROGRESS", milestoneIndex: 0, deadlineOffset: 5 }],
  },
  {
    name: "Site Safety Incident Classifier",
    bu: "realestate", dept: "projectdev",
    businessProblem: "Safety incident reports are logged as free text, making trend analysis nearly impossible.",
    expectedOutcome: "Classifier tags incident reports by category and severity for trend dashboards.",
    stage: "BUSINESS_TESTING_UAT", owner: "owner.realestate@anwargroup.test", analyst: A3, developer: D3, started: 80, arrived: 20, deliveryOffset: 8,
    checklistProgress: 0.25,
    nextAction: "Resolve UAT feedback on severity-tagging accuracy.", nextActionOwner: D3, nextActionOffset: 3,
    milestones: [{ name: "UAT sign-off", owner: A3, dueOffset: -3, status: "IN_PROGRESS" }],
    tasks: [{ action: "Resolve UAT feedback on severity-tagging accuracy.", owner: D3, status: "IN_PROGRESS", milestoneIndex: 0, deadlineOffset: 3 }],
    delayReasons: [{ milestoneIndex: 0, category: "TESTING_ISSUE", note: "Severity tagging disagreed with site supervisors on 30% of sampled reports; model needs a retraining pass before sign-off.", recordedBy: D3 }],
  },

  // --- DEPLOYMENT -------------------------------------------------------
  {
    name: "Procurement Spend Analytics Dashboard",
    bu: "corporate", dept: "data",
    businessProblem: "Group-wide procurement spend is only visible in a quarterly manual rollup.",
    expectedOutcome: "Live dashboard tracks spend by category and vendor across all business units.",
    stage: "DEPLOYMENT", owner: "md@anwargroup.test", analyst: A3, developer: D4, started: 90, arrived: 8, deliveryOffset: 6,
    nextAction: "Cut over production data feed and monitor for a week.", nextActionOwner: D4, nextActionOffset: 3,
    milestones: [{ name: "Production cutover", owner: D4, dueOffset: 3, status: "IN_PROGRESS" }],
    tasks: [{ action: "Cut over production data feed and monitor for a week.", owner: D4, status: "IN_PROGRESS", milestoneIndex: 0, deadlineOffset: 3 }],
  },
  {
    name: "Cement Truck Route Optimizer",
    bu: "cement", dept: "plant",
    businessProblem: "Delivery routes are planned manually each morning, missing distance-saving combinations.",
    expectedOutcome: "Optimizer plans daily delivery routes, targeting a 10% reduction in fleet distance.",
    stage: "DEPLOYMENT", owner: "owner@anwargroup.test", analyst: A, developer: D2, started: 95, arrived: 10, deliveryOffset: 9,
    nextAction: "Train dispatch team on the new route-planning console.", nextActionOwner: A, nextActionOffset: 4,
    milestones: [{ name: "Dispatch team training", owner: A, dueOffset: 4, status: "PENDING" }],
    tasks: [{ action: "Train dispatch team on the new route-planning console.", owner: A, status: "PENDING", deadlineOffset: 4 }],
  },

  // --- STABILIZATION ------------------------------------------------------
  {
    name: "Steel Order Backlog Predictor",
    bu: "steel", dept: "qa",
    businessProblem: "Order backlog surprises production planning, forcing reactive overtime scheduling.",
    expectedOutcome: "Predictor forecasts backlog 4 weeks out, feeding proactive capacity planning.",
    stage: "STABILIZATION", owner: "owner.steel2@anwargroup.test", analyst: A3, developer: D4, started: 110, arrived: 12, deliveryOffset: -1,
    nextAction: "Monitor prediction drift against week-1 production actuals.", nextActionOwner: A3, nextActionOffset: 2,
    milestones: [{ name: "2-week stability window", owner: A3, dueOffset: 2, status: "IN_PROGRESS" }],
    tasks: [{ action: "Monitor prediction drift against week-1 production actuals.", owner: A3, status: "IN_PROGRESS", milestoneIndex: 0, deadlineOffset: 2 }],
  },
  {
    name: "Ceramics Customer Churn Model",
    bu: "ceramics", dept: "retail",
    businessProblem: "Repeat-customer attrition is only noticed after a full quarter of falling sales.",
    expectedOutcome: "Model flags at-risk repeat customers monthly for the retail team to re-engage.",
    stage: "STABILIZATION", owner: "owner.ceramics2@anwargroup.test", analyst: A2, developer: D, started: 105, arrived: 14, deliveryOffset: 2,
    nextAction: "Hand off monitoring dashboard to the retail analytics team.", nextActionOwner: A2, nextActionOffset: 5,
    milestones: [{ name: "2-week stability window", owner: A2, dueOffset: 5, status: "IN_PROGRESS" }],
    tasks: [{ action: "Hand off monitoring dashboard to the retail analytics team.", owner: A2, status: "PENDING", deadlineOffset: 5 }],
  },

  // --- COMPLETED ----------------------------------------------------------
  {
    name: "Internal Helpdesk Copilot Pilot",
    bu: "corporate", dept: "ai",
    businessProblem: "IT helpdesk tickets took an average of 6 hours to triage before reaching the right specialist.",
    expectedOutcome: "An LLM-assisted triage bot classifies and routes 60% of tickets automatically.",
    stage: "COMPLETED", owner: TL, analyst: A, developer: D, started: 200, arrived: 40, deliveryOffset: -35,
    nextAction: "Quarterly performance review of routing accuracy.", nextActionOwner: A, nextActionOffset: 60,
    milestones: [
      { name: "Discovery", owner: A, dueOffset: -190, status: "DONE", completedOffset: -188 },
      { name: "UAT sign-off", owner: TL, dueOffset: -60, status: "DONE", completedOffset: -58 },
      { name: "Production rollout", owner: D, dueOffset: -40, status: "DONE", completedOffset: -38 },
    ],
  },
  {
    name: "Real Estate Document Digitization",
    bu: "realestate", dept: "crm",
    businessProblem: "Property title and sale documents were stored as unindexed paper files across site offices.",
    expectedOutcome: "Scanned and OCR-indexed document archive searchable by property and customer.",
    stage: "COMPLETED", owner: "owner.realestate@anwargroup.test", analyst: A3, developer: D3, started: 220, arrived: 45, deliveryOffset: -50,
    nextAction: "Archive project retrospective and close out documentation.", nextActionOwner: A3, nextActionOffset: 90,
    milestones: [
      { name: "Discovery", owner: A3, dueOffset: -210, status: "DONE", completedOffset: -208 },
      { name: "Pilot site rollout", owner: D3, dueOffset: -80, status: "DONE", completedOffset: -78 },
      { name: "All-site rollout", owner: D3, dueOffset: -45, status: "DONE", completedOffset: -43 },
    ],
  },
  {
    name: "Cement Quality Lab Report Automation",
    bu: "cement", dept: "plant",
    businessProblem: "Lab technicians manually typed strength-test results into spreadsheets, delaying batch release.",
    expectedOutcome: "Lab instrument output feeds a structured report automatically, cutting release time.",
    stage: "COMPLETED", owner: "owner@anwargroup.test", analyst: A, developer: D2, started: 180, arrived: 30, deliveryOffset: -25,
    nextAction: "Review 90-day accuracy report with the lab team.", nextActionOwner: A, nextActionOffset: 45,
    milestones: [
      { name: "Discovery", owner: A, dueOffset: -170, status: "DONE", completedOffset: -168 },
      { name: "UAT sign-off", owner: A, dueOffset: -50, status: "DONE", completedOffset: -48 },
      { name: "Production rollout", owner: D2, dueOffset: -30, status: "DONE", completedOffset: -28 },
    ],
  },
  {
    name: "Steel Vendor Onboarding Portal",
    bu: "steel", dept: "production",
    businessProblem: "New vendor onboarding took 3 weeks of email back-and-forth for compliance documents.",
    expectedOutcome: "Self-serve portal cuts vendor onboarding to under a week with automated document checks.",
    stage: "COMPLETED", owner: "owner.steel@anwargroup.test", analyst: A3, developer: D4, started: 190, arrived: 35, deliveryOffset: -30,
    nextAction: "Onboard vendor-relations team as portal administrators.", nextActionOwner: A3, nextActionOffset: 30,
    milestones: [
      { name: "Discovery", owner: A3, dueOffset: -180, status: "DONE", completedOffset: -178 },
      { name: "UAT sign-off", owner: A3, dueOffset: -55, status: "DONE", completedOffset: -53 },
      { name: "Production rollout", owner: D4, dueOffset: -35, status: "DONE", completedOffset: -33 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function stageHistoryDates(stageIndex: number, started: number, arrived: number): Date[] {
  if (stageIndex === 0) return [addDays(-arrived)];
  const dates: Date[] = [];
  for (let i = 0; i <= stageIndex; i++) {
    const daysAgo = started - (i * (started - arrived)) / stageIndex;
    dates.push(addDays(-daysAgo));
  }
  return dates;
}

async function main() {
  // Wipe project-domain + org/auth data so the script is safely re-runnable
  // against a fresh or previously-seeded database. Order respects FKs.
  await prisma.delayReason.deleteMany();
  await prisma.scopeChange.deleteMany();
  await prisma.blocker.deleteMany();
  await prisma.projectTask.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.stageGateChecklistItem.deleteMany();
  await prisma.projectStageHistory.deleteMany();
  await prisma.document.deleteMany();
  await prisma.confidentialDataGrant.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.businessUnit.deleteMany();

  // --- Business units + departments ---
  const buRows: Record<BuKey, { id: string }> = {} as Record<BuKey, { id: string }>;
  const deptRows: Record<string, { id: string }> = {};
  for (const [buKey, bu] of Object.entries(BUSINESS_UNITS) as [BuKey, typeof BUSINESS_UNITS[BuKey]][]) {
    const buRow = await prisma.businessUnit.create({ data: { name: bu.name } });
    buRows[buKey] = buRow;
    for (const [deptKey, deptName] of Object.entries(bu.departments)) {
      const deptRow = await prisma.department.create({
        data: { name: deptName, businessUnitId: buRow.id },
      });
      deptRows[`${buKey}:${deptKey}`] = deptRow;
    }
  }

  // --- Users ---
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const users: Record<string, { id: string }> = {};
  for (const u of USERS) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        businessUnitId: buRows[u.bu].id,
        departmentId: deptRows[`${u.bu}:${u.dept}`].id,
      },
    });
    users[u.email] = user;
  }
  console.log(`Seeded ${USERS.length} users across ${Object.keys(BUSINESS_UNITS).length} business units. Password for all: ${SEED_PASSWORD}`);

  // --- Projects ---
  let docCount = 0;
  let auditCount = 0;

  for (const spec of PROJECTS) {
    const stageIndex = STAGE_ORDER.indexOf(spec.stage);
    const dates = stageHistoryDates(stageIndex, spec.started, spec.arrived);
    const actorId = users[spec.analyst ?? spec.owner].id;

    // Resolve milestone/task specs first so we can compute health before insert.
    const activeBlockers = (spec.blockers ?? []).filter((b) => b.resolvedOffset === undefined);
    const openMilestones = (spec.milestones ?? []).filter((m) => m.status !== "DONE");
    let health: ProjectHealth = "ON_TRACK";
    if (activeBlockers.length > 0) health = "BLOCKED";
    else if (openMilestones.some((m) => m.dueOffset < 0)) health = "DELAYED";
    else if (openMilestones.some((m) => m.dueOffset >= 0 && m.dueOffset <= 3)) health = "AT_RISK";

    const project = await prisma.project.create({
      data: {
        name: spec.name,
        businessUnitId: buRows[spec.bu].id,
        departmentId: deptRows[`${spec.bu}:${spec.dept}`].id,
        businessProblem: spec.businessProblem,
        expectedOutcome: spec.expectedOutcome,
        ownerId: users[spec.owner].id,
        analystId: spec.analyst ? users[spec.analyst].id : null,
        developerId: spec.developer ? users[spec.developer].id : null,
        currentStage: spec.stage,
        health,
        expectedDeliveryDate: addDays(spec.deliveryOffset),
        createdAt: dates[0],
      },
    });

    await prisma.auditLog.create({
      data: { actorId: users[spec.owner].id, action: "PROJECT_CREATED", entityType: "PROJECT", entityId: project.id, createdAt: dates[0] },
    });
    auditCount++;

    // Stage history + audit trail.
    for (let i = 0; i <= stageIndex; i++) {
      await prisma.projectStageHistory.create({
        data: {
          projectId: project.id,
          fromStage: i === 0 ? null : STAGE_ORDER[i - 1],
          toStage: STAGE_ORDER[i],
          actorId,
          changedAt: dates[i],
        },
      });
      await prisma.auditLog.create({
        data: { actorId, action: "PROJECT_STAGE_ADVANCED", entityType: "PROJECT", entityId: project.id, metadata: { toStage: STAGE_ORDER[i] }, createdAt: dates[i] },
      });
      auditCount++;
    }

    // Checklists: prior stages fully checked, current stage per checklistProgress.
    for (let i = 0; i < stageIndex; i++) {
      const template = STAGE_GATE_TEMPLATES[STAGE_ORDER[i]] ?? [];
      if (template.length === 0) continue;
      await prisma.stageGateChecklistItem.createMany({
        data: template.map((item) => ({
          projectId: project.id,
          stage: STAGE_ORDER[i],
          label: item.label,
          required: item.required,
          checked: true,
          checkedById: actorId,
          checkedAt: dates[i + 1] ?? dates[i],
        })),
      });
    }
    const currentTemplate = STAGE_GATE_TEMPLATES[spec.stage] ?? [];
    if (currentTemplate.length > 0) {
      const progress = spec.checklistProgress ?? 0.5;
      const checkedCount = Math.round(currentTemplate.length * progress);
      await prisma.stageGateChecklistItem.createMany({
        data: currentTemplate.map((item, idx) => ({
          projectId: project.id,
          stage: spec.stage,
          label: item.label,
          required: item.required,
          checked: idx < checkedCount,
          checkedById: idx < checkedCount ? actorId : null,
          checkedAt: idx < checkedCount ? now : null,
        })),
      });
    }

    // Milestones.
    const milestoneIds: string[] = [];
    for (const m of spec.milestones ?? []) {
      const milestone = await prisma.milestone.create({
        data: {
          projectId: project.id,
          name: m.name,
          ownerId: users[m.owner].id,
          dueDate: addDays(m.dueOffset),
          status: m.status,
          completedAt: m.status === "DONE" ? addDays(m.completedOffset ?? m.dueOffset) : null,
        },
      });
      milestoneIds.push(milestone.id);
      if (m.status === "DONE") {
        await prisma.auditLog.create({
          data: { actorId: users[m.owner].id, action: "MILESTONE_COMPLETED", entityType: "MILESTONE", entityId: milestone.id, createdAt: addDays(m.completedOffset ?? m.dueOffset) },
        });
        auditCount++;
      }
    }

    // Next-action task (every project gets one) + spec tasks.
    await prisma.projectTask.create({
      data: {
        projectId: project.id,
        action: spec.nextAction,
        ownerId: users[spec.nextActionOwner].id,
        deadline: spec.nextActionOffset !== undefined ? addDays(spec.nextActionOffset) : null,
        status: "PENDING",
      },
    });
    for (const t of spec.tasks ?? []) {
      await prisma.projectTask.create({
        data: {
          projectId: project.id,
          action: t.action,
          ownerId: users[t.owner].id,
          deadline: t.deadlineOffset !== undefined ? addDays(t.deadlineOffset) : null,
          status: t.status,
          relatedMilestoneId: t.milestoneIndex !== undefined ? milestoneIds[t.milestoneIndex] : null,
        },
      });
    }

    // Blockers.
    for (const b of spec.blockers ?? []) {
      const blocker = await prisma.blocker.create({
        data: {
          projectId: project.id,
          description: b.description,
          impact: b.impact,
          requiredAction: b.requiredAction,
          responsiblePersonId: users[b.raisedBy].id,
          raisedById: users[b.raisedBy].id,
          resolvedAt: b.resolvedOffset !== undefined ? addDays(b.resolvedOffset) : null,
          resolvedById: b.resolvedBy ? users[b.resolvedBy].id : null,
          resolutionNotes: b.resolutionNotes,
        },
      });
      await prisma.auditLog.create({
        data: { actorId: users[b.raisedBy].id, action: "BLOCKER_RAISED", entityType: "BLOCKER", entityId: blocker.id },
      });
      auditCount++;
      if (b.resolvedBy) {
        await prisma.auditLog.create({
          data: { actorId: users[b.resolvedBy].id, action: "BLOCKER_RESOLVED", entityType: "BLOCKER", entityId: blocker.id, createdAt: addDays(b.resolvedOffset ?? 0) },
        });
        auditCount++;
      }
    }

    // Scope changes.
    for (const s of spec.scopeChanges ?? []) {
      await prisma.scopeChange.create({
        data: {
          projectId: project.id,
          requestedById: users[s.requestedBy].id,
          reason: s.reason,
          deliveryImpact: s.deliveryImpact,
        },
      });
    }

    // Delay reasons.
    for (const d of spec.delayReasons ?? []) {
      await prisma.delayReason.create({
        data: {
          projectId: project.id,
          milestoneId: milestoneIds[d.milestoneIndex],
          category: d.category,
          note: d.note,
          recordedById: users[d.recordedBy].id,
        },
      });
      await prisma.auditLog.create({
        data: { actorId: users[d.recordedBy].id, action: "DELAY_REASON_RECORDED", entityType: "MILESTONE", entityId: milestoneIds[d.milestoneIndex] },
      });
      auditCount++;
    }

    // Documents: solution design once requirements exist, UAT sign-off once UAT is reached.
    if (stageIndex >= STAGE_ORDER.indexOf("REQUIREMENTS_DESIGN")) {
      docCount++;
      await prisma.document.create({
        data: {
          ownerType: "PROJECT",
          ownerId: project.id,
          storageKey: `seed/${project.id}/solution-design-${docCount}.pdf`,
          fileName: "Solution Design.pdf",
          contentType: "application/pdf",
          sizeBytes: 240_000 + docCount * 1_337,
          uploadedById: actorId,
        },
      });
    }
    if (stageIndex >= STAGE_ORDER.indexOf("BUSINESS_TESTING_UAT")) {
      docCount++;
      await prisma.document.create({
        data: {
          ownerType: "PROJECT",
          ownerId: project.id,
          storageKey: `seed/${project.id}/uat-signoff-${docCount}.pdf`,
          fileName: "UAT Sign-off.pdf",
          contentType: "application/pdf",
          sizeBytes: 95_000 + docCount * 821,
          uploadedById: users[spec.owner].id,
        },
      });
    }
  }

  console.log(`Seeded ${PROJECTS.length} projects spanning all 10 stages, ${docCount} documents, ${auditCount} audit log entries.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
