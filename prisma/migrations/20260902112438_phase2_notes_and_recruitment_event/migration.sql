-- AlterEnum
ALTER TYPE "CandidateSource" ADD VALUE 'RECRUITMENT_EVENT';

-- AlterTable
ALTER TABLE "requisitions" ADD COLUMN     "notes" TEXT;
