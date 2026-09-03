"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextInputField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { Pill } from "@/components/ui/StatusPill";
import { PlusIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { ApiRequestError, patchJson, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import type { BlockerView } from "./types";

export function ProjectBlockersPanel({
  projectId,
  blockers,
  currentUserRole,
  onChanged,
}: {
  projectId: string;
  blockers: BlockerView[];
  currentUserRole: Role;
  onChanged: () => void;
}) {
  const canRecord = hasProjectPermission(currentUserRole, "RECORD_BLOCKER");
  const canResolve = hasProjectPermission(currentUserRole, "RESOLVE_BLOCKER");

  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("");
  const [requiredAction, setRequiredAction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const unresolved = blockers.filter((b) => !b.resolvedAt);
  const resolved = blockers.filter((b) => b.resolvedAt);

  async function createBlocker(event: React.FormEvent) {
    event.preventDefault();
    if (!description.trim() || !impact.trim()) {
      setError("Description and impact are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await postJson(`/api/v1/projects/${projectId}/blockers`, {
        description: description.trim(),
        impact: impact.trim(),
        requiredAction: requiredAction.trim() || undefined,
      });
      setDescription("");
      setImpact("");
      setRequiredAction("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t record the blocker.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resolve(blocker: BlockerView) {
    setError(null);
    try {
      await patchJson(`/api/v1/projects/${projectId}/blockers/${blocker.id}`, {
        resolve: true,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });
      setResolvingId(null);
      setResolutionNotes("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t resolve the blocker.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-body font-semibold text-text">Blockers</h3>
        {canRecord && !showForm && (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            <PlusIcon /> Record blocker
          </Button>
        )}
      </div>

      <LiveRegion>
        {error && (
          <InlineBanner tone="error" title="Blocker action failed">
            {error}
          </InlineBanner>
        )}
      </LiveRegion>

      {showForm && (
        <form onSubmit={createBlocker} className="mt-md flex max-w-[560px] flex-col gap-md rounded-md border border-border p-md">
          <TextAreaField id="blocker-description" label="Description" value={description} onChange={setDescription} required rows={2} />
          <TextAreaField id="blocker-impact" label="Impact" value={impact} onChange={setImpact} required rows={2} />
          <TextInputField id="blocker-action" label="Required action" value={requiredAction} onChange={setRequiredAction} />
          <div className="flex gap-sm">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Recording…" : "Record"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {unresolved.length === 0 && resolved.length === 0 ? (
        <p className="mt-md text-body-sm text-muted">No blockers recorded.</p>
      ) : (
        <div className="mt-md flex flex-col gap-lg">
          {unresolved.length > 0 && (
            <ul className="flex flex-col gap-sm">
              {unresolved.map((b) => (
                <li key={b.id} className="rounded-md border border-error-soft bg-error-soft/40 p-md text-body-sm">
                  <div className="flex flex-wrap items-center gap-sm">
                    <Pill tone="error" label="Unresolved" />
                    <span className="font-medium text-text">{b.description}</span>
                  </div>
                  <p className="mt-2xs text-muted">Impact: {b.impact}</p>
                  {b.requiredAction && <p className="mt-2xs text-muted">Required action: {b.requiredAction}</p>}
                  <p className="mt-2xs text-caption text-muted">
                    Raised by {b.raisedByName} — {formatDateTime(b.createdAt)}
                  </p>

                  {canResolve && (
                    resolvingId === b.id ? (
                      <div className="mt-sm flex flex-wrap items-end gap-sm">
                        <div className="w-64">
                          <TextInputField
                            id={`resolve-notes-${b.id}`}
                            label="Resolution notes"
                            value={resolutionNotes}
                            onChange={setResolutionNotes}
                          />
                        </div>
                        <Button variant="primary" onClick={() => resolve(b)}>
                          Confirm resolve
                        </Button>
                        <Button variant="ghost" onClick={() => setResolvingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-sm">
                        <Button variant="secondary" onClick={() => setResolvingId(b.id)}>
                          Resolve
                        </Button>
                      </div>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}

          {resolved.length > 0 && (
            <ul className="flex flex-col gap-sm">
              {resolved.map((b) => (
                <li key={b.id} className="rounded-md border border-border p-md text-body-sm">
                  <div className="flex flex-wrap items-center gap-sm">
                    <Pill tone="success" label="Resolved" />
                    <span className="font-medium text-text">{b.description}</span>
                  </div>
                  <p className="mt-2xs text-muted">Impact: {b.impact}</p>
                  {b.resolutionNotes && <p className="mt-2xs text-muted">{b.resolutionNotes}</p>}
                  <p className="mt-2xs text-caption text-muted">
                    Raised by {b.raisedByName} — resolved by {b.resolvedByName} at{" "}
                    {b.resolvedAt && formatDateTime(b.resolvedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
