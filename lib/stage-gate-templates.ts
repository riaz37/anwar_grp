import type { ProjectStage } from "@prisma/client";

export interface ChecklistTemplateItem {
  label: string;
  required: boolean;
}

/**
 * Stage-gate exit criteria, verbatim from the assignment Sec 5. Only
 * stages with an explicit gate in the brief carry a template — IDEA,
 * APPROVAL, INTERNAL_TESTING, DEPLOYMENT, STABILIZATION and COMPLETED
 * have no fixed checklist and transition freely (see
 * lib/project-stages.ts: a stage with zero checklist items is treated
 * as vacuously satisfied).
 *
 * Plain data module (no "server-only" import) so it can be shared by
 * both server-only lib code and prisma/seed.ts, which runs under tsx
 * outside the Next.js bundler where the "server-only" alias doesn't
 * exist.
 */
export const STAGE_GATE_TEMPLATES: Partial<
  Record<ProjectStage, ChecklistTemplateItem[]>
> = {
  DISCOVERY: [
    { label: "Business problem documented", required: true },
    { label: "Current process understood", required: true },
    { label: "Users identified", required: true },
    { label: "Expected outcome defined", required: true },
  ],
  REQUIREMENTS_DESIGN: [
    { label: "Requirements completed", required: true },
    { label: "Workflow approved", required: true },
    { label: "UI/UX or solution design completed", required: true },
    { label: "Technical approach defined", required: true },
  ],
  DEVELOPMENT: [
    { label: "Required functionality developed", required: true },
    { label: "Internal testing completed", required: true },
    { label: "Major known bugs resolved", required: true },
  ],
  BUSINESS_TESTING_UAT: [
    { label: "Business testing completed", required: true },
    { label: "Feedback recorded", required: true },
    { label: "Critical issues resolved", required: true },
    { label: "Business approval received", required: true },
  ],
};
