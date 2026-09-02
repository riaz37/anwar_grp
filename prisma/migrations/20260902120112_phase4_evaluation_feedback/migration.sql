-- CreateEnum
CREATE TYPE "OverallRecommendation" AS ENUM ('STRONG_YES', 'YES', 'NEUTRAL', 'NO', 'STRONG_NO');

-- CreateTable
CREATE TABLE "evaluation_form_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleType" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "panelistId" TEXT NOT NULL,
    "evaluationFormTemplateId" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "strengths" TEXT,
    "concerns" TEXT,
    "organizationalSuitability" TEXT,
    "overallRecommendation" "OverallRecommendation",
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evaluation_form_templates_roleType_isActive_idx" ON "evaluation_form_templates"("roleType", "isActive");

-- CreateIndex
CREATE INDEX "evaluations_interviewId_idx" ON "evaluations"("interviewId");

-- CreateIndex
CREATE INDEX "evaluations_panelistId_idx" ON "evaluations"("panelistId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_interviewId_panelistId_key" ON "evaluations"("interviewId", "panelistId");

-- AddForeignKey
ALTER TABLE "evaluation_form_templates" ADD CONSTRAINT "evaluation_form_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_panelistId_fkey" FOREIGN KEY ("panelistId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluationFormTemplateId_fkey" FOREIGN KEY ("evaluationFormTemplateId") REFERENCES "evaluation_form_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
