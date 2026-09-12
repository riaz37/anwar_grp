import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const flag = await prisma.agentFlag.findUnique({
    where: {
      projectId_flagType_subjectId: {
        projectId: "cmtyo8rrm008rv6err8khtkhg",
        flagType: "STUCK_MILESTONE",
        subjectId: "cmtyo91ik009yv6erxpll2ieh",
      },
    },
  });
  console.log(flag);
}
main().finally(() => prisma.$disconnect());
