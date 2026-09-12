import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds ItemDependency rows from the scheduling relationships that
 * lib/critical-path.ts used to infer implicitly, before dependencies became
 * an explicit graph:
 *  - each milestone depended on the one immediately before it, by dueDate
 *  - each task with a relatedMilestoneId depended on that milestone
 *
 * Run once, after the add_item_dependency_and_task_progress migration and
 * before deploying the rewritten lib/critical-path.ts, so existing
 * projects' critical paths don't change: npx tsx scripts/backfill-item-dependencies.ts
 */

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });

  let edgesCreated = 0;
  for (const project of projects) {
    const [milestones, tasks] = await Promise.all([
      prisma.milestone.findMany({
        where: { projectId: project.id },
        orderBy: { dueDate: "asc" },
        select: { id: true },
      }),
      prisma.projectTask.findMany({
        where: { projectId: project.id, relatedMilestoneId: { not: null } },
        select: { id: true, relatedMilestoneId: true },
      }),
    ]);

    let previousMilestoneId: string | null = null;
    for (const milestone of milestones) {
      if (previousMilestoneId) {
        await prisma.itemDependency.upsert({
          where: {
            dependentType_dependentId_dependsOnType_dependsOnId: {
              dependentType: "MILESTONE",
              dependentId: milestone.id,
              dependsOnType: "MILESTONE",
              dependsOnId: previousMilestoneId,
            },
          },
          update: {},
          create: {
            projectId: project.id,
            dependentType: "MILESTONE",
            dependentId: milestone.id,
            dependsOnType: "MILESTONE",
            dependsOnId: previousMilestoneId,
          },
        });
        edgesCreated += 1;
      }
      previousMilestoneId = milestone.id;
    }

    for (const task of tasks) {
      if (!task.relatedMilestoneId) continue;
      await prisma.itemDependency.upsert({
        where: {
          dependentType_dependentId_dependsOnType_dependsOnId: {
            dependentType: "TASK",
            dependentId: task.id,
            dependsOnType: "MILESTONE",
            dependsOnId: task.relatedMilestoneId,
          },
        },
        update: {},
        create: {
          projectId: project.id,
          dependentType: "TASK",
          dependentId: task.id,
          dependsOnType: "MILESTONE",
          dependsOnId: task.relatedMilestoneId,
        },
      });
      edgesCreated += 1;
    }

    console.log(
      `${project.name}: ${milestones.length} milestone(s), ${tasks.length} milestone-linked task(s)`,
    );
  }

  console.log(`Done. Upserted ${edgesCreated} dependency edge(s) across ${projects.length} project(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
