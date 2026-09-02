import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_BUSINESS_UNIT = "Anwar Group Corporate";
const SEED_DEPARTMENT = "Talent Acquisition";
const SEED_ADMIN_EMAIL = "ta.admin@anwargroup.test";
const SEED_ADMIN_PASSWORD = "TalentFlow!2026";
const SEED_ADMIN_NAME = "TA Admin";

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
    create: {
      name: SEED_DEPARTMENT,
      businessUnitId: businessUnit.id,
    },
  });

  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: SEED_ADMIN_EMAIL },
    update: {
      passwordHash,
      role: Role.TA_ADMIN,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
      isActive: true,
    },
    create: {
      email: SEED_ADMIN_EMAIL,
      passwordHash,
      name: SEED_ADMIN_NAME,
      role: Role.TA_ADMIN,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
    },
  });

  console.log("Seed complete.");
  console.log("BusinessUnit:", businessUnit.name, businessUnit.id);
  console.log("Department:", department.name, department.id);
  console.log("TA_ADMIN user:", admin.email, admin.id);
  console.log("---");
  console.log("Seed admin login credentials (local dev only):");
  console.log("  email:   ", SEED_ADMIN_EMAIL);
  console.log("  password:", SEED_ADMIN_PASSWORD);
  console.log("---");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
