-- CreateEnum
CREATE TYPE "RequisitionApprovalStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'OPEN', 'ON_HOLD', 'FILLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('MANUAL_ENTRY', 'CV_UPLOAD', 'SPREADSHEET_IMPORT', 'JOB_PORTAL', 'REFERRAL', 'INTERNAL_POOL', 'HEADHUNTER');

-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('NEW', 'SCREENING', 'ASSESSMENT', 'INTERVIEW', 'FEEDBACK_PENDING', 'APPROVAL', 'SELECTED', 'JOINING', 'JOINED', 'ON_HOLD', 'REJECTED', 'WITHDRAWN', 'REDIRECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "requisitions" (
    "id" TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "vacancyCount" INTEGER NOT NULL,
    "positionLevel" TEXT NOT NULL,
    "hiringManagerId" TEXT NOT NULL,
    "assignedRecruiterId" TEXT NOT NULL,
    "targetJoiningDate" TIMESTAMP(3) NOT NULL,
    "approvalStatus" "RequisitionApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "erfRrfDocumentId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "candidateSource" "CandidateSource" NOT NULL,
    "cvDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "assignedRecruiterId" TEXT NOT NULL,
    "currentStage" "ApplicationStage" NOT NULL DEFAULT 'NEW',
    "nextAction" TEXT,
    "nextActionOwnerId" TEXT,
    "nextActionDueDate" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_history" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStage" "ApplicationStage",
    "toStage" "ApplicationStage" NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requisitions_erfRrfDocumentId_key" ON "requisitions"("erfRrfDocumentId");

-- CreateIndex
CREATE INDEX "requisitions_assignedRecruiterId_idx" ON "requisitions"("assignedRecruiterId");

-- CreateIndex
CREATE INDEX "requisitions_businessUnitId_departmentId_idx" ON "requisitions"("businessUnitId", "departmentId");

-- CreateIndex
CREATE INDEX "requisitions_approvalStatus_idx" ON "requisitions"("approvalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_cvDocumentId_key" ON "candidates"("cvDocumentId");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "candidates_mobileNumber_idx" ON "candidates"("mobileNumber");

-- CreateIndex
CREATE INDEX "applications_assignedRecruiterId_idx" ON "applications"("assignedRecruiterId");

-- CreateIndex
CREATE INDEX "applications_currentStage_idx" ON "applications"("currentStage");

-- CreateIndex
CREATE INDEX "applications_requisitionId_idx" ON "applications"("requisitionId");

-- CreateIndex
CREATE INDEX "applications_candidateId_idx" ON "applications"("candidateId");

-- CreateIndex
CREATE INDEX "applications_nextActionOwnerId_nextActionDueDate_idx" ON "applications"("nextActionOwnerId", "nextActionDueDate");

-- CreateIndex
CREATE INDEX "stage_history_applicationId_idx" ON "stage_history"("applicationId");

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_hiringManagerId_fkey" FOREIGN KEY ("hiringManagerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_assignedRecruiterId_fkey" FOREIGN KEY ("assignedRecruiterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assignedRecruiterId_fkey" FOREIGN KEY ("assignedRecruiterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_nextActionOwnerId_fkey" FOREIGN KEY ("nextActionOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
