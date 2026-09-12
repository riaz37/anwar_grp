"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ApiRequestError, patchJson, postJson } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/primitives/tooltip";
import { hasProjectPermission } from "@/lib/project-permissions";
import { BoardEmpty, BoardSection } from "./board";
import { PersonPicker } from "./PersonPicker";
import { useDirectory } from "./useDirectory";

export type OwnershipGapCategory = "owner" | "visibility";

export interface OwnershipGapRow {
  flagId: string;
  projectId: string;
  projectName: string;
  /** Optimistic-lock token required by `PATCH /api/v1/projects/:id`. */
  projectVersion: number;
  category: OwnershipGapCategory;
  reason: string;
}

const CATEGORY = {
  owner: {
    dot: "bg-danger-med",
    badge: "bg-danger-wash text-danger-high border-danger-outline",
    what: "No accountable owner",
    action: "Assign owner",
    hint: "Sets the project owner (Accountable).",
  },
  visibility: {
    dot: "bg-warn-med",
    badge: "bg-warn-wash text-warn-high border-warn-outline",
    what: "Nobody consulted or informed",
    action: "Add stakeholder",
    hint: "Adds a Consulted or Informed stakeholder.",
  },
} as const satisfies Record<
  OwnershipGapCategory,
  { dot: string; badge: string; what: string; action: string; hint: string }
>;

const RACI_CHOICES = [
  { value: "CONSULTED", label: "Consulted" },
  { value: "INFORMED", label: "Informed" },
];

/** Rows shown before the queue asks to be expanded — deep enough to be a
 *  day's work without running the page off the screen. Rows are one line
 *  tall, so this is a much shorter section than it looks from the count. */
const ROW_LIMIT = 12;

interface Cleared {
  personName: string;
  detail: string;
}

/**
 * The ownership queue: every open OWNERSHIP_GAP the monitoring loop has
 * raised (`lib/raci-engine.ts`), framed as a list of things to clear today
 * rather than a passive report. Each row's primary affordance is the fix —
 * assigning the owner or adding the missing stakeholder happens inline
 * against the real API; the link to the project is the secondary path.
 *
 * A cleared row stays in place, marked resolved, instead of vanishing: the
 * underlying AgentFlag is only closed when the monitor next re-evaluates, so
 * removing the row would make the list disagree with itself on the next load.
 */
