"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { formatDate, formatDateTime } from "@/lib/format";
import { ApiRequestError, patchJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import { roleLabel, STAGE_LABELS } from "../projectTone";
import type { ProjectDetail, RefUser } from "../types";
import { Monogram, Num } from "./chrome";

/**
 * The fixed rail: the facts about this project that stay true whichever
 * section you are working in. Linear's issue properties, read for a
 * governance record — accountable people first, then placement, then dates.
 *
 * The schema tracks exactly three assignable people (`Project.ownerId` /
 * `analystId` / `developerId`). There is no open-ended contributor list by
 * design: `ownerId` IS the single accountable owner per the "One Project
 * Owner" principle. That is a documented scope call, not an omission.
 */
export function ProjectRail({
  project,
  users,
  currentUserRole,
  latestUpdate,
  openBlockerCount,
  onChanged,
}: {
  project: ProjectDetail;
  users: RefUser[];
  currentUserRole: Role;
  latestUpdate: { label: string; at: string } | null;
  openBlockerCount: number;
  onChanged: () => void;
}) {
  const canEdit = hasProjectPermission(currentUserRole, "EDIT_REQUIREMENTS");

  const [editing, setEditing] = useState(false);
  const [ownerId, setOwnerId] = useState(project.owner.id);
  const [analystId, setAnalystId] = useState(project.analyst?.id ?? "");
  const [developerId, setDeveloperId] = useState(project.developer?.id ?? "");
  const [ownerError, setOwnerError] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const options = users.map((u) => ({
    value: u.id,
    label: `${u.name} (${roleLabel(u.role)})`,
  }));

  /** Cancel restores the saved assignment — a half-made change must not sit
   *  in the form waiting for the next time it is opened. */
  function cancelEditing() {
    setOwnerId(project.owner.id);
    setAnalystId(project.analyst?.id ?? "");
    setDeveloperId(project.developer?.id ?? "");
    setOwnerError(undefined);
    setError(null);
    setEditing(false);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!ownerId) {
      setOwnerError("Every project needs one accountable owner.");
      document.getElementById("people-owner")?.focus();
      return;
    }
    setOwnerError(undefined);
    setSubmitting(true);
    setError(null);
    try {
      await patchJson(`/api/v1/projects/${project.id}`, {
        version: project.version,
        ownerId,
        analystId: analystId || null,
        developerId: developerId || null,
      });
      setEditing(false);
      toast.success("People updated");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t update people.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <aside
      aria-label="Project facts"
      className="lg:sticky lg:top-ds-5xl lg:self-start"
    >
      <div className="flex flex-col gap-ds-7xl rounded-xl border border-outline-low bg-surface-0 p-ds-5xl shadow-e1">
        <RailGroup
          title="Accountability"
          action={
            canEdit && !editing ? (
              <Button
                variant="ghost"
                onClick={() => setEditing(true)}
                className="-mr-ds-md h-8 px-ds-md text-caption-2 text-text-med hover:text-text-high"
              >
                Reassign
              </Button>
            ) : null
          }
        >
          <LiveRegion>
            {error && (
              <div className="mb-ds-2xl">
                <InlineBanner
                  tone="error"
                  title="Couldn’t update people"
                  onDismiss={() => setError(null)}
                >
                  {error}
                </InlineBanner>
              </div>
            )}
          </LiveRegion>

          {editing ? (
            <form onSubmit={handleSave} className="flex flex-col gap-ds-2xl">
              <SelectField
                id="people-owner"
                label="Project owner"
                hint="One accountable owner. This is who management asks."
                value={ownerId}
                onChange={(value) => {
                  setOwnerId(value);
                  setOwnerError(undefined);
                }}
                options={options}
                required
                error={ownerError}
              />
              <SelectField
                id="people-analyst"
                label="AI analyst"
                value={analystId}
                onChange={setAnalystId}
                options={options}
              />
              <SelectField
                id="people-developer"
                label="Developer"
                value={developerId}
                onChange={setDeveloperId}
                options={options}
              />
              <div className="flex flex-wrap gap-ds-md">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting ? "Saving…" : "Save assignment"}
                </Button>
                <Button type="button" variant="ghost" onClick={cancelEditing}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <ul className="flex flex-col gap-ds-2xl">
              <PersonRow role="Project owner" person={project.owner} />
              <PersonRow role="AI analyst" person={project.analyst} />
              <PersonRow role="Developer" person={project.developer} />
            </ul>
          )}
        </RailGroup>

        <RailGroup title="Placement">
          <dl className="flex flex-col gap-ds-xl">
            <RailFact label="Business unit">{project.businessUnit.name}</RailFact>
            <RailFact label="Department">{project.department.name}</RailFact>
            <RailFact label="Current stage">
              {STAGE_LABELS[project.currentStage]}
            </RailFact>
          </dl>
        </RailGroup>

        <RailGroup title="Timeline">
          <dl className="flex flex-col gap-ds-xl">
            <RailFact label="Expected delivery" numeric>
              {formatDate(project.expectedDeliveryDate.slice(0, 10))}
            </RailFact>
            <RailFact label="Open blockers">
              {openBlockerCount === 0 ? (
                <span className="text-text-med">None</span>
              ) : (
                <span className="text-danger-high">
                  <Num>{openBlockerCount}</Num> open
                </span>
              )}
            </RailFact>
            <RailFact label="Latest update">
              {latestUpdate ? (
                <>
                  <span className="block">{latestUpdate.label}</span>
                  <span className="mt-ds-xxs block text-caption-2 text-muted-foreground">
                    <Num>{formatDateTime(latestUpdate.at)}</Num>
                  </span>
                </>
              ) : (
                <span className="text-text-med">Nothing recorded yet</span>
              )}
            </RailFact>
          </dl>
        </RailGroup>
      </div>
    </aside>
  );
}

function RailGroup({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-ds-2xl">
      <div className="flex min-h-8 items-center justify-between gap-ds-md border-b border-outline-low pb-ds-md">
        <h2 className="annotation">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function RailFact({
  label,
  numeric = false,
  children,
}: {
  label: string;
  numeric?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-ds-xxs">
      <dt className="text-caption-2 text-text-low">{label}</dt>
      <dd
        className={
          numeric
            ? "font-data text-body-1 tabular-nums text-text-high"
            : "text-body-1 text-text-high"
        }
      >
        {children}
      </dd>
    </div>
  );
}

function PersonRow({
  role,
  person,
}: {
  role: string;
  person: RefUser | null;
}) {
  return (
    <li className="flex items-center gap-ds-xl">
      {person ? (
        <Monogram name={person.name} />
      ) : (
        <span
          aria-hidden="true"
          className="size-7 shrink-0 rounded-pill border border-dashed border-outline-high"
        />
      )}
      <span className="min-w-0">
        <span className="block text-caption-2 text-text-low">{role}</span>
        {person ? (
          <span className="block truncate text-body-1 font-medium text-text-high">
            {person.name}
            <span className="ml-ds-sm font-normal text-text-low">
              {roleLabel(person.role)}
            </span>
          </span>
        ) : (
          <span className="block text-body-1 text-text-med">Unassigned</span>
        )}
      </span>
    </li>
  );
}
