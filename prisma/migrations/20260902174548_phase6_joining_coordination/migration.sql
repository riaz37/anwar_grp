-- CreateEnum
CREATE TYPE "JoiningChecklistItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED');

-- CreateTable
CREATE TABLE "joining_checklist_items" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "JoiningChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "documentId" TEXT,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joining_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "joining_checklist_items_documentId_key" ON "joining_checklist_items"("documentId");

-- CreateIndex
CREATE INDEX "joining_checklist_items_applicationId_idx" ON "joining_checklist_items"("applicationId");

-- CreateIndex
CREATE INDEX "joining_checklist_items_ownerId_dueDate_idx" ON "joining_checklist_items"("ownerId", "dueDate");

-- CreateIndex
CREATE INDEX "joining_checklist_items_status_idx" ON "joining_checklist_items"("status");

-- AddForeignKey
ALTER TABLE "joining_checklist_items" ADD CONSTRAINT "joining_checklist_items_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joining_checklist_items" ADD CONSTRAINT "joining_checklist_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joining_checklist_items" ADD CONSTRAINT "joining_checklist_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
