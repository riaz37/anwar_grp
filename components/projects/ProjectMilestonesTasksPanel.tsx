"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/StatusPill";
import { SelectField, TextAreaField, TextInputField } from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { formatDate } from "@/lib/format";
import { ApiRequestError, patchJson, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import {
  DELAY_REASON_LABELS,
  MILESTONE_STATUS_LABELS,
  MILESTONE_STATUS_TONE,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
} from "./projectTone";
import type { MilestoneView, RefUser, TaskView } from "./types";

const DELAY_REASON_OPTIONS = Object.entries(DELAY_REASON_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const MILESTONE_STATUS_OPTIONS = Object.entries(MILESTONE_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function ProjectMilestonesTasksPanel({
  projectId,
  milestones,
  tasks,
  users,
  currentUserRole,
  onChanged,
}: {
  projectId: string;
  milestones: MilestoneView[];
  tasks: TaskView[];
  delayReasons: unknown;
  users: RefUser[];
  currentUserRole: Role;
  onChanged: () => void;
}) {
  const canManageMilestones = hasProjectPermission(currentUserRole, "MANAGE_MILESTONES");
  const canUpdateTask = hasProjectPermission(currentUserRole, "UPDATE_TASK");
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));

  return (
    <div className="flex flex-col gap-2xl">
      <MilestonesSection
        projectId={projectId}
        milestones={milestones}
        userOptions={userOptions}
        canManage={canManageMilestones}
        onChanged={onChanged}
      />
      <TasksSection
        projectId={projectId}
        tasks={tasks}
        milestones={milestones}
        userOptions={userOptions}
        canUpdate={canUpdateTask}
        onChanged={onChanged}
      />
    </div>
  );
}

function MilestonesSection({
  projectId,
  milestones,
  userOptions,
  canManage,
  onChanged,
}: {
  projectId: string;
  milestones: MilestoneView[];
  userOptions: { value: string; label: string }[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Milestone id requiring a delay reason before its pending status change
  // can go through (surfaced by the API's 422 DELAY_REASON_REQUIRED).
  const [delayPromptFor, setDelayPromptFor] = useState<{
    milestoneId: string;
    status: string;
  } | null>(null);
  const [delayCategory, setDelayCategory] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delaySubmitting, setDelaySubmitting] = useState(false);
  const [delayError, setDelayError] = useState<string | null>(null);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !ownerId || !dueDate) {
      setError("Name, owner, and due date are all required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await postJson(`/api/v1/projects/${projectId}/milestones`, {
        name: name.trim(),
        ownerId,
        dueDate,
      });
      setName("");
      setOwnerId("");
      setDueDate("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t add the milestone.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(milestoneId: string, status: string) {
    setError(null);
    try {
      await patchJson(`/api/v1/projects/${projectId}/milestones/${milestoneId}`, { status });
      onChanged();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "DELAY_REASON_REQUIRED") {
        setDelayPromptFor({ milestoneId, status });
        return;
      }
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t update the milestone.");
    }
  }

  async function submitDelayReason(event: React.FormEvent) {
    event.preventDefault();
    if (!delayPromptFor || !delayCategory) {
      setDelayError("Choose a delay reason category.");
      return;
    }
    setDelaySubmitting(true);
    setDelayError(null);
    try {
      await patchJson(
        `/api/v1/projects/${projectId}/milestones/${delayPromptFor.milestoneId}`,
        {
          status: delayPromptFor.status,
          delayReasonCategory: delayCategory,
          delayReasonNote: delayNote.trim() || undefined,
        },
      );
      setDelayPromptFor(null);
      setDelayCategory("");
      setDelayNote("");
      onChanged();
    } catch (err) {
      setDelayError(
        err instanceof ApiRequestError ? err.message : "Couldn’t record the delay reason.",
      );
    } finally {
      setDelaySubmitting(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-body font-semibold text-text">Milestones</h3>
        {canManage && !showForm && (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Add milestone
          </Button>
        )}
      </div>

      <LiveRegion>
        {error && (
          <InlineBanner tone="error" title="Milestone action failed">
            {error}
          </InlineBanner>
        )}
      </LiveRegion>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-md flex max-w-[560px] flex-col gap-md rounded-md border border-border p-md"
        >
          <TextInputField id="milestone-name" label="Name" value={name} onChange={setName} required />
          <SelectField
            id="milestone-owner"
            label="Owner"
            value={ownerId}
            onChange={setOwnerId}
            options={userOptions}
            required
          />
          <TextInputField
            id="milestone-due"
            label="Due date"
            type="date"
            value={dueDate}
            onChange={setDueDate}
            required
          />
          <div className="flex gap-sm">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add milestone"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {delayPromptFor && (
        <form
          onSubmit={submitDelayReason}
          className="mt-md flex max-w-[560px] flex-col gap-md rounded-md border border-warning p-md"
        >
          <InlineBanner tone="warning" title="Delay reason required">
            This milestone is overdue — record why before changing its status.
          </InlineBanner>
          {delayError && (
            <InlineBanner tone="error" title="Couldn’t save">
              {delayError}
            </InlineBanner>
          )}
          <SelectField
            id="delay-category"
            label="Delay reason"
            value={delayCategory}
            onChange={setDelayCategory}
            options={DELAY_REASON_OPTIONS}
            required
          />
          <TextAreaField
            id="delay-note"
            label="Note"
            value={delayNote}
            onChange={setDelayNote}
            rows={2}
          />
          <div className="flex gap-sm">
            <Button type="submit" variant="primary" disabled={delaySubmitting}>
              {delaySubmitting ? "Saving…" : "Save and continue"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDelayPromptFor(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {milestones.length === 0 ? (
        <p className="mt-md text-body-sm text-muted">No milestones yet.</p>
      ) : (
        <ul className="mt-md flex flex-col gap-sm">
          {milestones.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-sm rounded-md border border-border p-md text-body-sm"
            >
              <div className="min-w-[200px] flex-1">
                <p className="font-medium text-text">{m.name}</p>
                <p className="mt-2xs text-caption text-muted">
                  {m.ownerName} — due {formatDate(m.dueDate.slice(0, 10))}
                  {m.overdue && " — overdue"}
                  {!m.overdue && m.atRisk && " — at risk"}
                </p>
              </div>
              <Pill tone={MILESTONE_STATUS_TONE[m.status]} label={MILESTONE_STATUS_LABELS[m.status]} />
              {canManage && m.status !== "DONE" && (
                <select
                  aria-label={`Update status for ${m.name}`}
                  value={m.status}
                  onChange={(e) => updateStatus(m.id, e.target.value)}
                  className="min-h-11 rounded-sm border border-border bg-surface px-sm text-body-sm text-text"
                >
                  {MILESTONE_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TasksSection({
  projectId,
  tasks,
  milestones,
  userOptions,
  canUpdate,
  onChanged,
}: {
  projectId: string;
  tasks: TaskView[];
  milestones: MilestoneView[];
  userOptions: { value: string; label: string }[];
  canUpdate: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [action, setAction] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [relatedMilestoneId, setRelatedMilestoneId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const milestoneOptions = milestones.map((m) => ({ value: m.id, label: m.name }));
  const milestoneNameById = new Map(milestones.map((m) => [m.id, m.name]));

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!action.trim() || !ownerId) {
      setError("Action and owner are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await postJson(`/api/v1/projects/${projectId}/tasks`, {
        action: action.trim(),
        ownerId,
        deadline: deadline || undefined,
        relatedMilestoneId: relatedMilestoneId || undefined,
      });
      setAction("");
      setOwnerId("");
      setDeadline("");
      setRelatedMilestoneId("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t add the task.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(taskId: string, status: string) {
    setError(null);
    try {
      await patchJson(`/api/v1/projects/${projectId}/tasks/${taskId}`, { status });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t update the task.");
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-body font-semibold text-text">Tasks</h3>
        {canUpdate && !showForm && (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Add task
          </Button>
        )}
      </div>

      <LiveRegion>
        {error && (
          <InlineBanner tone="error" title="Task action failed">
            {error}
          </InlineBanner>
        )}
      </LiveRegion>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-md flex max-w-[560px] flex-col gap-md rounded-md border border-border p-md"
        >
          <TextInputField id="task-action" label="Action" value={action} onChange={setAction} required />
          <SelectField
            id="task-owner"
            label="Owner"
            value={ownerId}
            onChange={setOwnerId}
            options={userOptions}
            required
          />
          <TextInputField
            id="task-deadline"
            label="Deadline"
            type="date"
            value={deadline}
            onChange={setDeadline}
          />
          <SelectField
            id="task-milestone"
            label="Related milestone"
            value={relatedMilestoneId}
            onChange={setRelatedMilestoneId}
            options={milestoneOptions}
          />
          <div className="flex gap-sm">
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add task"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="mt-md text-body-sm text-muted">No tasks yet.</p>
      ) : (
        <ul className="mt-md flex flex-col gap-sm">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center gap-sm rounded-md border border-border p-md text-body-sm"
            >
              <div className="min-w-[200px] flex-1">
                <p className="font-medium text-text">{t.action}</p>
                <p className="mt-2xs text-caption text-muted">
                  {t.ownerName}
                  {t.deadline && ` — due ${formatDate(t.deadline.slice(0, 10))}`}
                  {t.relatedMilestoneId &&
                    milestoneNameById.get(t.relatedMilestoneId) &&
                    ` — ${milestoneNameById.get(t.relatedMilestoneId)}`}
                </p>
              </div>
              <Pill tone={TASK_STATUS_TONE[t.status]} label={TASK_STATUS_LABELS[t.status]} />
              {canUpdate && t.status !== "DONE" && (
                <select
                  aria-label={`Update status for ${t.action}`}
                  value={t.status}
                  onChange={(e) => updateStatus(t.id, e.target.value)}
                  className="min-h-11 rounded-sm border border-border bg-surface px-sm text-body-sm text-text"
                >
                  {TASK_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
