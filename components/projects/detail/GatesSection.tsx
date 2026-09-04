"use client";

import { useState } from "react";
import type { ProjectStage, Role } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { Checkbox } from "@/components/ui/primitives/checkbox";
import { formatDateTime } from "@/lib/format";
import { ApiRequestError, patchJson, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import { cn } from "@/lib/utils";
import { nextStage, STAGE_LABELS } from "../projectTone";
import type { ChecklistItemView, StageHistoryView } from "../types";
import { Block, Empty, LOG_ROW, LogList, Num } from "./chrome";

export function GatesSection({
  projectId,
  currentStage,
  checklistItems,
  stageHistory,
  readiness,
  currentUserRole,
  onChanged,
}: {
  projectId: string;
  currentStage: ProjectStage;
  checklistItems: ChecklistItemView[];
  stageHistory: StageHistoryView[];
  readiness: { total: number; checked: number; percent: number };
  currentUserRole: Role;
  onChanged: () => void;
}) {
  const canToggle = hasProjectPermission(currentUserRole, "TOGGLE_CHECKLIST_ITEM");
  const canTransition = hasProjectPermission(currentUserRole, "TRANSITION_STAGE");

  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const upcoming = nextStage(currentStage);
  const requiredCount = checklistItems.filter((i) => i.required).length;
  const outstandingRequired = checklistItems.filter(
    (i) => i.required && !i.checked,
  );
  const gateSatisfied = outstandingRequired.length === 0;

  async function toggle(item: ChecklistItemView) {
    setBusyItemId(item.id);
    setError(null);
    try {
      await patchJson(`/api/v1/projects/${projectId}/checklist/${item.id}`, {
        checked: !item.checked,
      });
      toast.success("Checklist updated");
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn’t update the checklist item.",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function advance() {
    if (!upcoming) return;
    setAdvancing(true);
    setError(null);
    try {
      await postJson(`/api/v1/projects/${projectId}/stage-transition`, {
        toStage: upcoming,
      });
      toast.success("Stage advanced");
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Couldn’t advance the stage.",
      );
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="flex flex-col gap-ds-9xl">
      <LiveRegion>
        {error && (
          <InlineBanner
            tone="error"
            title="Stage action failed"
            onDismiss={() => setError(null)}
          >
            {error}
          </InlineBanner>
        )}
      </LiveRegion>

      <Block
        id="gate"
        eyebrow="Exit criteria"
        title={STAGE_LABELS[currentStage]}
        description={
          checklistItems.length === 0
            ? "This stage has no fixed exit criteria, so it can be advanced directly."
            : undefined
        }
      >
        {checklistItems.length > 0 && (
          <>
            {/* Readiness as a run of ticks, one per criterion: it answers
                "how many are left" at a glance without a chart, and stays
                honest when a stage has three items rather than twenty. */}
            <div className="mb-ds-5xl flex flex-wrap items-center gap-x-ds-5xl gap-y-ds-md">
              <div className="flex items-center gap-ds-xl">
                <span
                  aria-hidden="true"
                  className="flex gap-[3px]"
                >
                  {checklistItems.map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "h-1.5 w-6 rounded-[2px]",
                        item.checked
                          ? "bg-success-med"
                          : item.required
                            ? "bg-outline-high"
                            : "bg-outline-med",
                      )}
                    />
                  ))}
                </span>
                <p className="text-body-1 text-muted-foreground">
                  <Num>
                    {readiness.checked}/{readiness.total}
                  </Num>{" "}
                  done
                  {requiredCount > 0 && (
                    <>
                      {" · "}
                      <Num>
                        {requiredCount - outstandingRequired.length}/{requiredCount}
                      </Num>{" "}
                      required
                    </>
                  )}
                </p>
              </div>
            </div>

            <ul className="-mx-ds-md divide-y divide-outline-low border-y border-outline-low">
              {checklistItems.map((item) => (
                <li
                  key={item.id}
                  className="flex min-h-12 items-center gap-ds-xl px-ds-md py-ds-md transition-colors duration-100 hover:bg-surface-1"
                >
                  {/* Radix Checkbox: real `role="checkbox"` semantics plus
                      Space-to-toggle and a `data-state` hook. Checked uses
                      `success`, not the accent — a satisfied gate criterion
                      is a status, and DESIGN.md §1 reserves semantic colour
                      for exactly that. */}
                  <Checkbox
                    checked={item.checked}
                    aria-busy={busyItemId === item.id}
                    aria-label={`${item.label}${item.required ? "" : " (optional)"}`}
                    disabled={!canToggle || busyItemId === item.id}
                    onCheckedChange={() => toggle(item)}
                    className="size-5 shrink-0 rounded-sm border-input bg-surface-0 transition-colors duration-100 ease-[var(--ease-move)] hover:border-primary-med hover:bg-primary-wash data-[state=checked]:border-success-outline data-[state=checked]:bg-success-med data-[state=checked]:text-surface-shell disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-outline-high disabled:hover:bg-surface-0"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex-1 text-body-1",
                      item.checked
                        ? "text-text-low line-through"
                        : "text-text-high",
                    )}
                  >
                    {item.label}
                  </span>
                  {!item.required && (
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-caption-2 text-text-low"
                    >
                      optional
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* The advance control is the one primary action on this page, so it
            sits alone on a raised strip with its blocking reason beside it —
            a disabled button whose reason is only in a tooltip is not a
            reason anyone can read. */}
        <div className="mt-ds-5xl flex flex-wrap items-center gap-x-ds-5xl gap-y-ds-md rounded-xl border border-outline-low bg-surface-1 px-ds-5xl py-ds-2xl">
          {upcoming ? (
            <Button
              variant="primary"
              onClick={advance}
              disabled={!canTransition || !gateSatisfied || advancing}
              aria-busy={advancing}
              aria-describedby={
                !canTransition
                  ? "advance-permission"
                  : !gateSatisfied
                    ? "advance-outstanding"
                    : undefined
              }
            >
              {advancing ? "Advancing…" : `Advance to ${STAGE_LABELS[upcoming]}`}
            </Button>
          ) : (
            <p className="text-body-1 text-muted-foreground">
              This project has reached its final stage.
            </p>
          )}
          {upcoming && !canTransition && (
            <p id="advance-permission" className="text-body-1 text-muted-foreground">
              Your role can’t move this project between stages.
            </p>
          )}
          {upcoming && canTransition && !gateSatisfied && (
            <p id="advance-outstanding" className="text-body-1 text-muted-foreground">
              <span className="font-data font-semibold tabular-nums text-warn-high">
                {outstandingRequired.length}
              </span>{" "}
              required item{outstandingRequired.length === 1 ? "" : "s"} remaining
            </p>
          )}
        </div>
      </Block>

      <Block
        id="stage-history"
        eyebrow="Audit trail"
        title="Stage history"
        count={stageHistory.length}
      >
        {stageHistory.length === 0 ? (
          <Empty title="No stage transitions yet">
            This project is still at {STAGE_LABELS[currentStage]}. Every move
            forward is recorded here with who made it and when, so the pipeline
            stays auditable.
          </Empty>
        ) : (
          <LogList>
            {stageHistory.map((h) => (
              <li key={h.id} className={LOG_ROW}>
                <p className="flex flex-wrap items-baseline gap-ds-sm">
                  {h.fromStage && (
                    <>
                      <span className="text-text-low">
                        {STAGE_LABELS[h.fromStage]}
                      </span>
                      <span aria-hidden="true" className="text-text-low">
                        →
                      </span>
                    </>
                  )}
                  <span className="font-medium text-text-high">
                    {STAGE_LABELS[h.toStage]}
                  </span>
                </p>
                {h.notes && (
                  <p className="mt-ds-xs max-w-[64ch] text-para text-text-med">
                    {h.notes}
                  </p>
                )}
                <p className="mt-ds-md text-caption-2 text-text-low">
                  {h.actorName} · <Num>{formatDateTime(h.changedAt)}</Num>
                </p>
              </li>
            ))}
          </LogList>
        )}
      </Block>
    </div>
  );
}
