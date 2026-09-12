import "server-only";
import { prisma } from "./prisma";
import { STAGE_ORDER } from "./project-stages";
import { isProjectParticipant } from "./project-authz";
import type { RaciRole } from "@prisma/client";

export class ProjectNotFoundError extends Error {}

export interface RaciPerson {
  userId: string;
  name: string;
  email: string;
}

export interface RaciResponsibleEntry extends RaciPerson {
  /** e.g. "Analyst", "Developer", or a specific blocker's description. */
  scope: string;
}

export interface ProjectRaci {
  accountable: RaciPerson | null;
  responsible: RaciResponsibleEntry[];
  consulted: RaciPerson[];
  informed: RaciPerson[];
}

/**
 * Assembles the RACI grid per AGENTIC_DASHBOARD_PLAN.md Decision 5: R/A
 * are derived from existing single-owner fields (never stored), C/I
 * come from ProjectStakeholder rows.
 */
export async function getProjectRaci(projectId: string): Promise<ProjectRaci> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      analyst: true,
      developer: true,
      blockers: {
        where: { resolvedAt: null },
        include: { responsiblePerson: true },
      },
      stakeholders: { include: { user: true } },
    },
  });
  if (!project) {
    throw new ProjectNotFoundError(`Project not found: ${projectId}`);
  }

  const responsible: RaciResponsibleEntry[] = [];
  if (project.analyst) {
    responsible.push({
      userId: project.analyst.id,
      name: project.analyst.name,
      email: project.analyst.email,
      scope: "Analyst",
    });
  }
  if (project.developer) {
    responsible.push({
      userId: project.developer.id,
      name: project.developer.name,
      email: project.developer.email,
      scope: "Developer",
    });
  }
  for (const blocker of project.blockers) {
    responsible.push({
      userId: blocker.responsiblePerson.id,
      name: blocker.responsiblePerson.name,
      email: blocker.responsiblePerson.email,
      scope: `Blocker: ${blocker.description}`,
    });
  }

  const byRole = (role: RaciRole): RaciPerson[] =>
    project.stakeholders
      .filter((stakeholder) => stakeholder.raciRole === role)
      .map((stakeholder) => ({
        userId: stakeholder.user.id,
        name: stakeholder.user.name,
        email: stakeholder.user.email,
      }));

  return {
    accountable: {
      userId: project.owner.id,
      name: project.owner.name,
      email: project.owner.email,
    },
    responsible,
    consulted: byRole("CONSULTED"),
    informed: byRole("INFORMED"),
  };
}

export type OwnershipGapType =
  | "MISSING_ANALYST"
  | "MISSING_DEVELOPER"
  | "BLOCKER_RESPONSIBLE_NOT_PARTICIPANT"
  | "NO_CONSULTED_OR_INFORMED";

export interface OwnershipGap {
  type: OwnershipGapType;
  /** The blocker id, when type is BLOCKER_RESPONSIBLE_NOT_PARTICIPANT. */
  subjectId: string;
  reason: string;
}

/**
 * Decision 6's four ownership-gap conditions, evaluated against the
 * live schema. Stage comparisons use STAGE_ORDER (lib/project-stages.ts)
 * rather than assuming enum declaration order matches pipeline order.
 */
export async function getOwnershipGaps(projectId: string): Promise<OwnershipGap[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      blockers: {
        where: { resolvedAt: null },
        include: { responsiblePerson: true },
      },
      stakeholders: true,
    },
  });
  if (!project) {
    throw new ProjectNotFoundError(`Project not found: ${projectId}`);
  }

  const stageIdx = STAGE_ORDER.indexOf(project.currentStage);
  const ideaIdx = STAGE_ORDER.indexOf("IDEA");
  const developmentIdx = STAGE_ORDER.indexOf("DEVELOPMENT");
  const approvalIdx = STAGE_ORDER.indexOf("APPROVAL");

  const gaps: OwnershipGap[] = [];

  if (project.analystId === null && stageIdx > ideaIdx) {
    gaps.push({
      type: "MISSING_ANALYST",
      subjectId: project.id,
      reason: `No analyst assigned while the project is in ${project.currentStage}.`,
    });
  }

  if (project.developerId === null && stageIdx >= developmentIdx) {
    gaps.push({
      type: "MISSING_DEVELOPER",
      subjectId: project.id,
      reason: `No developer assigned while the project is in ${project.currentStage}.`,
    });
  }

  for (const blocker of project.blockers) {
    const isParticipant = isProjectParticipant(
      {
        sessionId: "",
        userId: blocker.responsiblePerson.id,
        role: blocker.responsiblePerson.role,
        departmentId: blocker.responsiblePerson.departmentId,
        businessUnitId: blocker.responsiblePerson.businessUnitId,
        email: blocker.responsiblePerson.email,
        name: blocker.responsiblePerson.name,
        isActive: blocker.responsiblePerson.isActive,
      },
      project,
    );
    if (!isParticipant) {
      gaps.push({
        type: "BLOCKER_RESPONSIBLE_NOT_PARTICIPANT",
        subjectId: blocker.id,
        reason: `Blocker "${blocker.description}" is assigned to ${blocker.responsiblePerson.name}, who is not a participant on this project.`,
      });
    }
  }

  const consultedCount = project.stakeholders.filter(
    (stakeholder) => stakeholder.raciRole === "CONSULTED",
  ).length;
  const informedCount = project.stakeholders.filter(
    (stakeholder) => stakeholder.raciRole === "INFORMED",
  ).length;
  if (consultedCount === 0 && informedCount === 0 && stageIdx >= approvalIdx) {
    gaps.push({
      type: "NO_CONSULTED_OR_INFORMED",
      subjectId: project.id,
      reason: `No Consulted or Informed stakeholders while the project is in ${project.currentStage}.`,
    });
  }

  return gaps;
}
