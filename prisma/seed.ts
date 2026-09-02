import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_BUSINESS_UNIT = "Anwar Group Corporate";
const SEED_DEPARTMENT = "Talent Acquisition";
const SEED_ADMIN_EMAIL = "ta.admin@anwargroup.test";
const SEED_ADMIN_PASSWORD = "TalentFlow!2026";
const SEED_ADMIN_NAME = "TA Admin";
const SEED_RECRUITER_EMAIL = "recruiter@anwargroup.test";
const SEED_RECRUITER_NAME = "Test Recruiter";
const SEED_HIRING_MANAGER_EMAIL = "hiring.manager@anwargroup.test";
const SEED_HIRING_MANAGER_NAME = "Test Hiring Manager";
// Phase 4 (Evaluation & Feedback) needs at least two PANEL_MEMBER users
// to exercise the blind-until-submit visibility rule (one panelist
// can't see another's evaluation until their own is submitted) —
// extending the existing seed rather than adding a separate seed file.
const SEED_PANEL_MEMBER_1_EMAIL = "panelist1@anwargroup.test";
const SEED_PANEL_MEMBER_1_NAME = "Test Panelist One";
const SEED_PANEL_MEMBER_2_EMAIL = "panelist2@anwargroup.test";
const SEED_PANEL_MEMBER_2_NAME = "Test Panelist Two";

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

  // Phase 2 (Requisition -> Candidate) needs at least one RECRUITER and
  // one DEPT_HEAD/HIRING_MANAGER to exercise role-scoped list endpoints
  // and requisition approval end-to-end — extending the existing seed
  // rather than adding a separate seed file per the task instructions.
  const recruiter = await prisma.user.upsert({
    where: { email: SEED_RECRUITER_EMAIL },
    update: {
      passwordHash,
      role: Role.RECRUITER,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
      isActive: true,
    },
    create: {
      email: SEED_RECRUITER_EMAIL,
      passwordHash,
      name: SEED_RECRUITER_NAME,
      role: Role.RECRUITER,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
    },
  });

  const hiringManager = await prisma.user.upsert({
    where: { email: SEED_HIRING_MANAGER_EMAIL },
    update: {
      passwordHash,
      role: Role.HIRING_MANAGER,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
      isActive: true,
    },
    create: {
      email: SEED_HIRING_MANAGER_EMAIL,
      passwordHash,
      name: SEED_HIRING_MANAGER_NAME,
      role: Role.HIRING_MANAGER,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
    },
  });

  const panelist1 = await prisma.user.upsert({
    where: { email: SEED_PANEL_MEMBER_1_EMAIL },
    update: {
      passwordHash,
      role: Role.PANEL_MEMBER,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
      isActive: true,
    },
    create: {
      email: SEED_PANEL_MEMBER_1_EMAIL,
      passwordHash,
      name: SEED_PANEL_MEMBER_1_NAME,
      role: Role.PANEL_MEMBER,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
    },
  });

  const panelist2 = await prisma.user.upsert({
    where: { email: SEED_PANEL_MEMBER_2_EMAIL },
    update: {
      passwordHash,
      role: Role.PANEL_MEMBER,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
      isActive: true,
    },
    create: {
      email: SEED_PANEL_MEMBER_2_EMAIL,
      passwordHash,
      name: SEED_PANEL_MEMBER_2_NAME,
      role: Role.PANEL_MEMBER,
      businessUnitId: businessUnit.id,
      departmentId: department.id,
    },
  });

  console.log("Seed complete.");
  console.log("BusinessUnit:", businessUnit.name, businessUnit.id);
  console.log("Department:", department.name, department.id);
  console.log("TA_ADMIN user:", admin.email, admin.id);
  console.log("RECRUITER user:", recruiter.email, recruiter.id);
  console.log("HIRING_MANAGER user:", hiringManager.email, hiringManager.id);
  console.log("PANEL_MEMBER user 1:", panelist1.email, panelist1.id);
  console.log("PANEL_MEMBER user 2:", panelist2.email, panelist2.id);
  console.log("---");
  console.log("Seed admin login credentials (local dev only):");
  console.log("  email:   ", SEED_ADMIN_EMAIL);
  console.log("  password:", SEED_ADMIN_PASSWORD);
  console.log("  (recruiter/hiring-manager/panelist seed accounts share this password)");
  console.log("  recruiter:      ", SEED_RECRUITER_EMAIL);
  console.log("  hiring manager: ", SEED_HIRING_MANAGER_EMAIL);
  console.log("  panelist 1:     ", SEED_PANEL_MEMBER_1_EMAIL);
  console.log("  panelist 2:     ", SEED_PANEL_MEMBER_2_EMAIL);
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
