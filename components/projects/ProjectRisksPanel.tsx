"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextInputField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { Pill } from "@/components/ui/StatusPill";
import type { Tone } from "@/components/ui/tone";
import { PlusIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { ApiRequestError, patchJson, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import type { RefUser } from "./types";
import { Block, Empty, FormActions, FormPanel, LOG_ROW, Num, Subhead } from "./detail/chrome";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type RiskStatus = "OPEN" | "MITIGATING" | "RESOLVED" | "ACCEPTED";

export interface RiskView {
  id: string;
  title: string;
  description: string;
  likelihood: RiskLevel;
  impact: RiskLevel;
  severity: number;
  status: RiskStatus;
  mitigationPlan: string | null;
  ownerId: string;
  ownerName: string;
  raisedByName: string;
  identifiedAt: string;
  resolvedAt: string | null;
}

const LEVEL_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
];

const STATUS_OPTIONS: { value: RiskStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "MITIGATING", label: "Mitigating" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ACCEPTED", label: "Accepted" },
];

const SEVERITY_TONE: Record<number, Tone> = {
  1: "neutral",
  2: "warning",
  3: "error",
};

const SEVERITY_LABEL: Record<number, string> = {
  1: "Low severity",
  2: "Medium severity",
  3: "High severity",
};

const STATUS_TONE: Record<RiskStatus, Tone> = {
  OPEN: "error",
  MITIGATING: "warning",
  RESOLVED: "success",
  ACCEPTED: "neutral",
};

const STATUS_LABELS: Record<RiskStatus, string> = {
  OPEN: "Open",
  MITIGATING: "Mitigating",
  RESOLVED: "Resolved",
  ACCEPTED: "Accepted",
};

type RiskFieldErrors = {
  title?: string;
  description?: string;
  ownerId?: string;
};

export function ProjectRisksPanel({
  projectId,
  risks,
  users,
  currentUserRole,
  onChanged,
}: {
  projectId: string;
  risks: RiskView[];
  users: RefUser[];
  currentUserRole: Role;
  onChanged: () => void;
}) {
  const canRecord = hasProjectPermission(currentUserRole, "RECORD_RISK");
  const canManageStatus = hasProjectPermission(currentUserRole, "MANAGE_RISK_STATUS");
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [likelihood, setLikelihood] = useState<RiskLevel>("MEDIUM");
  const [impact, setImpact] = useState<RiskLevel>("MEDIUM");
  const [ownerId, setOwnerId] = useState("");
  const [mitigationPlan, setMitigationPlan] = useState("");
  const [fieldErrors, setFieldErrors] = useState<RiskFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [transitionNote, setTransitionNote] = useState("");
  const [transitionStatus, setTransitionStatus] = useState<RiskStatus>("MITIGATING");
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const open = risks.filter((r) => r.status === "OPEN" || r.status === "MITIGATING");
  const closed = risks.filter((r) => r.status === "RESOLVED" || r.status === "ACCEPTED");

  function closeForm() {
    setShowForm(false);
    setFieldErrors({});
    setError(null);
  }

  async function createRisk(event: React.FormEvent) {
    event.preventDefault();
    const errors: RiskFieldErrors = {};
    if (!title.trim()) errors.title = "Name the risk in one sentence.";
    if (!description.trim()) errors.description = "Describe the risk in more detail.";
    if (!ownerId) errors.ownerId = "Choose who owns this risk.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await postJson(`/api/v1/projects/${projectId}/risks`, {
        title: title.trim(),
        description: description.trim(),
        likelihood,
        impact,
        ownerId,
        mitigationPlan: mitigationPlan.trim() || undefined,
      });
      setTitle("");
      setDescription("");
      setLikelihood("MEDIUM");
      setImpact("MEDIUM");
      setOwnerId("");
      setMitigationPlan("");
      closeForm();
      toast.success("Risk recorded");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t record the risk.");
    } finally {
      setSubmitting(false);
    }
  }

  async function transition(event: React.FormEvent, risk: RiskView) {
    event.preventDefault();
    setError(null);
    setTransitionSubmitting(true);
    try {
      await patchJson(`/api/v1/projects/${projectId}/risks/${risk.id}`, {
        status: transitionStatus,
        note: transitionNote.trim() || undefined,
      });
      setTransitioningId(null);
      setTransitionNote("");
      toast.success("Risk status updated");
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Couldn’t update the risk status.",
      );
    } finally {
      setTransitionSubmitting(false);
    }
  }

  return (
    <Block
      id="risks"
      eyebrow="Forward-looking"
      title="Risks"
      count={open.length}
      action={
        canRecord && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            <PlusIcon aria-hidden="true" /> Record risk
          </Button>
        ) : null
      }
    >
      <LiveRegion>
        {error && (
          <div className="mb-ds-2xl">
            <InlineBanner tone="error" title="Risk action failed" onDismiss={() => setError(null)}>
              {error}
            </InlineBanner>
          </div>
        )}
      </LiveRegion>

      {showForm && (
        <div className="mb-ds-5xl">
          <FormPanel onSubmit={createRisk}>
            <TextInputField
              id="risk-title"
              label="Title"
              hint="Name the risk in one sentence."
              value={title}
              onChange={(value) => {
                setTitle(value);
                setFieldErrors((current) => ({ ...current, title: undefined }));
              }}
              required
              error={fieldErrors.title}
            />
            <TextAreaField
              id="risk-description"
              label="Description"
              value={description}
              onChange={(value) => {
                setDescription(value);
                setFieldErrors((current) => ({ ...current, description: undefined }));
              }}
              required
              rows={2}
              error={fieldErrors.description}
            />
            <SelectField
              id="risk-likelihood"
              label="Likelihood"
              value={likelihood}
              onChange={(value) => setLikelihood(value as RiskLevel)}
              options={LEVEL_OPTIONS}
              required
            />
            <SelectField
              id="risk-impact"
              label="Impact"
              value={impact}
              onChange={(value) => setImpact(value as RiskLevel)}
              options={LEVEL_OPTIONS}
              required
            />
            <SelectField
              id="risk-owner"
              label="Owner"
              hint="Who owns tracking and mitigating this risk."
              value={ownerId}
              onChange={(value) => {
                setOwnerId(value);
                setFieldErrors((current) => ({ ...current, ownerId: undefined }));
              }}
              options={userOptions}
              required
              error={fieldErrors.ownerId}
            />
            <TextAreaField
              id="risk-mitigation"
              label="Mitigation plan"
              value={mitigationPlan}
              onChange={setMitigationPlan}
              rows={2}
            />
            <FormActions>
              <Button type="submit" variant="primary" disabled={submitting} aria-busy={submitting}>
                {submitting ? "Recording…" : "Record risk"}
              </Button>
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
            </FormActions>
          </FormPanel>
        </div>
      )}

      {risks.length === 0 ? (
        <Empty title="No risks recorded">
          Record a risk before it becomes a blocker or a delay: likelihood,
          impact, an owner, and a mitigation plan once you have one.
        </Empty>
      ) : (
        <div className="flex flex-col gap-ds-9xl">
          {open.length > 0 && (
            <section aria-label="Open risks">
              <Subhead count={open.length}>Open</Subhead>
              <ul className="mt-ds-2xl flex flex-col gap-ds-2xl">
                {open.map((risk) => (
                  <li
                    key={risk.id}
                    className="rounded-xl border border-outline-low bg-surface-1 p-ds-5xl"
                  >
                    <div className="flex flex-wrap items-start gap-ds-2xl">
                      <Pill tone={SEVERITY_TONE[risk.severity]} label={SEVERITY_LABEL[risk.severity]} />
                      <Pill tone={STATUS_TONE[risk.status]} label={STATUS_LABELS[risk.status]} />
                      <p className="min-w-[16rem] flex-1 text-body-2 font-semibold text-text-high">
                        {risk.title}
                      </p>
                    </div>

                    <p className="mt-ds-2xl max-w-[64ch] text-para text-text-high">
                      {risk.description}
                    </p>

                    <dl className="mt-ds-2xl grid gap-ds-xl sm:grid-cols-2">
                      <div>
                        <dt className="annotation">Likelihood / impact</dt>
                        <dd className="mt-ds-xxs text-para text-text-high">
                          {risk.likelihood} / {risk.impact}
                        </dd>
                      </div>
                      <div>
                        <dt className="annotation">Owner</dt>
                        <dd className="mt-ds-xxs text-para text-text-high">{risk.ownerName}</dd>
                      </div>
                      {risk.mitigationPlan && (
                        <div className="sm:col-span-2">
                          <dt className="annotation">Mitigation plan</dt>
                          <dd className="mt-ds-xxs max-w-[64ch] text-para text-text-high">
                            {risk.mitigationPlan}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <p className="mt-ds-2xl text-caption-2 text-muted-foreground">
                      Raised by {risk.raisedByName} · <Num>{formatDateTime(risk.identifiedAt)}</Num>
                    </p>

                    {canManageStatus &&
                      (transitioningId === risk.id ? (
                        <form
                          onSubmit={(event) => transition(event, risk)}
                          className="mt-ds-2xl flex flex-wrap items-end gap-ds-md border-t border-outline-low pt-ds-2xl"
                        >
                          <div className="min-w-0 flex-1 sm:max-w-56">
                            <SelectField
                              id={`risk-status-${risk.id}`}
                              label="New status"
                              value={transitionStatus}
                              onChange={(value) => setTransitionStatus(value as RiskStatus)}
                              options={STATUS_OPTIONS}
                              required
                            />
                          </div>
                          <div className="min-w-0 flex-1 sm:max-w-80">
                            <TextInputField
                              id={`risk-note-${risk.id}`}
                              label="Note"
                              value={transitionNote}
                              onChange={setTransitionNote}
                            />
                          </div>
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={transitionSubmitting}
                            aria-busy={transitionSubmitting}
                          >
                            {transitionSubmitting ? "Updating…" : "Confirm"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setTransitioningId(null);
                              setTransitionNote("");
                            }}
                          >
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <div className="mt-ds-2xl">
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setTransitioningId(risk.id);
                              setTransitionStatus(
                                risk.status === "OPEN" ? "MITIGATING" : "RESOLVED",
                              );
                              setTransitionNote("");
                            }}
                          >
                            Change status
                          </Button>
                        </div>
                      ))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {closed.length > 0 && (
            <section aria-label="Closed risks">
              <Subhead count={closed.length}>Closed</Subhead>
              <ol className="mt-ds-2xl -mx-ds-md divide-y divide-outline-low border-y border-outline-low">
                {closed.map((risk) => (
                  <li key={risk.id} className={LOG_ROW}>
                    <div className="flex flex-wrap items-start gap-ds-xl">
                      <Pill tone={STATUS_TONE[risk.status]} label={STATUS_LABELS[risk.status]} />
                      <p className="min-w-[14rem] flex-1 font-medium text-text-high">
                        {risk.title}
                      </p>
                    </div>
                    <p className="mt-ds-md max-w-[64ch] text-para text-text-med">
                      {risk.description}
                    </p>
                    <p className="mt-ds-md text-caption-2 text-text-low">
                      Owner {risk.ownerName}
                      {risk.resolvedAt && (
                        <>
                          {" · "}
                          <Num>{formatDateTime(risk.resolvedAt)}</Num>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </Block>
  );
}
