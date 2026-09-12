import { PrismaClient, ProjectStage } from "@prisma/client";
import type { Project, RaciRole, User } from "@prisma/client";

const prisma = new PrismaClient();

/** Mirrors lib/project-stages.ts STAGE_ORDER, duplicated here so this
 * standalone script avoids that module's "server-only"/next/server imports. */
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

/**
 * Assigns a default Consulted (AI_TEAM_LEAD) and Informed (MANAGEMENT)
 * stakeholder to every project that has reached APPROVAL or later with
 * neither role filled — the NO_CONSULTED_OR_INFORMED ownership gap in
 * lib/raci-engine.ts. Run once with: npx tsx scripts/backfill-raci-stakeholders.ts
 */

const approvalIdx = STAGE_ORDER.indexOf("APPROVAL");

function pickDefault(
  candidates: User[],
  project: Pick<Project, "businessUnitId" | "departmentId">,
): User | null {
  const sameDept = candidates.find((c) => c.departmentId === project.departmentId);
  if (sameDept) return sameDept;
  const sameBu = candidates.find((c) => c.businessUnitId === project.businessUnitId);
  if (sameBu) return sameBu;
  return candidates[0] ?? null;
}

async function assignDefault(
  projectId: string,
  project: Pick<Project, "businessUnitId" | "departmentId">,
  candidates: User[],
  raciRole: RaciRole,
): Promise<string | null> {
  const person = pickDefault(candidates, project);
  if (!person) return null;

  await prisma.projectStakeholder.upsert({
    where: {
      projectId_userId_raciRole: { projectId, userId: person.id, raciRole },
    },
    update: {},
    create: { projectId, userId: person.id, raciRole },
  });
  return person.name;
}

async function main() {
  const [teamLeads, managers] = await Promise.all([
    prisma.user.findMany({ where: { role: "AI_TEAM_LEAD", isActive: true } }),
    prisma.user.findMany({ where: { role: "MANAGEMENT", isActive: true } }),
  ]);

  if (teamLeads.length === 0 || managers.length === 0) {
    console.error("No active AI_TEAM_LEAD or MANAGEMENT users found; aborting.");
    process.exitCode = 1;
    return;
  }

  const projects = await prisma.project.findMany({
    include: { stakeholders: true },
  });

  let updated = 0;
  for (const project of projects) {
    const stageIdx = STAGE_ORDER.indexOf(project.currentStage);
    if (stageIdx < approvalIdx) continue;

    const hasConsulted = project.stakeholders.some((s) => s.raciRole === "CONSULTED");
    const hasInformed = project.stakeholders.some((s) => s.raciRole === "INFORMED");
    if (hasConsulted || hasInformed) continue;

    const consultedName = await assignDefault(project.id, project, teamLeads, "CONSULTED");
    const informedName = await assignDefault(project.id, project, managers, "INFORMED");

    console.log(
      `${project.name}: Consulted=${consultedName ?? "none"}, Informed=${informedName ?? "none"}`,
    );
    updated += 1;
  }

  console.log(`Done. Backfilled RACI stakeholders on ${updated} project(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