export function OwnershipQueue({
  rows,
  currentUserRole,
  className,
}: {
  rows: OwnershipGapRow[];
  currentUserRole: Role;
  className?: string;
}) {
  const router = useRouter();
  const directory = useDirectory();
  const [cleared, setCleared] = useState<Record<string, Cleared>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const canAssignOwner = hasProjectPermission(currentUserRole, "ASSIGN_RESOURCES");
  const canManageStakeholders = hasProjectPermission(
    currentUserRole,
    "MANAGE_STAKEHOLDERS",
  );
  const readOnly = !canAssignOwner && !canManageStakeholders;

  const outstanding = rows.filter((row) => !cleared[row.flagId]).length;
  const visibleRows = expanded ? rows : rows.slice(0, ROW_LIMIT);

  async function resolve(
    row: OwnershipGapRow,
    userId: string,
    raciRole: string | null,
  ): Promise<boolean> {
    const person = directory.users.find((u) => u.id === userId);
    setBusyId(row.flagId);
    try {
      if (row.category === "owner") {
        await patchJson(`/api/v1/projects/${row.projectId}`, {
          version: row.projectVersion,
          ownerId: userId,
        });
      } else {
        await postJson(`/api/v1/projects/${row.projectId}/stakeholders`, {
          userId,
          raciRole: raciRole ?? "CONSULTED",
        });
      }

      const detail =
        row.category === "owner"
          ? "now accountable"
          : `added as ${(raciRole ?? "CONSULTED").toLowerCase()}`;
      setCleared((prev) => ({
        ...prev,
        [row.flagId]: { personName: person?.name ?? "Someone", detail },
      }));
      toast.success(`${person?.name ?? "Person"} ${detail} on ${row.projectName}`);
      // Re-render the server component so the rest of the board (and this
      // project's own version token) reflects the change.
      router.refresh();
      return true;
    } catch (cause) {
      const message =
        cause instanceof ApiRequestError
          ? cause.message
          : "Couldn’t save that change. Try again.";
      toast.error(message);
      if (cause instanceof ApiRequestError && cause.status === 409) {
        router.refresh();
      }
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <BoardSection
      className={cn("rise-in [--i:1]", className)}
      controls={
        readOnly ? (
          <span className="text-caption-1 text-text-low">
            Read-only for your role
          </span>
        ) : undefined
      }
      count={
        rows.length === 0
          ? "nothing to clear"
          : outstanding === rows.length
            ? `${rows.length} to clear`
            : `${outstanding} of ${rows.length} left to clear`
      }
      footer={
        rows.length > ROW_LIMIT ? (
          <>
            <span className="font-data text-caption-2 tabular-nums text-text-low">
              {visibleRows.length} of {rows.length} shown
            </span>
            <Button
              className="h-auto p-0 text-caption-2 font-medium text-primary-high"
              onClick={() => setExpanded((v) => !v)}
              variant="link"
            >
              {expanded ? `Show the top ${ROW_LIMIT}` : `Show all ${rows.length}`}
            </Button>
          </>
        ) : undefined
      }
      headingId="board-ownership"
      label="Ownership"
    >
      {rows.length === 0 ? (
        <BoardEmpty tone="success">
          Every project has an accountable owner, and every approved project has
          at least one person consulted or informed.
        </BoardEmpty>
      ) : (
        <ol className="divide-y divide-outline-base">
          {visibleRows.map((row) => {
            const config = CATEGORY[row.category];
            const done = cleared[row.flagId];
            const permitted =
              row.category === "owner" ? canAssignOwner : canManageStakeholders;

            return (
              <li
                className="-mx-ds-md flex flex-col gap-ds-xxs rounded-lg px-ds-md py-ds-md transition-colors hover:bg-surface-2"
                key={row.flagId}
              >
                <div className="flex flex-wrap items-center gap-x-ds-md gap-y-ds-xxs">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 shrink-0 rounded-pill",
                      done ? "bg-success-med" : config.dot,
                    )}
                  />
                  <Link
                    className="min-w-0 shrink-0 truncate text-body-2 font-semibold text-text-high hover:text-primary-high sm:max-w-[15rem]"
                    href={`/projects/${row.projectId}?tab=raci`}
                  >
                    {row.projectName}
                  </Link>
                  <span
                    className={cn(
                      "shrink-0 rounded-sm border px-ds-sm py-[1px] text-caption-2 font-medium",
                      done
                        ? "border-success-outline bg-success-wash text-success-high"
                        : config.badge,
                    )}
                  >
                    {done ? `${done.personName} ${done.detail}` : config.what}
                  </span>

                  <div className="ml-auto shrink-0">
                    {done ? null : permitted ? (
                      <PersonPicker
                        busy={busyId === row.flagId}
                        description={config.hint}
                        heading={row.projectName}
                        label={config.action}
                        loadError={directory.error}
                        loading={directory.loading}
                        onOpen={directory.load}
                        onPick={(userId, raciRole) => resolve(row, userId, raciRole)}
                        roleChoices={
                          row.category === "visibility" ? RACI_CHOICES : undefined
                        }
                        users={directory.users}
                      />
                    ) : (
                      <Link
                        className="text-caption-2 font-semibold text-primary-high hover:underline"
                        href={`/projects/${row.projectId}?tab=raci`}
                      >
                        Open RACI
                      </Link>
                    )}
                  </div>
                </div>

                {!done && (
                  /* The monitor's narration runs several sentences — one
                     truncated line is what a scan row can carry, the full
                     text is a hover away (and always on the project's own
                     RACI tab). Given its own line under the title instead of
                     squeezed between the name and the CTA. */
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="ml-[0.875rem] max-w-2xl truncate text-caption-1 text-text-low">
                        {row.reason}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-pretty">
                      {row.reason}
                    </TooltipContent>
                  </Tooltip>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </BoardSection>
  );
}
