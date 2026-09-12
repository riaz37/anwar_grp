import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TEAM_LEAD_EMAIL = "teamlead@anwargroup.test";
const DEMO_EMAIL = "riaz37.ipe@gmail.com";
const MILESTONE_ID = "cmtyo91ik009yv6erxpll2ieh";
const ORIGINAL_DUE_DATE = "2026-09-10T17:39:11.289Z";

async function main() {
  await prisma.user.update({
    where: { email: DEMO_EMAIL },
    data: { email: TEAM_LEAD_EMAIL },
  });
  await prisma.milestone.update({
    where: { id: MILESTONE_ID },
    data: { dueDate: new Date(ORIGINAL_DUE_DATE) },
  });
  console.log("Reverted team lead email and milestone due date.");
}

main().finally(() => prisma.$disconnect());
