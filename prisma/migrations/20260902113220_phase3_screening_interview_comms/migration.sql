-- CreateEnum
CREATE TYPE "ScreeningAttendance" AS ENUM ('ATTENDED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageTemplateCategory" AS ENUM ('INTERVIEW_INVITATION', 'INTERVIEW_REMINDER', 'RESCHEDULING', 'DOCUMENT_REQUEST', 'SELECTION', 'REJECTION', 'JOINING_REMINDER');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFTED', 'AWAITING_APPROVAL', 'APPROVED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "screening_assessments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "eligibility" BOOLEAN NOT NULL,
    "screeningComments" TEXT,
    "telephoneAssessmentOutcome" TEXT,
    "availability" TEXT,
    "recommendation" TEXT,
    "assessmentType" TEXT,
    "assessmentScore" DOUBLE PRECISION,
    "attendance" "ScreeningAttendance",
    "evaluatorRecommendation" TEXT,
    "assessmentDocumentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "screening_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "location" TEXT,
    "onlineLink" TEXT,
    "candidateInstructions" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "evaluationFormId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_panelists" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_panelists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_reschedule_history" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "previousScheduledAt" TIMESTAMP(3) NOT NULL,
    "newScheduledAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_reschedule_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "category" "MessageTemplateCategory" NOT NULL,
    "subject" TEXT,
    "bodyTemplate" TEXT NOT NULL,
    "allowedFields" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'DRAFTED',
    "renderedSubject" TEXT,
    "renderedBody" TEXT NOT NULL,
    "draftedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "providerMessageId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "screening_assessments_assessmentDocumentId_key" ON "screening_assessments"("assessmentDocumentId");

-- CreateIndex
CREATE INDEX "screening_assessments_applicationId_idx" ON "screening_assessments"("applicationId");

-- CreateIndex
CREATE INDEX "interviews_applicationId_idx" ON "interviews"("applicationId");

-- CreateIndex
CREATE INDEX "interview_panelists_userId_idx" ON "interview_panelists"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_panelists_interviewId_userId_key" ON "interview_panelists"("interviewId", "userId");

-- CreateIndex
CREATE INDEX "interview_reschedule_history_interviewId_idx" ON "interview_reschedule_history"("interviewId");

-- CreateIndex
CREATE INDEX "message_templates_channel_category_isActive_idx" ON "message_templates"("channel", "category", "isActive");

-- CreateIndex
CREATE INDEX "communications_applicationId_idx" ON "communications"("applicationId");

-- CreateIndex
CREATE INDEX "communications_status_idx" ON "communications"("status");

-- AddForeignKey
ALTER TABLE "screening_assessments" ADD CONSTRAINT "screening_assessments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "screening_assessments" ADD CONSTRAINT "screening_assessments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_panelists" ADD CONSTRAINT "interview_panelists_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_panelists" ADD CONSTRAINT "interview_panelists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_reschedule_history" ADD CONSTRAINT "interview_reschedule_history_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_reschedule_history" ADD CONSTRAINT "interview_reschedule_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "message_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_draftedById_fkey" FOREIGN KEY ("draftedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
