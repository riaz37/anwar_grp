"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { Pill } from "@/components/ui/StatusPill";
import { PlusIcon } from "@/components/ui/icons";
import { ApiRequestError, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import type { RefUser } from "./types";
import { Block, Empty, FormActions, FormPanel, Monogram } from "./detail/chrome";

/**
 * View-model mirror of `lib/raci-engine.ts`'s `ProjectRaci`/`OwnershipGap` —
 * kept local (not imported from the server-only engine module) so this
 * client component has no path, even a type-only one, back to a
 * "server-only" file.
 */
export interface RaciPersonView {
  userId: string;
  name: string;
  email: string;
}

export interface RaciResponsibleEntryView extends RaciPersonView {
  scope: string;
}

export interface ProjectRaciView {
  accountable: RaciPersonView | null;
  responsible: RaciResponsibleEntryView[];
  consulted: RaciPersonView[];
  informed: RaciPersonView[];
}

export type OwnershipGapTypeView =
  | "MISSING_ANALYST"
  | "MISSING_DEVELOPER"
  | "BLOCKER_RESPONSIBLE_NOT_PARTICIPANT"
  | "NO_CONSULTED_OR_INFORMED";

export interface OwnershipGapView {
  type: OwnershipGapTypeView;
  subjectId: string;
  reason: string;
}

interface StakeholderView {
  id: string;
  userId: string;
  userName: string;
  raciRole: "CONSULTED" | "INFORMED";
}

const RESPONSIBLE_GAP_TYPES: readonly OwnershipGapTypeView[] = [
  "MISSING_ANALYST",
  "MISSING_DEVELOPER",
  "BLOCKER_RESPONSIBLE_NOT_PARTICIPANT",
];

export function ProjectRaciPanel({
  projectId,
  raci,
  ownershipGaps,
  stakeholders,
  users,
  currentUserRole,
  onChanged,
}: {
  projectId: string;
  raci: ProjectRaciView;
  ownershipGaps: OwnershipGapView[];
  stakeholders: StakeholderView[];
  users: RefUser[];
  currentUserRole: Role;
  onChanged: () => void;
}) {
  const canManageStakeholders = hasProjectPermission(
    currentUserRole,
    "MANAGE_STAKEHOLDERS",
  );

  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState("");
  const [raciRole, setRaciRole] = useState<"CONSULTED" | "INFORMED">("CONSULTED");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const responsibleGaps = ownershipGaps.filter((g) =>
    RESPONSIBLE_GAP_TYPES.includes(g.type),
  );
  const missingConsultedOrInformed = ownershipGaps.some(
    (g) => g.type === "NO_CONSULTED_OR_INFORMED",
  );

  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));
  const raciRoleOptions = [
    { value: "CONSULTED", label: "Consulted" },
    { value: "INFORMED", label: "Informed" },
  ];

  function closeForm() {
    setShowForm(false);
    setUserId("");
    setRaciRole("CONSULTED");
    setError(null);
  }

  async function addStakeholder(event: React.FormEvent) {
    event.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setError(null);
    try {
      await postJson(`/api/v1/projects/${projectId}/stakeholders`, {
        userId,
        raciRole,
      });
      closeForm();
      toast.success("Stakeholder added");
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Couldn’t add the stakeholder.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function removeStakeholder(stakeholder: StakeholderView) {
    setRemovingId(stakeholder.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/projects/${projectId}/stakeholders/${stakeholder.id}`,
        { method: "DELETE" },
      );
      const envelope = await response.json().catch(() => null);
      if (!response.ok || !envelope?.success) {
        throw new ApiRequestError(
          envelope?.error?.message ?? "Couldn’t remove the stakeholder.",
          response.status,
          envelope?.error?.code ?? "UNKNOWN_ERROR",
        );
      }
      toast.success("Stakeholder removed");
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn’t remove the stakeholder.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  const consultedStakeholders = stakeholders.filter((s) => s.raciRole === "CONSULTED");
  const informedStakeholders = stakeholders.filter((s) => s.raciRole === "INFORMED");

  return (
    <Block
      id="raci"
      eyebrow="Ownership"
      title="RACI matrix"
      description="Responsible, Accountable, Consulted, Informed — who owns this project and who needs visibility into it."
      action={
        canManageStakeholders && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            <PlusIcon aria-hidden="true" /> Add stakeholder
          </Button>
        ) : null
      }
    >
      <LiveRegion>
        {error && (
          <div className="mb-ds-2xl">
            <InlineBanner
              tone="error"
              title="RACI action failed"
              onDismiss={() => setError(null)}
            >
              {error}
            </InlineBanner>
          </div>
        )}
      </LiveRegion>

      {showForm && (
        <div className="mb-ds-5xl">
          <FormPanel onSubmit={addStakeholder}>
            <SelectField
              id="raci-user"
              label="Person"
              value={userId}
              onChange={setUserId}
              options={userOptions}
              required
            />
            <SelectField
              id="raci-role"
              label="RACI role"
              value={raciRole}
              onChange={(value) => setRaciRole(value as "CONSULTED" | "INFORMED")}
              options={raciRoleOptions}
              required
            />
            <FormActions>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || !userId}
                aria-busy={submitting}
              >
                {submitting ? "Adding…" : "Add stakeholder"}
              </Button>
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
            </FormActions>
          </FormPanel>
        </div>
      )}

      <div className="grid gap-ds-2xl sm:grid-cols-2 lg:grid-cols-4">
        <RaciCell label="Responsible" tone={responsibleGaps.length > 0 ? "error" : undefined}>
          {raci.responsible.length === 0 ? (
            <GapNote>No one assigned yet.</GapNote>
          ) : (
            <ul className="flex flex-col gap-ds-md">
              {raci.responsible.map((entry, index) => (
                <li key={`${entry.userId}-${index}`} className="flex items-start gap-ds-md">
                  <Monogram name={entry.name} />
                  <div className="min-w-0">
                    <p className="text-body-1 font-medium text-text-high">
                      {entry.name}
                    </p>
                    <p className="text-caption-2 text-text-low">{entry.scope}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {responsibleGaps.map((gap) => (
            <GapBadge key={`${gap.type}-${gap.subjectId}`} reason={gap.reason} className="mt-ds-md" />
          ))}
        </RaciCell>

        <RaciCell label="Accountable">
          {raci.accountable ? (
            <div className="flex items-start gap-ds-md">
              <Monogram name={raci.accountable.name} />
              <div className="min-w-0">
                <p className="text-body-1 font-medium text-text-high">
                  {raci.accountable.name}
                </p>
                <p className="text-caption-2 text-text-low">Owner</p>
              </div>
            </div>
          ) : (
            <GapNote>No owner assigned.</GapNote>
          )}
        </RaciCell>

        <RaciCell label="Consulted" tone={missingConsultedOrInformed ? "error" : undefined}>
          {consultedStakeholders.length === 0 ? (
            <GapNote>
              {missingConsultedOrInformed
                ? "No one consulted: an ownership gap at this stage."
                : "No one consulted yet."}
            </GapNote>
          ) : (
            <ul className="flex flex-col gap-ds-md">
              {consultedStakeholders.map((s) => (
                <StakeholderRow
                  key={s.id}
                  stakeholder={s}
                  canManage={canManageStakeholders}
                  busy={removingId === s.id}
                  onRemove={() => removeStakeholder(s)}
                />
              ))}
            </ul>
          )}
        </RaciCell>

        <RaciCell label="Informed" tone={missingConsultedOrInformed ? "error" : undefined}>
          {informedStakeholders.length === 0 ? (
            <GapNote>
              {missingConsultedOrInformed
                ? "No one informed: an ownership gap at this stage."
                : "No one informed yet."}
            </GapNote>
          ) : (
            <ul className="flex flex-col gap-ds-md">
              {informedStakeholders.map((s) => (
                <StakeholderRow
                  key={s.id}
                  stakeholder={s}
                  canManage={canManageStakeholders}
                  busy={removingId === s.id}
                  onRemove={() => removeStakeholder(s)}
                />
              ))}
            </ul>
          )}
        </RaciCell>
      </div>

      {ownershipGaps.length === 0 && (
        <Empty title="No ownership gaps">
          Every RACI seat that matters at this stage (Responsible, Accountable,
          and past Approval at least one Consulted or Informed stakeholder) is
          filled.
        </Empty>
      )}
    </Block>
  );
}

function RaciCell({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "error";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-xl border border-danger-outline bg-danger-wash p-ds-2xl"
          : "rounded-xl border border-outline-low bg-surface-1 p-ds-2xl"
      }
    >
      <span className="annotation">{label}</span>
      <div className="mt-ds-md">{children}</div>
    </div>
  );
}

function GapNote({ children }: { children: React.ReactNode }) {
  return <p className="text-body-1 text-muted-foreground">{children}</p>;
}

function GapBadge({ reason, className }: { reason: string; className?: string }) {
  return (
    <div className={className}>
      <Pill tone="error" label="Ownership gap" />
      <p className="mt-ds-xs max-w-[36ch] text-caption-2 text-danger-high">{reason}</p>
    </div>
  );
}

function StakeholderRow({
  stakeholder,
  canManage,
  busy,
  onRemove,
}: {
  stakeholder: StakeholderView;
  canManage: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-ds-md">
      <Monogram name={stakeholder.userName} />
      <p className="min-w-0 flex-1 text-body-1 font-medium text-text-high">
        {stakeholder.userName}
      </p>
      {canManage && (
        <Button
          variant="ghost"
          disabled={busy}
          aria-busy={busy}
          onClick={onRemove}
        >
          {busy ? "Removing…" : "Remove"}
        </Button>
      )}
    </li>
  );
}
