import "server-only";
import { prisma } from "./prisma";
import type { SessionPayload } from "./session";

/**
 * PANEL_MEMBER visibility extension for Phase 3: lib/phase2-scoping.ts
 * deliberately scopes PANEL_MEMBER to nothing by default ("requisition
 * visibility for panel members is an Interview-phase concern" — that
 * phase has now arrived). Rather than widen applicationScopeWhere()
 * itself (which would give panel members visibility into every
 * application field, not just the fact that they're on its interview
 * panel), this is a narrow, additive check used only by the
 * interview-related routes: a panel member may view an application (and
 * its interview rounds) if they are assigned as a panelist on at least
 * one Interview under it.
 */
export async function isPanelistOnApplication(
  user: SessionPayload,
  applicationId: string,
): Promise<boolean> {
  const count = await prisma.interviewPanelist.count({
    where: { userId: user.userId, interview: { applicationId } },
  });
  return count > 0;
}

export async function isPanelistOnInterview(
  user: SessionPayload,
  interviewId: string,
): Promise<boolean> {
  const count = await prisma.interviewPanelist.count({
    where: { userId: user.userId, interviewId },
  });
  return count > 0;
}
