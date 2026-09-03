"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { DetailList, DetailItem } from "@/components/ui/DetailList";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextInputField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { formatDate } from "@/lib/format";
import { ApiRequestError, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import { HEALTH_LABELS, HEALTH_TONE, STAGE_LABELS } from "./projectTone";
import type { ProjectDetail, ScopeChangeView } from "./types";
import { Pill } from "@/components/ui/StatusPill";

export function ProjectOverviewPanel({
  project,
  scopeChanges,
  currentUserRole,
  onChanged,
}: {
  project: ProjectDetail;
  scopeChanges: ScopeChangeView[];
  currentUserRole: Role;
  onChanged: () => void;
}) {
  const canRecordScopeChange = hasProjectPermission(currentUserRole, "RECORD_SCOPE_CHANGE");

  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [deliveryImpact, setDeliveryImpact] = useState("");
  const [newDate, setNewDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await postJson(`/api/v1/projects/${project.id}/scope-changes`, {
        reason: reason.trim(),
        deliveryImpact: deliveryImpact.trim() || undefined,
        newExpectedDeliveryDate: newDate || undefined,
      });
      setReason("");
      setDeliveryImpact("");
      setNewDate("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t record the scope change.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-xl">
      <DetailList columns={2}>
        <DetailItem label="Current stage">{STAGE_LABELS[project.currentStage]}</DetailItem>
        <DetailItem label="Health">
          <Pill tone={HEALTH_TONE[project.health]} label={HEALTH_LABELS[project.health]} />
        </DetailItem>
        <DetailItem label="Expected delivery" numeric>
          {formatDate(project.expectedDeliveryDate.slice(0, 10))}
        </DetailItem>
        <DetailItem label="Business unit / Department">
          {project.businessUnit.name} / {project.department.name}
        </DetailItem>
        <DetailItem label="Business problem" span>
          {project.businessProblem}
        </DetailItem>
        <DetailItem label="Expected outcome" span>
          {project.expectedOutcome}
        </DetailItem>
      </DetailList>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-body font-semibold text-text">Scope changes</h3>
          {canRecordScopeChange && !showForm && (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              Record scope change
            </Button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-md flex max-w-[560px] flex-col gap-md rounded-md border border-border p-md">
            <LiveRegion>
              {error && (
                <InlineBanner tone="error" title="Couldn’t record scope change">
                  {error}
                </InlineBanner>
              )}
            </LiveRegion>
            <TextAreaField
              id="scope-reason"
              label="Reason"
              value={reason}
              onChange={setReason}
              required
              rows={3}
            />
            <TextAreaField
              id="scope-impact"
              label="Impact on delivery"
              value={deliveryImpact}
              onChange={setDeliveryImpact}
              rows={2}
            />
            <TextInputField
              id="scope-new-date"
              label="New expected delivery date"
              type="date"
              value={newDate}
              onChange={setNewDate}
            />
            <div className="flex gap-sm">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {scopeChanges.length === 0 ? (
          <p className="mt-md text-body-sm text-muted">No scope changes recorded.</p>
        ) : (
          <ul className="mt-md flex flex-col gap-sm">
            {scopeChanges.map((s) => (
              <li key={s.id} className="rounded-md border border-border p-md text-body-sm">
                <p className="font-medium text-text">{s.reason}</p>
                {s.deliveryImpact && <p className="mt-2xs text-muted">{s.deliveryImpact}</p>}
                {s.newExpectedDeliveryDate && (
                  <p className="mt-2xs text-muted">
                    Delivery date changed
                    {s.previousExpectedDeliveryDate &&
                      ` from ${formatDate(s.previousExpectedDeliveryDate.slice(0, 10))}`}{" "}
                    to {formatDate(s.newExpectedDeliveryDate.slice(0, 10))}
                  </p>
                )}
                <p className="mt-2xs text-caption text-muted">
                  Requested by {s.requestedByName} — {formatDate(s.createdAt.slice(0, 10))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
