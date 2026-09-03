"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { DetailList, DetailItem } from "@/components/ui/DetailList";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { ApiRequestError, patchJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import { roleLabel } from "./projectTone";
import type { ProjectDetail, RefUser } from "./types";

/**
 * The schema tracks exactly three assignable people per project — owner,
 * analyst, developer (`Project.ownerId`/`analystId`/`developerId`). The
 * assignment's People section also lists "Business owner" and "Other
 * contributors" as separate fields, but this schema deliberately has no
 * such columns: `Project.ownerId` IS the single accountable owner per the
 * "One Project Owner" design principle, and modeling an open-ended
 * contributor list is out of MVP scope (documented call, not an oversight).
 */
export function ProjectPeoplePanel({
  project,
  users,
  currentUserRole,
  onChanged,
}: {
  project: ProjectDetail;
  users: RefUser[];
  currentUserRole: Role;
  onChanged: () => void;
}) {
  const canEdit = hasProjectPermission(currentUserRole, "EDIT_REQUIREMENTS");
  const [editing, setEditing] = useState(false);
  const [ownerId, setOwnerId] = useState(project.owner.id);
  const [analystId, setAnalystId] = useState(project.analyst?.id ?? "");
  const [developerId, setDeveloperId] = useState(project.developer?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const options = users.map((u) => ({ value: u.id, label: `${u.name} (${roleLabel(u.role)})` }));

  async function handleSave() {
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
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t update people.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-lg">
        <DetailList columns={2}>
          <DetailItem label="Project owner">{project.owner.name}</DetailItem>
          <DetailItem label="AI analyst">{project.analyst?.name ?? "Unassigned"}</DetailItem>
          <DetailItem label="Developer">{project.developer?.name ?? "Unassigned"}</DetailItem>
        </DetailList>
        {canEdit && (
          <div>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Reassign people
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex max-w-[560px] flex-col gap-md">
      <LiveRegion>
        {error && (
          <InlineBanner tone="error" title="Couldn’t update people">
            {error}
          </InlineBanner>
        )}
      </LiveRegion>
      <SelectField id="people-owner" label="Project owner" value={ownerId} onChange={setOwnerId} options={options} required />
      <SelectField id="people-analyst" label="AI analyst" value={analystId} onChange={setAnalystId} options={options} />
      <SelectField id="people-developer" label="Developer" value={developerId} onChange={setDeveloperId} options={options} />
      <div className="flex gap-sm">
        <Button variant="primary" onClick={handleSave} disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
