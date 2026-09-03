import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { hasProjectPermission, PROJECT_PERMISSIONS } from "@/lib/project-permissions";

const ALL_ROLES: Role[] = [
  "AI_ANALYST",
  "DEVELOPER",
  "BUSINESS_OWNER",
  "AI_TEAM_LEAD",
  "MANAGEMENT",
];

describe("hasProjectPermission", () => {
  it("grants exactly the roles listed in PROJECT_PERMISSIONS for every permission", () => {
    for (const [permission, allowedRoles] of Object.entries(PROJECT_PERMISSIONS)) {
      for (const role of ALL_ROLES) {
        const expected = (allowedRoles as Role[]).includes(role);
        expect(hasProjectPermission(role, permission as keyof typeof PROJECT_PERMISSIONS)).toBe(
          expected,
        );
      }
    }
  });

  it("MANAGEMENT can view the management dashboard but cannot mutate anything (assignment Sec 9: view-only)", () => {
    expect(hasProjectPermission("MANAGEMENT", "VIEW_MANAGEMENT_DASHBOARD")).toBe(true);
    expect(hasProjectPermission("MANAGEMENT", "CREATE_PROJECT")).toBe(false);
    expect(hasProjectPermission("MANAGEMENT", "TRANSITION_STAGE")).toBe(false);
    expect(hasProjectPermission("MANAGEMENT", "RECORD_BLOCKER")).toBe(false);
    expect(hasProjectPermission("MANAGEMENT", "RESOLVE_BLOCKER")).toBe(false);
    expect(hasProjectPermission("MANAGEMENT", "TOGGLE_CHECKLIST_ITEM")).toBe(false);
  });

  it("BUSINESS_OWNER can approve design, record scope changes and toggle/transition, but cannot manage milestones or record blockers (assignment Sec 9)", () => {
    expect(hasProjectPermission("BUSINESS_OWNER", "APPROVE_DESIGN")).toBe(true);
    expect(hasProjectPermission("BUSINESS_OWNER", "RECORD_SCOPE_CHANGE")).toBe(true);
    expect(hasProjectPermission("BUSINESS_OWNER", "TRANSITION_STAGE")).toBe(true);
    expect(hasProjectPermission("BUSINESS_OWNER", "TOGGLE_CHECKLIST_ITEM")).toBe(true);
    expect(hasProjectPermission("BUSINESS_OWNER", "MANAGE_MILESTONES")).toBe(false);
    expect(hasProjectPermission("BUSINESS_OWNER", "RECORD_BLOCKER")).toBe(false);
    expect(hasProjectPermission("BUSINESS_OWNER", "RESOLVE_BLOCKER")).toBe(false);
  });

  it("DEVELOPER can record and resolve blockers, update tasks, but cannot create projects or manage milestones (assignment Sec 9: view assigned, update dev work, record blockers)", () => {
    expect(hasProjectPermission("DEVELOPER", "RECORD_BLOCKER")).toBe(true);
    expect(hasProjectPermission("DEVELOPER", "RESOLVE_BLOCKER")).toBe(true);
    expect(hasProjectPermission("DEVELOPER", "UPDATE_TASK")).toBe(true);
    expect(hasProjectPermission("DEVELOPER", "CREATE_PROJECT")).toBe(false);
    expect(hasProjectPermission("DEVELOPER", "MANAGE_MILESTONES")).toBe(false);
    expect(hasProjectPermission("DEVELOPER", "EDIT_REQUIREMENTS")).toBe(false);
  });

  it("only AI_TEAM_LEAD can assign resources (portfolio-wide authority, assignment Sec 9)", () => {
    for (const role of ALL_ROLES) {
      expect(hasProjectPermission(role, "ASSIGN_RESOURCES")).toBe(role === "AI_TEAM_LEAD");
    }
  });
});
