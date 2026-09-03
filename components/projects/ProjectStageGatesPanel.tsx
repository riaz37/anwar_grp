"use client";

import { useState } from "react";
import type { ProjectStage, Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { CheckIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { ApiRequestError, patchJson, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import { nextStage, STAGE_LABELS } from "./projectTone";
import type { ChecklistItemView, StageHistoryView } from "./types";

export function ProjectStageGatesPanel({
  projectId,
  currentStage,
  checklistItems,
  stageHistory,
  currentUserRole,
  onChanged,
}: {
  projectId: string;
  currentStage: ProjectStage;
  checklistItems: ChecklistItemView[];
  stageHistory: StageHistoryView[];
  currentUserRole: Role;
  onChanged: () => void;
}) {
  const canToggle = hasProjectPermission(currentUserRole, "TOGGLE_CHECKLIST_ITEM");
  const canTransition = hasProjectPermission(currentUserRole, "TRANSITION_STAGE");

  const [error, setError] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const upcoming = nextStage(currentStage);
  const outstandingRequired = checklistItems.filter((i) => i.required && !i.checked);
  const gateSatisfied = outstandingRequired.length === 0;

  async function toggle(item: ChecklistItemView) {
    setBusyItemId(item.id);
    setError(null);
    try {
      await patchJson(`/api/v1/projects/${projectId}/checklist/${item.id}`, {
        checked: !item.checked,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t update the checklist item.");
    } finally {
      setBusyItemId(null);
    }
  }

  async function advance() {
    if (!upcoming) return;
    setAdvancing(true);
    setError(null);
    try {
      await postJson(`/api/v1/projects/${projectId}/stage-transition`, { toStage: upcoming });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t advance the stage.");
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="flex flex-col gap-xl">
      <LiveRegion>
        {error && (
          <InlineBanner tone="error" title="Stage action failed">
            {error}
          </InlineBanner>
        )}
      </LiveRegion>

      <section>
        <h3 className="text-body font-semibold text-text">
          {STAGE_LABELS[currentStage]} exit criteria
        </h3>
        {checklistItems.length === 0 ? (
          <p className="mt-sm text-body-sm text-muted">
            This stage has no fixed exit criteria — it can be advanced directly.
          </p>
        ) : (
          <ul className="mt-md flex flex-col gap-xs">
            {checklistItems.map((item) => (
              <li
                key={item.id}
                className="flex min-h-11 items-center gap-sm rounded-sm border border-border px-sm py-xs"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.checked}
                  disabled={!canToggle || busyItemId === item.id}
                  onClick={() => toggle(item)}
                  className={`flex size-6 shrink-0 items-center justify-center rounded-sm border transition-colors duration-100 ease-move ${
                    item.checked
                      ? "border-success bg-success text-surface"
                      : "border-border-strong bg-surface"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {item.checked && <CheckIcon aria-hidden="true" />}
                </button>
                <span className={`flex-1 text-body-sm ${item.checked ? "text-muted line-through" : "text-text"}`}>
                  {item.label}
                </span>
                {!item.required && (
                  <span className="text-caption text-muted">optional</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-md flex items-center gap-sm">
          {upcoming ? (
            <Button
              variant="primary"
              onClick={advance}
              disabled={!canTransition || !gateSatisfied || advancing}
            >
              {advancing ? "Advancing…" : `Advance to ${STAGE_LABELS[upcoming]}`}
            </Button>
          ) : (
            <span className="text-body-sm text-muted">This project has reached its final stage.</span>
          )}
          {upcoming && !gateSatisfied && (
            <span className="text-body-sm text-muted">
              {outstandingRequired.length} required item{outstandingRequired.length === 1 ? "" : "s"} remaining
            </span>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-body font-semibold text-text">Stage history</h3>
        {stageHistory.length === 0 ? (
          <p className="mt-sm text-body-sm text-muted">No stage transitions yet.</p>
        ) : (
          <ol className="mt-md flex flex-col gap-sm">
            {stageHistory.map((h) => (
              <li key={h.id} className="rounded-md border border-border p-md text-body-sm">
                <p className="text-text">
                  {h.fromStage ? `${STAGE_LABELS[h.fromStage]} → ` : ""}
                  <span className="font-medium">{STAGE_LABELS[h.toStage]}</span>
                </p>
                <p className="mt-2xs text-caption text-muted">
                  {h.actorName} — {formatDateTime(h.changedAt)}
                </p>
                {h.notes && <p className="mt-2xs text-muted">{h.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
