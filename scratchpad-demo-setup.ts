import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TEAM_LEAD_EMAIL = "teamlead@anwargroup.test";
const DEMO_EMAIL = "riaz37.ipe@gmail.com";
const MILESTONE_ID = "cmtyo91ik009yv6erxpll2ieh";

async function main() {
  const teamLead = await prisma.user.findUnique({ where: { email: TEAM_LEAD_EMAIL } });
  const milestone = await prisma.milestone.findUnique({ where: { id: MILESTONE_ID } });
  if (!teamLead || !milestone) throw new Error("Fixture lookup failed");

  console.log("ORIGINAL_MILESTONE_DUE_DATE=" + milestone.dueDate.toISOString());

  await prisma.user.update({
    where: { id: teamLead.id },
    data: { email: DEMO_EMAIL },
  });

  const backdated = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
  await prisma.milestone.update({
    where: { id: MILESTONE_ID },
    data: { dueDate: backdated },
  });

  console.log(`Team lead ${TEAM_LEAD_EMAIL} -> ${DEMO_EMAIL}`);
  console.log(`Milestone "${milestone.name}" dueDate -> ${backdated.toISOString()} (now overdue)`);
}

main().finally(() => prisma.$disconnect());
