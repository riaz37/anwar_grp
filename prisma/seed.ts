import { PrismaClient, Role, ProjectStage } from "@prisma/client";
import bcrypt from "bcryptjs";
import { STAGE_GATE_TEMPLATES } from "../lib/stage-gate-templates";

const prisma = new PrismaClient();

const SEED_BUSINESS_UNIT = "Anwar Group Corporate";
const SEED_DEPARTMENT = "AI & Digital Transformation";
const SEED_PASSWORD = "ProjectFlow!2026";

const SEED_USERS: Array<{
  email: string;
  name: string;
  role: Role;
}> = [
  { email: "analyst@anwargroup.test", name: "Nusrat Jahan", role: "AI_ANALYST" },
  { email: "developer@anwargroup.test", name: "Tanvir Ahmed", role: "DEVELOPER" },
  { email: "owner@anwargroup.test", name: "Kamrul Hasan", role: "BUSINESS_OWNER" },
  { email: "teamlead@anwargroup.test", name: "Farzana Rahman", role: "AI_TEAM_LEAD" },
  { email: "management@anwargroup.test", name: "Anwar Chowdhury", role: "MANAGEMENT" },
];

async function main() {
  const businessUnit = await prisma.businessUnit.upsert({
    where: { name: SEED_BUSINESS_UNIT },
    update: {},
    create: { name: SEED_BUSINESS_UNIT },
  });

  const department = await prisma.department.upsert({
    where: {
      businessUnitId_name: {
        businessUnitId: businessUnit.id,
        name: SEED_DEPARTMENT,
      },
    },
    update: {},
    create: { name: SEED_DEPARTMENT, businessUnitId: businessUnit.id },
  });

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const users: Record<string, { id: string }> = {};
  for (const u of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, name: u.name, role: u.role, isActive: true },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        businessUnitId: businessUnit.id,
        departmentId: department.id,
      },
    });
    users[u.role] = { id: user.id };
  }

  console.log(`Seeded ${SEED_USERS.length} users, password for all: ${SEED_PASSWORD}`);

  // --- Demo project #1: mid-Development, exercising the prototype journey
  // (assignment Sec 12D) — Discovery/Design gates complete, Development
  // in progress with an overdue milestone (delay reason captured) and a
  // resolved blocker already behind it, so a reviewer can see the full
  // shape of the system without driving the whole journey by hand.
  const existingDemo = await prisma.project.findFirst({
    where: { name: "Claims Intake Automation" },
  });

  if (!existingDemo) {
    const project = await prisma.project.create({
      data: {
        name: "Claims Intake Automation",
        businessUnitId: businessUnit.id,
        departmentId: department.id,
        businessProblem:
          "Claims intake is manual, re-keyed from scanned PDFs, and takes 3 business days to reach an adjuster.",
        expectedOutcome:
          "OCR + classification pipeline routes 80% of claims to the correct queue within 1 hour of submission.",
        ownerId: users.AI_TEAM_LEAD.id,
        analystId: users.AI_ANALYST.id,
        developerId: users.DEVELOPER.id,
        currentStage: ProjectStage.DEVELOPMENT,
        expectedDeliveryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      },
    });

    // Stage history: IDEA -> DISCOVERY -> REQUIREMENTS_DESIGN -> APPROVAL -> DEVELOPMENT
    const stageSequence: Array<ProjectStage | null> = [
      null,
      "IDEA",
      "DISCOVERY",
      "REQUIREMENTS_DESIGN",
      "APPROVAL",
      "DEVELOPMENT",
    ];
    for (let i = 1; i < stageSequence.length; i++) {
      await prisma.projectStageHistory.create({
        data: {
          projectId: project.id,
          fromStage: stageSequence[i - 1] as ProjectStage | null,
          toStage: stageSequence[i] as ProjectStage,
          actorId: users.AI_ANALYST.id,
          changedAt: new Date(Date.now() - (stageSequence.length - i) * 4 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Fully-checked gates for the two completed stages, per the fixed
    // exit-criteria template.
    for (const stage of ["DISCOVERY", "REQUIREMENTS_DESIGN"] as const) {
      const template = STAGE_GATE_TEMPLATES[stage] ?? [];
      await prisma.stageGateChecklistItem.createMany({
        data: template.map((item) => ({
          projectId: project.id,
          stage,
          label: item.label,
          required: item.required,
          checked: true,
          checkedById: users.AI_ANALYST.id,
          checkedAt: new Date(),
        })),
      });
    }

    // Current stage (DEVELOPMENT) gate: partially checked.
    const devTemplate = STAGE_GATE_TEMPLATES.DEVELOPMENT ?? [];
    await prisma.stageGateChecklistItem.createMany({
      data: devTemplate.map((item, idx) => ({
        projectId: project.id,
        stage: ProjectStage.DEVELOPMENT,
        label: item.label,
        required: item.required,
        checked: idx === 0,
        checkedById: idx === 0 ? users.DEVELOPER.id : null,
        checkedAt: idx === 0 ? new Date() : null,
      })),
    });

    // Milestones: two done, one overdue (with a delay reason on record),
    // one upcoming.
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Discovery",
        ownerId: users.AI_ANALYST.id,
        dueDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        status: "DONE",
        completedAt: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Requirements & Design sign-off",
        ownerId: users.AI_ANALYST.id,
        dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: "DONE",
        completedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      },
    });
    const overdueMilestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "Core OCR pipeline",
        ownerId: users.DEVELOPER.id,
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: "IN_PROGRESS",
      },
    });
    await prisma.milestone.create({
      data: {
        projectId: project.id,
        name: "UAT",
        ownerId: users.BUSINESS_OWNER.id,
        dueDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
        status: "PENDING",
      },
    });

    await prisma.delayReason.create({
      data: {
        projectId: project.id,
        milestoneId: overdueMilestone.id,
        category: "INTEGRATION_DEPENDENCY",
        note: "Waiting on the claims-vendor OCR API sandbox credentials, requested 3 days ago.",
        recordedById: users.DEVELOPER.id,
      },
    });

    // A resolved blocker (already dealt with) and a fresh unresolved one.
    await prisma.blocker.create({
      data: {
        projectId: project.id,
        description: "Vendor sandbox credentials not provisioned.",
        impact: "OCR pipeline milestone cannot be started.",
        requiredAction: "IT to provision sandbox API key from claims vendor portal.",
        raisedById: users.DEVELOPER.id,
        resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        resolvedById: users.AI_TEAM_LEAD.id,
        resolutionNotes: "Credentials issued; pipeline work resumed.",
      },
    });

    // Tasks: one per role, tied to the active milestone where relevant.
    await prisma.projectTask.createMany({
      data: [
        {
          projectId: project.id,
          action: "Wire OCR output into claims-routing rules engine.",
          ownerId: users.DEVELOPER.id,
          deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          status: "IN_PROGRESS",
          relatedMilestoneId: overdueMilestone.id,
        },
        {
          projectId: project.id,
          action: "Confirm UAT participants and schedule with claims department.",
          ownerId: users.AI_ANALYST.id,
          deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
      ],
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { health: "DELAYED" },
    });

    console.log(`Seeded demo project: ${project.name} (${project.id})`);
  }

  // --- Demo project #2: fresh in IDEA, unassigned analyst/developer —
  // gives the portfolio list and creation flow something else to show
  // besides the one fully-populated project.
  const existingIdea = await prisma.project.findFirst({
    where: { name: "Internal Helpdesk Copilot" },
  });
  if (!existingIdea) {
    const project = await prisma.project.create({
      data: {
        name: "Internal Helpdesk Copilot",
        businessUnitId: businessUnit.id,
        departmentId: department.id,
        businessProblem:
          "IT helpdesk tickets take an average of 6 hours to triage before reaching the right specialist.",
        expectedOutcome:
          "An LLM-assisted triage bot classifies and routes 60% of tickets automatically.",
        ownerId: users.AI_TEAM_LEAD.id,
        currentStage: ProjectStage.IDEA,
        expectedDeliveryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.projectStageHistory.create({
      data: {
        projectId: project.id,
        fromStage: null,
        toStage: ProjectStage.IDEA,
        actorId: users.AI_TEAM_LEAD.id,
      },
    });
    console.log(`Seeded demo project: ${project.name} (${project.id})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
