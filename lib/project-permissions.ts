import type { Role } from "@prisma/client";

/**
 * Permission matrix per assignment Sec 9. AI_TEAM_LEAD and MANAGEMENT
 * can see everything; MANAGEMENT is read-only over the portfolio (it
 * can record nothing but views status/delays/blockers/decisions).
 *
 * Plain data module (no "server-only") so it can be imported from both
 * server route handlers and Client Components (for UX-only button
 * gating — the server route's own permission check is the real
 * boundary, see `requireProjectPermission` in lib/project-authz.ts).
 */
export const PROJECT_PERMISSIONS = {
  CREATE_PROJECT: ["AI_ANALYST", "AI_TEAM_LEAD"],
  EDIT_REQUIREMENTS: ["AI_ANALYST", "AI_TEAM_LEAD"],
  APPROVE_DESIGN: ["BUSINESS_OWNER", "AI_TEAM_LEAD"],
  TRANSITION_STAGE: ["AI_ANALYST", "DEVELOPER", "BUSINESS_OWNER", "AI_TEAM_LEAD"],
  TOGGLE_CHECKLIST_ITEM: ["AI_ANALYST", "DEVELOPER", "BUSINESS_OWNER", "AI_TEAM_LEAD"],
  MANAGE_MILESTONES: ["AI_ANALYST", "AI_TEAM_LEAD"],
  UPDATE_TASK: ["AI_ANALYST", "DEVELOPER", "BUSINESS_OWNER", "AI_TEAM_LEAD"],
  RECORD_BLOCKER: ["AI_ANALYST", "DEVELOPER", "AI_TEAM_LEAD"],
  RESOLVE_BLOCKER: ["AI_ANALYST", "DEVELOPER", "AI_TEAM_LEAD"],
  RECORD_SCOPE_CHANGE: ["AI_ANALYST", "AI_TEAM_LEAD", "BUSINESS_OWNER"],
  RECORD_DELAY_REASON: ["AI_ANALYST", "DEVELOPER", "AI_TEAM_LEAD"],
  ASSIGN_RESOURCES: ["AI_TEAM_LEAD"],
  VIEW_MANAGEMENT_DASHBOARD: ["AI_TEAM_LEAD", "MANAGEMENT"],
} satisfies Record<string, Role[]>;

export type ProjectPermission = keyof typeof PROJECT_PERMISSIONS;

export function hasProjectPermission(
  role: Role,
  permission: ProjectPermission,
): boolean {
  return (PROJECT_PERMISSIONS[permission] as Role[]).includes(role);
}
