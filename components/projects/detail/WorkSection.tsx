"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/StatusPill";
import { SelectField, TextAreaField, TextInputField } from "@/components/ui/Field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { PlusIcon } from "@/components/ui/icons";
import { formatDate, formatDateTime, todayIsoDate } from "@/lib/format";
import { ApiRequestError, patchJson, postJson } from "@/lib/api-client";
import { hasProjectPermission } from "@/lib/project-permissions";
import {
  DELAY_REASON_LABELS,
  MILESTONE_STATUS_LABELS,
  MILESTONE_STATUS_TONE,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONE,
} from "../projectTone";
import type {
  DelayReasonView,
  ItemDependencyView,
  MilestoneView,
  RefUser,
  TaskView,
} from "../types";
import {
  Block,
  Empty,
  FormActions,
  FormPanel,
  Monogram,
  Num,
  ROW,
  RowList,
  Subhead,
} from "./chrome";
import { DependencyPicker, type DependencyCandidate } from "./DependencyPicker";

const DELAY_REASON_OPTIONS = Object.entries(DELAY_REASON_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const MILESTONE_STATUS_OPTIONS = Object.entries(MILESTONE_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const TASK_STATUS_OPTIONS = Object.entries(TASK_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/**
 * Inline status control on a milestone or task row.
 *
 * Radix `Select` rather than a native `<select>`, matching `SelectField`: the
 * listbox then carries the same focus ring, hairline border, and control
 * radius as every other control instead of an unstylable OS popup. There is no
 * visible label here by design, so the trigger takes an `aria-label` naming
 * the row it belongs to.
 */
function RowStatusSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        aria-label={label}
        className="min-h-11 w-auto min-w-36 px-ds-md text-body-1 disabled:cursor-progress disabled:opacity-60"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * `delayReasons` arrives typed as `unknown` from this component's public
 * signature, so it is narrowed here rather than trusted. Anything that doesn't
 * have the shape below is dropped instead of crashing the section.
 */
function toDelayReasons(value: unknown): DelayReasonView[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DelayReasonView => {
    if (typeof item !== "object" || item === null) return false;
    const candidate = item as Partial<DelayReasonView>;
    return (
      typeof candidate.id === "string" &&
      typeof candidate.category === "string" &&
      typeof candidate.recordedByName === "string" &&
      typeof candidate.createdAt === "string"
    );
  });
}

export function WorkSection({
  projectId,
  milestones,
  tasks,
  dependencies,
  delayReasons,
  users,
  currentUserRole,
  onChanged,
}: {
  projectId: string;
  milestones: MilestoneView[];
  tasks: TaskView[];
  dependencies: ItemDependencyView[];
  delayReasons: unknown;
  users: RefUser[];
  currentUserRole: Role;
  onChanged: () => void;
}) {
  const canManageMilestones = hasProjectPermission(
    currentUserRole,
    "MANAGE_MILESTONES",
  );
  const canUpdateTask = hasProjectPermission(currentUserRole, "UPDATE_TASK");
  const canManageDependencies = hasProjectPermission(
    currentUserRole,
    "MANAGE_DEPENDENCIES",
  );
  const userOptions = users.map((u) => ({ value: u.id, label: u.name }));

  // Every milestone and task is a candidate predecessor for every other one
  // — the dependency picker excludes an item from its own candidate list.
  const dependencyCandidates: DependencyCandidate[] = [
    ...milestones.map((m) => ({ id: m.id, type: "MILESTONE" as const, label: m.name })),
    ...tasks.map((t) => ({ id: t.id, type: "TASK" as const, label: t.action })),
  ];

  return (
    <div className="flex flex-col gap-ds-9xl">
      <MilestonesBlock
        projectId={projectId}
        milestones={milestones}
        delayReasons={toDelayReasons(delayReasons)}
        userOptions={userOptions}
        canManage={canManageMilestones}
        canManageDependencies={canManageDependencies}
        dependencies={dependencies}
        dependencyCandidates={dependencyCandidates}
        onChanged={onChanged}
      />
      <TasksBlock
        projectId={projectId}
        tasks={tasks}
        milestones={milestones}
        userOptions={userOptions}
        canUpdate={canUpdateTask}
        canManageDependencies={canManageDependencies}
        dependencies={dependencies}
        dependencyCandidates={dependencyCandidates}
        onChanged={onChanged}
      />
    </div>
  );
}

function MilestonesBlock({
  projectId,
  milestones,
  delayReasons,
  userOptions,
  canManage,
  canManageDependencies,
  dependencies,
  dependencyCandidates,
  onChanged,
}: {
  projectId: string;
  milestones: MilestoneView[];
  delayReasons: DelayReasonView[];
  userOptions: { value: string; label: string }[];
  canManage: boolean;
  canManageDependencies: boolean;
  dependencies: ItemDependencyView[];
  dependencyCandidates: DependencyCandidate[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Milestone id requiring a delay reason before its pending status change can
  // go through (surfaced by the API's 422 DELAY_REASON_REQUIRED).
  const [delayPromptFor, setDelayPromptFor] = useState<{
    milestoneId: string;
    status: string;
  } | null>(null);
  const [delayCategory, setDelayCategory] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delaySubmitting, setDelaySubmitting] = useState(false);
  const [delayError, setDelayError] = useState<string | null>(null);

  const milestoneNameById = new Map(milestones.map((m) => [m.id, m.name]));

  function clearFieldError(key: string) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function closeForm() {
    setShowForm(false);
    setFieldErrors({});
    setError(null);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name the milestone.";
    if (!ownerId) errors.ownerId = "Assign an owner.";
    if (!dueDate) errors.dueDate = "Set a due date.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstInvalid = errors.name
        ? "milestone-name"
        : errors.ownerId
          ? "milestone-owner"
          : "milestone-due";
      document.getElementById(firstInvalid)?.focus();
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
      closeForm();
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Couldn’t add the milestone.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(milestoneId: string, status: string) {
    setError(null);
    setBusyId(milestoneId);
    try {
      await patchJson(`/api/v1/projects/${projectId}/milestones/${milestoneId}`, {
        status,
      });
      onChanged();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "DELAY_REASON_REQUIRED") {
        setDelayPromptFor({ milestoneId, status });
        return;
      }
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn’t update the milestone.",
      );
    } finally {
      setBusyId(null);
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
        err instanceof ApiRequestError
          ? err.message
          : "Couldn’t record the delay reason.",
      );
    } finally {
      setDelaySubmitting(false);
    }
  }

  return (
    <Block
      id="milestones"
      eyebrow="Dated checkpoints"
      title="Milestones"
      count={milestones.length}
      action={
        canManage && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            <PlusIcon aria-hidden="true" /> Add milestone
          </Button>
        ) : null
      }
    >
      <LiveRegion>
        {error && (
          <div className="mb-ds-2xl">
            <InlineBanner
              tone="error"
              title="Milestone action failed"
              onDismiss={() => setError(null)}
            >
              {error}
            </InlineBanner>
          </div>
        )}
      </LiveRegion>

      {showForm && (
        <div className="mb-ds-5xl">
          <FormPanel onSubmit={handleCreate}>
            <TextInputField
              id="milestone-name"
              label="Name"
              value={name}
              onChange={(value) => {
                setName(value);
                clearFieldError("name");
              }}
              required
              error={fieldErrors.name}
            />
            <SelectField
              id="milestone-owner"
              label="Owner"
              value={ownerId}
              onChange={(value) => {
                setOwnerId(value);
                clearFieldError("ownerId");
              }}
              options={userOptions}
              required
              error={fieldErrors.ownerId}
            />
            <TextInputField
              id="milestone-due"
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(value) => {
                setDueDate(value);
                clearFieldError("dueDate");
              }}
              required
              error={fieldErrors.dueDate}
            />
            <FormActions>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "Adding…" : "Add milestone"}
              </Button>
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
            </FormActions>
          </FormPanel>
        </div>
      )}

      {delayPromptFor && (
        <div className="mb-ds-5xl">
          <FormPanel tone="warning" onSubmit={submitDelayReason}>
            <InlineBanner tone="warning" title="Delay reason required">
              {milestoneNameById.get(delayPromptFor.milestoneId) ?? "This milestone"}{" "}
              is past its due date. Record why before changing its status.
            </InlineBanner>
            <LiveRegion>
              {delayError && (
                <InlineBanner tone="error" title="Couldn’t save the delay reason">
                  {delayError}
                </InlineBanner>
              )}
            </LiveRegion>
            <SelectField
              id="delay-category"
              label="Delay reason"
              value={delayCategory}
              onChange={(value) => {
                setDelayCategory(value);
                setDelayError(null);
              }}
              options={DELAY_REASON_OPTIONS}
              required
              error={delayError && !delayCategory ? "Choose a category." : undefined}
            />
            <TextAreaField
              id="delay-note"
              label="Note"
              hint="What specifically held it up? This is what management reads first."
              value={delayNote}
              onChange={setDelayNote}
              rows={2}
            />
            <FormActions>
              <Button
                type="submit"
                variant="primary"
                disabled={delaySubmitting}
                aria-busy={delaySubmitting}
              >
                {delaySubmitting ? "Saving…" : "Save and continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDelayPromptFor(null);
                  setDelayError(null);
                }}
              >
                Cancel
              </Button>
            </FormActions>
          </FormPanel>
        </div>
      )}

      {milestones.length === 0 ? (
        <Empty title="No milestones yet">
          Milestones are the dated checkpoints management reads this project by.
          Each one needs an owner and a due date; slipping past that date forces
          a recorded delay reason.
        </Empty>
      ) : (
        <RowList>
          {milestones.map((m) => (
            <li key={m.id} className={ROW}>
              <Monogram name={m.ownerName} />
              <div className="min-w-[12rem] flex-1">
                <p className="font-medium text-text-high">{m.name}</p>
                <p className="mt-ds-xxs text-caption-2 text-muted-foreground">
                  {m.ownerName} · due <Num>{formatDate(m.dueDate.slice(0, 10))}</Num>
                </p>
              </div>
              {/* Schedule risk is a status claim, so it reads as a status
                  marker rather than a trailing sentence fragment. */}
              {m.overdue ? (
                <Pill tone="error" label="Overdue" />
              ) : m.atRisk ? (
                <Pill tone="warning" label="At risk" />
              ) : null}
              <Pill
                tone={MILESTONE_STATUS_TONE[m.status]}
                label={MILESTONE_STATUS_LABELS[m.status]}
              />
              {canManageDependencies && (
                <DependencyPicker
                  candidates={dependencyCandidates.filter(
                    (c) => !(c.type === "MILESTONE" && c.id === m.id),
                  )}
                  currentEdges={dependencies.filter(
                    (d) => d.dependentType === "MILESTONE" && d.dependentId === m.id,
                  )}
                  itemId={m.id}
                  itemLabel={m.name}
                  itemType="MILESTONE"
                  onChanged={onChanged}
                  projectId={projectId}
                />
              )}
              {canManage && m.status !== "DONE" && (
                <RowStatusSelect
                  label={`Update status for ${m.name}`}
                  value={m.status}
                  options={MILESTONE_STATUS_OPTIONS}
                  disabled={busyId === m.id}
                  onChange={(next) => updateStatus(m.id, next)}
                />
              )}
            </li>
          ))}
        </RowList>
      )}

      {/* Recorded delays are the "why is this late" half of the north star:
          collecting them and never showing them would defeat the point. */}
      {delayReasons.length > 0 && (
        <div className="mt-ds-7xl">
          <Subhead count={delayReasons.length}>Recorded delays</Subhead>
          <ul className="mt-ds-2xl flex flex-col gap-ds-md">
            {delayReasons.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-warn-outline bg-warn-wash px-ds-2xl py-ds-xl text-body-1 text-warn-high"
              >
                <p className="font-medium">
                  {DELAY_REASON_LABELS[r.category] ?? "Other"}
                  {r.milestoneId && milestoneNameById.get(r.milestoneId) && (
                    <span className="font-normal">
                      {" · "}
                      {milestoneNameById.get(r.milestoneId)}
                    </span>
                  )}
                </p>
                {r.note && <p className="mt-ds-xs max-w-[64ch] text-para">{r.note}</p>}
                <p className="mt-ds-md text-caption-2 opacity-80">
                  {r.recordedByName} · <Num>{formatDateTime(r.createdAt)}</Num>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Block>
  );
}

function TasksBlock({
  projectId,
  tasks,
  milestones,
  userOptions,
  canUpdate,
  canManageDependencies,
  dependencies,
  dependencyCandidates,
  onChanged,
}: {
  projectId: string;
  tasks: TaskView[];
  milestones: MilestoneView[];
  userOptions: { value: string; label: string }[];
  canUpdate: boolean;
  canManageDependencies: boolean;
  dependencies: ItemDependencyView[];
  dependencyCandidates: DependencyCandidate[];
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [action, setAction] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [relatedMilestoneId, setRelatedMilestoneId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const milestoneOptions = milestones.map((m) => ({ value: m.id, label: m.name }));
  const milestoneNameById = new Map(milestones.map((m) => [m.id, m.name]));

  function clearFieldError(key: string) {
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function closeForm() {
    setShowForm(false);
    setFieldErrors({});
    setError(null);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!action.trim()) errors.action = "Describe the next action.";
    if (!ownerId) errors.ownerId = "Assign an owner.";
    if (deadline && deadline < todayIsoDate()) {
      errors.deadline = "A deadline in the past can’t be met. Pick today or later.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstInvalid = errors.action
        ? "task-action"
        : errors.ownerId
          ? "task-owner"
          : "task-deadline";
      document.getElementById(firstInvalid)?.focus();
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
      closeForm();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t add the task.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(taskId: string, status: string) {
    setError(null);
    setBusyId(taskId);
    try {
      await patchJson(`/api/v1/projects/${projectId}/tasks/${taskId}`, { status });
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Couldn’t update the task.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function updateProgress(taskId: string, progressPercent: number) {
    setError(null);
    setBusyId(taskId);
    try {
      await patchJson(`/api/v1/projects/${projectId}/tasks/${taskId}`, { progressPercent });
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Couldn’t update progress.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Block
      id="tasks"
      eyebrow="Next moves"
      title="Tasks"
      count={tasks.length}
      action={
        canUpdate && !showForm ? (
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            <PlusIcon aria-hidden="true" /> Add task
          </Button>
        ) : null
      }
    >
      <LiveRegion>
        {error && (
          <div className="mb-ds-2xl">
            <InlineBanner
              tone="error"
              title="Task action failed"
              onDismiss={() => setError(null)}
            >
              {error}
            </InlineBanner>
          </div>
        )}
      </LiveRegion>

      {showForm && (
        <div className="mb-ds-5xl">
          <FormPanel onSubmit={handleCreate}>
            <TextInputField
              id="task-action"
              label="Action"
              value={action}
              onChange={(value) => {
                setAction(value);
                clearFieldError("action");
              }}
              required
              error={fieldErrors.action}
            />
            <SelectField
              id="task-owner"
              label="Owner"
              value={ownerId}
              onChange={(value) => {
                setOwnerId(value);
                clearFieldError("ownerId");
              }}
              options={userOptions}
              required
              error={fieldErrors.ownerId}
            />
            <TextInputField
              id="task-deadline"
              label="Deadline"
              type="date"
              value={deadline}
              onChange={(value) => {
                setDeadline(value);
                clearFieldError("deadline");
              }}
              error={fieldErrors.deadline}
            />
            <SelectField
              id="task-milestone"
              label="Related milestone"
              value={relatedMilestoneId}
              onChange={setRelatedMilestoneId}
              options={milestoneOptions}
              placeholder={
                milestoneOptions.length === 0 ? "No milestones yet" : "Select…"
              }
              disabled={milestoneOptions.length === 0}
            />
            <FormActions>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? "Adding…" : "Add task"}
              </Button>
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
            </FormActions>
          </FormPanel>
        </div>
      )}

      {tasks.length === 0 ? (
        <Empty title="No tasks yet">
          Tasks are the next concrete moves under a milestone: one owner, one
          action, and an optional deadline. Add the one thing that has to happen
          next.
        </Empty>
      ) : (
        <RowList>
          {tasks.map((t) => (
            <li key={t.id} className={ROW}>
              <Monogram name={t.ownerName} />
              <div className="min-w-[12rem] flex-1">
                <p className="font-medium text-text-high">{t.action}</p>
                <p className="mt-ds-xxs text-caption-2 text-muted-foreground">
                  {t.ownerName}
                  {t.deadline && (
                    <>
                      {" · due "}
                      <Num>{formatDate(t.deadline.slice(0, 10))}</Num>
                    </>
                  )}
                  {t.relatedMilestoneId &&
                    milestoneNameById.get(t.relatedMilestoneId) &&
                    ` · ${milestoneNameById.get(t.relatedMilestoneId)}`}
                </p>
              </div>
              <Pill
                tone={TASK_STATUS_TONE[t.status]}
                label={TASK_STATUS_LABELS[t.status]}
              />
              {canUpdate && (
                <label className="flex items-center gap-ds-xs text-caption-2 text-text-low">
                  Progress
                  <input
                    aria-label={`Progress for ${t.action}`}
                    className="h-8 w-16 rounded-md border border-outline-med bg-surface-2 px-ds-sm text-caption-2 text-text-high disabled:cursor-progress disabled:opacity-60"
                    defaultValue={t.progressPercent}
                    disabled={busyId === t.id}
                    max={100}
                    min={0}
                    onBlur={(event) => {
                      const next = Number(event.currentTarget.value);
                      if (Number.isNaN(next) || next === t.progressPercent) return;
                      updateProgress(t.id, Math.min(100, Math.max(0, Math.round(next))));
                    }}
                    step={5}
                    type="number"
                  />
                  %
                </label>
              )}
              {canManageDependencies && (
                <DependencyPicker
                  candidates={dependencyCandidates.filter(
                    (c) => !(c.type === "TASK" && c.id === t.id),
                  )}
                  currentEdges={dependencies.filter(
                    (d) => d.dependentType === "TASK" && d.dependentId === t.id,
                  )}
                  itemId={t.id}
                  itemLabel={t.action}
                  itemType="TASK"
                  onChanged={onChanged}
                  projectId={projectId}
                />
              )}
              {canUpdate && t.status !== "DONE" && (
                <RowStatusSelect
                  label={`Update status for ${t.action}`}
                  value={t.status}
                  options={TASK_STATUS_OPTIONS}
                  disabled={busyId === t.id}
                  onChange={(next) => updateStatus(t.id, next)}
                />
              )}
            </li>
          ))}
        </RowList>
      )}
    </Block>
  );
}
