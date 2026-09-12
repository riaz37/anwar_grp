-- CreateEnum
CREATE TYPE "DependencyItemType" AS ENUM ('MILESTONE', 'TASK');

-- AlterTable
ALTER TABLE "project_tasks" ADD COLUMN     "progressPercent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "item_dependencies" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "dependentType" "DependencyItemType" NOT NULL,
    "dependentId" TEXT NOT NULL,
    "dependsOnType" "DependencyItemType" NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_dependencies_projectId_idx" ON "item_dependencies"("projectId");

-- CreateIndex
CREATE INDEX "item_dependencies_dependentType_dependentId_idx" ON "item_dependencies"("dependentType", "dependentId");

-- CreateIndex
CREATE UNIQUE INDEX "item_dependencies_dependentType_dependentId_dependsOnType_d_key" ON "item_dependencies"("dependentType", "dependentId", "dependsOnType", "dependsOnId");

-- AddForeignKey
ALTER TABLE "item_dependencies" ADD CONSTRAINT "item_dependencies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RowLevelSecurity (matches every other table in this schema: RLS enabled,
-- no policies — blocks PostgREST/anon access; the app's server-side Prisma
-- client connects via a role that bypasses RLS)
ALTER TABLE "item_dependencies" ENABLE ROW LEVEL SECURITY;
