import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export interface WriteAuditInput {
  /** Nullable to allow system-initiated events with no human actor. */
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue | null;
}

/**
 * Append-only audit log write. This module deliberately exposes NO
 * update/delete function — AuditLog rows must be immutable per
 * BUILD_PLAN.md Sec 2.3 ("StageHistory and AuditLog are insert-only —
 * no UPDATE/DELETE grant at the DB role level, enforcing 'permanent
 * audit record' at the data layer, not just by convention").
 *
 * Every module that mutates state should call this after (or as part
 * of) the mutation. Failures here should not be silently swallowed by
 * callers — but a logging failure also should not usually crash a
 * request outright; callers decide that tradeoff for their own route.
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? undefined,
    },
  });
}
