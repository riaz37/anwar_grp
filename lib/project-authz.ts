import "server-only";
import { AuthzError } from "./authz";
import { prisma } from "./prisma";
import type { SessionPayload } from "./session";
import {
  hasProjectPermission,
  PROJECT_PERMISSIONS,
  type ProjectPermission,
} from "./project-permissions";

export { PROJECT_PERMISSIONS, hasProjectPermission, type ProjectPermission };

/** Throws AuthzError(403) unless the session's role holds `permission`. */
export function requireProjectPermission(
  user: SessionPayload,
  permission: ProjectPermission,
): void {
  if (!hasProjectPermission(user.role, permission)) {
    throw new AuthzError(
      `Role ${user.role} does not have permission: ${permission}.`,
      403,
      "FORBIDDEN",
    );
  }
}

/**
 * A user may act on a project if they are MANAGEMENT/AI_TEAM_LEAD
 * (portfolio-wide), or one of the project's assigned people
 * (owner/analyst/developer), or a BUSINESS_OWNER in the same
 * department. Used for read-scoping and for "can this specific person
 * touch this specific project" checks beyond the coarse role matrix
 * above.
 */
export function isProjectParticipant(
  user: SessionPayload,
  project: {
    ownerId: string;
    analystId: string | null;
    developerId: string | null;
    departmentId: string;
  },
): boolean {
  if (user.role === "AI_TEAM_LEAD" || user.role === "MANAGEMENT") return true;
  if (user.userId === project.ownerId) return true;
  if (user.userId === project.analystId) return true;
  if (user.userId === project.developerId) return true;
  if (user.role === "BUSINESS_OWNER" && user.departmentId === project.departmentId) {
    return true;
  }
  return false;
}

/**
 * Loads a project's participant-relevant fields and throws AuthzError(404)
 * unless the user is a participant per `isProjectParticipant` — 404 rather
 * than 403 so a non-participant can't distinguish "doesn't exist" from
 * "exists but you can't see it." Used by both reads (list/detail) and
 * writes (stage transitions, checklist, milestones, tasks, blockers,
 * scope changes) so AI_ANALYST/DEVELOPER/BUSINESS_OWNER are scoped to
 * their assigned projects per the assignment's role table (Sec 9 —
 * "Developer: View assigned projects"), while AI_TEAM_LEAD/MANAGEMENT
 * keep portfolio-wide access.
 */
export async function requireProjectParticipant(
  user: SessionPayload,
  projectId: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      analystId: true,
      developerId: true,
      departmentId: true,
    },
  });
  if (!project || !isProjectParticipant(user, project)) {
    throw new AuthzError("Project not found.", 404, "NOT_FOUND");
  }
}
