"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextInputField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { PlusIcon } from "@/components/ui/icons";
import { formatDate, todayIsoDate } from "@/lib/format";
import { ApiRequestError, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import type { ProjectDetail, ScopeChangeView } from "../types";
import {
  Block,
  Empty,
  FormActions,
  FormPanel,
  LOG_ROW,
  LogList,
  Num,
} from "./chrome";

export function OverviewSection({
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
  const canRecordScopeChange = hasProjectPermission(
    currentUserRole,
    "RECORD_SCOPE_CHANGE",
  );

  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [deliveryImpact, setDeliveryImpact] = useState("");
  const [newDate, setNewDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    reason?: string;
    newDate?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function closeForm() {
    setShowForm(false);
    setFieldErrors({});
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors: { reason?: string; newDate?: string } = {};
    if (!reason.trim()) errors.reason = "Say what changed and why.";
    if (newDate && newDate < todayIsoDate()) {
      errors.newDate = "A new delivery date in the past can’t be committed to.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      document
        .getElementById(errors.reason ? "scope-reason" : "scope-new-date")
        ?.focus();
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
      closeForm();
      toast.success("Scope change logged");
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn’t record the scope change.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-ds-9xl">
      <Block id="brief" eyebrow="The case" title="Brief">
        {/* Two long-form statements, set as prose rather than table cells:
            they are the argument for the project existing and are read, not
            scanned. Measure is capped so the lines stay tracked. */}
        <div className="grid gap-ds-7xl md:grid-cols-2">
          <Statement label="Business problem">{project.businessProblem}</Statement>
          <Statement label="Expected outcome">{project.expectedOutcome}</Statement>
        </div>
      </Block>

      <Block
        id="scope"
        eyebrow="Change log"
        title="Scope changes"
        count={scopeChanges.length}
        action={
          canRecordScopeChange && !showForm ? (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              <PlusIcon aria-hidden="true" /> Record scope change
            </Button>
          ) : null
        }
      >
        <LiveRegion>
          {error && (
            <div className="mb-ds-2xl">
              <InlineBanner
                tone="error"
                title="Couldn’t record scope change"
                onDismiss={() => setError(null)}
              >
                {error}
              </InlineBanner>
            </div>
          )}
        </LiveRegion>

        {showForm && (
          <div className="mb-ds-5xl">
            <FormPanel onSubmit={handleSubmit}>
              <TextAreaField
                id="scope-reason"
                label="Reason"
                hint="What changed in the ask, and who asked for it."
                value={reason}
                onChange={(value) => {
                  setReason(value);
                  setFieldErrors((current) => ({ ...current, reason: undefined }));
                }}
                required
                rows={3}
                error={fieldErrors.reason}
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
                hint={`Leave blank if delivery still holds at ${formatDate(
                  project.expectedDeliveryDate.slice(0, 10),
                )}.`}
                type="date"
                value={newDate}
                onChange={(value) => {
                  setNewDate(value);
                  setFieldErrors((current) => ({ ...current, newDate: undefined }));
                }}
                error={fieldErrors.newDate}
              />
              <FormActions>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting ? "Saving…" : "Record scope change"}
                </Button>
                <Button type="button" variant="ghost" onClick={closeForm}>
                  Cancel
                </Button>
              </FormActions>
            </FormPanel>
          </div>
        )}

        {scopeChanges.length === 0 ? (
          <Empty title="No scope changes recorded">
            When the ask changes after approval, record it here with its
            delivery impact. This log is what keeps a moved delivery date
            explainable months later.
          </Empty>
        ) : (
          <LogList>
            {scopeChanges.map((s) => (
              <li key={s.id} className={LOG_ROW}>
                <div className="min-w-0">
                  <p className="font-medium text-text-high">{s.reason}</p>
                  {s.deliveryImpact && (
                    <p className="mt-ds-xs max-w-[64ch] text-para text-text-med">
                      {s.deliveryImpact}
                    </p>
                  )}
                  {s.newExpectedDeliveryDate && (
                    <p className="mt-ds-md inline-flex flex-wrap items-center gap-ds-sm rounded-md bg-surface-2 px-ds-md py-ds-xs text-caption-2 text-text-med">
                      Delivery moved
                      {s.previousExpectedDeliveryDate && (
                        <>
                          <Num>
                            {formatDate(
                              s.previousExpectedDeliveryDate.slice(0, 10),
                            )}
                          </Num>
                          <span aria-hidden="true">→</span>
                        </>
                      )}
                      <span className="font-data font-semibold tabular-nums text-text-high">
                        {formatDate(s.newExpectedDeliveryDate.slice(0, 10))}
                      </span>
                    </p>
                  )}
                  <p className="mt-ds-md text-caption-2 text-text-low">
                    {s.requestedByName} ·{" "}
                    <Num>{formatDate(s.createdAt.slice(0, 10))}</Num>
                  </p>
                </div>
              </li>
            ))}
          </LogList>
        )}
      </Block>
    </div>
  );
}

function Statement({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l-2 border-outline-med pl-ds-5xl">
      <p className="annotation">{label}</p>
      <p className="mt-ds-md max-w-[58ch] text-pretty text-body-2 text-text-high">
        {children}
      </p>
    </div>
  );
}
