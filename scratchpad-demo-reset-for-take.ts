import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const flag = await prisma.agentFlag.update({
    where: {
      projectId_flagType_subjectId: {
        projectId: "cmtyo8rrm008rv6err8khtkhg",
        flagType: "STUCK_MILESTONE",
        subjectId: "cmtyo91ik009yv6erxpll2ieh",
      },
    },
    data: { resolvedAt: new Date(), resolutionReason: "CONDITION_CLEARED" },
  });
  console.log("Flag marked resolved — next monitor run will treat it as a fresh occurrence and re-send the email:", flag.id);
}

main().finally(() => prisma.$disconnect());
