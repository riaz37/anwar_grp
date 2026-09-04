"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextInputField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { Pill } from "@/components/ui/StatusPill";
import { PlusIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/format";
import { ApiRequestError, patchJson, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import type { BlockerView } from "../types";
import {
  Block,
  Empty,
  FormActions,
  FormPanel,
  LOG_ROW,
  Num,
  Subhead,
} from "./chrome";

type BlockerFieldErrors = { description?: string; impact?: string };

export function BlockersSection({
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
  const [fieldErrors, setFieldErrors] = useState<BlockerFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  const unresolved = blockers.filter((b) => !b.resolvedAt);
  const resolved = blockers.filter((b) => b.resolvedAt);

  function closeForm() {
    setShowForm(false);
    setFieldErrors({});
    setError(null);
  }

  async function createBlocker(event: React.FormEvent) {
    event.preventDefault();
    const errors: BlockerFieldErrors = {};
    if (!description.trim()) errors.description = "Describe what is blocked.";
    if (!impact.trim()) errors.impact = "State what this stops or delays.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      document
        .getElementById(errors.description ? "blocker-description" : "blocker-impact")
        ?.focus();
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
      closeForm();
      toast.success("Blocker raised");
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Couldn’t record the blocker.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resolve(event: React.FormEvent, blocker: BlockerView) {
    event.preventDefault();
    setError(null);
    setResolveSubmitting(true);
    try {
      await patchJson(`/api/v1/projects/${projectId}/blockers/${blocker.id}`, {
        resolve: true,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });
      setResolvingId(null);
      setResolutionNotes("");
      toast.success("Blocker resolved");
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Couldn’t resolve the blocker.",
      );
    } finally {
      setResolveSubmitting(false);
    }
  }

  return (
    <Block
      id="blockers"
      eyebrow="Outside dependencies"
      title="Blockers"
      count={unresolved.length}
      action={
        canRecord && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            <PlusIcon aria-hidden="true" /> Record blocker
          </Button>
        ) : null
      }
    >
      <LiveRegion>
        {error && (
          <div className="mb-ds-2xl">
            <InlineBanner
              tone="error"
              title="Blocker action failed"
              onDismiss={() => setError(null)}
            >
              {error}
            </InlineBanner>
          </div>
        )}
      </LiveRegion>

      {showForm && (
        <div className="mb-ds-5xl">
          <FormPanel onSubmit={createBlocker}>
            <TextAreaField
              id="blocker-description"
              label="Description"
              hint="What is stuck, in one sentence."
              value={description}
              onChange={(value) => {
                setDescription(value);
                setFieldErrors((current) => ({ ...current, description: undefined }));
              }}
              required
              rows={2}
              error={fieldErrors.description}
            />
            <TextAreaField
              id="blocker-impact"
              label="Impact"
              hint="What it stops or delays: a milestone, a stage gate, the delivery date."
              value={impact}
              onChange={(value) => {
                setImpact(value);
                setFieldErrors((current) => ({ ...current, impact: undefined }));
              }}
              required
              rows={2}
              error={fieldErrors.impact}
            />
            <TextInputField
              id="blocker-action"
              label="Required action"
              hint="The single move that would clear it, and who has to make it."
              value={requiredAction}
              onChange={setRequiredAction}
            />
            <FormActions>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "Recording…" : "Record blocker"}
              </Button>
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
            </FormActions>
          </FormPanel>
        </div>
      )}

      {unresolved.length === 0 && resolved.length === 0 ? (
        <Empty title="Nothing is blocked">
          Record a blocker the moment progress depends on someone outside this
          project: a decision, an approval, an environment, a dataset. Every open
          blocker names the action that would clear it, and who owes it.
        </Empty>
      ) : (
        <div className="flex flex-col gap-ds-9xl">
          {unresolved.length > 0 && (
            <section aria-label="Open blockers">
              <Subhead count={unresolved.length}>Open</Subhead>
              {/* Open blockers are the only tinted surfaces on the page. They
                  are the one thing a reader must not scroll past, so they get
                  a filled card while everything else stays hairline-flat. */}
              <ul className="mt-ds-2xl flex flex-col gap-ds-2xl">
                {unresolved.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-xl border border-danger-outline bg-danger-wash p-ds-5xl"
                  >
                    <div className="flex flex-wrap items-start gap-ds-2xl">
                      <Pill tone="error" label="Open" />
                      <p className="min-w-[16rem] flex-1 text-body-2 font-semibold text-text-high">
                        {b.description}
                      </p>
                    </div>

                    <dl className="mt-ds-2xl grid gap-ds-xl sm:grid-cols-2">
                      <div>
                        <dt className="annotation">Impact</dt>
                        <dd className="mt-ds-xxs max-w-[48ch] text-para text-text-high">
                          {b.impact}
                        </dd>
                      </div>
                      {b.requiredAction && (
                        <div>
                          <dt className="annotation">Required action</dt>
                          <dd className="mt-ds-xxs max-w-[48ch] text-para text-text-high">
                            {b.requiredAction}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <p className="mt-ds-2xl text-caption-2 text-muted-foreground">
                      Raised by {b.raisedByName} ·{" "}
                      <Num>{formatDateTime(b.createdAt)}</Num>
                    </p>

                    {canResolve &&
                      (resolvingId === b.id ? (
                        <form
                          onSubmit={(event) => resolve(event, b)}
                          className="mt-ds-2xl flex flex-wrap items-end gap-ds-md border-t border-danger-outline pt-ds-2xl"
                        >
                          <div className="min-w-0 flex-1 sm:max-w-80">
                            <TextInputField
                              id={`resolve-notes-${b.id}`}
                              label="Resolution notes"
                              value={resolutionNotes}
                              onChange={setResolutionNotes}
                            />
                          </div>
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={resolveSubmitting}
                            aria-busy={resolveSubmitting}
                          >
                            {resolveSubmitting ? "Resolving…" : "Confirm resolve"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setResolvingId(null);
                              setResolutionNotes("");
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
                              setResolvingId(b.id);
                              setResolutionNotes("");
                            }}
                          >
                            Resolve
                          </Button>
                        </div>
                      ))}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resolved.length > 0 && (
            <section aria-label="Resolved blockers">
              <Subhead count={resolved.length}>Resolved</Subhead>
              <ol className="mt-ds-2xl -mx-ds-md divide-y divide-outline-low border-y border-outline-low">
                {resolved.map((b) => (
                  <li key={b.id} className={LOG_ROW}>
                    <div className="flex flex-wrap items-start gap-ds-xl">
                      <Pill tone="success" label="Resolved" />
                      <p className="min-w-[14rem] flex-1 font-medium text-text-high">
                        {b.description}
                      </p>
                    </div>
                    <p className="mt-ds-md max-w-[64ch] text-para text-text-med">
                      {b.impact}
                    </p>
                    {b.resolutionNotes && (
                      <p className="mt-ds-xs max-w-[64ch] text-para text-text-high">
                        {b.resolutionNotes}
                      </p>
                    )}
                    <p className="mt-ds-md text-caption-2 text-text-low">
                      Raised by {b.raisedByName} · resolved by{" "}
                      {b.resolvedByName ?? "an unrecorded user"}
                      {b.resolvedAt && (
                        <>
                          {" · "}
                          <Num>{formatDateTime(b.resolvedAt)}</Num>
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
