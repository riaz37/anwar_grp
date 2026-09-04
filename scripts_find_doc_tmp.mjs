import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const p = await prisma.project.findUnique({ where: { id: "cmtl96057000ev6ps4jan64z6" }, select: { name: true } });
console.log(p);
await prisma.$disconnect();
