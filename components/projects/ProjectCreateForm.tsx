"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { SelectField, TextAreaField, TextInputField } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { ApiRequestError, postJson } from "@/lib/api-client";
import { formatDate, todayIsoDate } from "@/lib/format";
import { STAGE_LABELS, STAGE_ORDER, roleLabel } from "./projectTone";

interface RefUser {
  id: string;
  name: string;
  role: Role;
}

/** Field ids in the order they appear, so a failed validation can focus the
 *  first thing the user actually has to fix rather than the last. These are
 *  also exactly the required fields, so the completion meter counts them. */
const FIELD_ORDER = [
  "name",
  "businessUnitId",
  "departmentId",
  "businessProblem",
  "expectedOutcome",
  "ownerId",
  "expectedDeliveryDate",
] as const;

/** Stages shown in the rail preview; the rest are summarised as a count. */
const PREVIEW_STAGE_COUNT = 4;

/**
 * One band of the registration sheet.
 *
 * Layout is a label gutter + field column rather than a card: at ≥768px the
 * indexed group name sits in the left margin like a drawing annotation, and
 * the controls hold a single uninterrupted column. Bands are separated by a
 * hairline, never by a nested box.
 *
 * Grouping is exposed to assistive tech with `<fieldset aria-labelledby>`
 * rather than `<legend>`, because a rendered `<legend>` cannot be placed in
 * the gutter without leaving the fieldset's anonymous box.
 */
function FormBand({
  step,
  legend,
  hint,
  first = false,
  children,
}: {
  step: string;
  legend: string;
  hint: string;
  first?: boolean;
  children: ReactNode;
}) {
  const labelId = `band-${step}-label`;
  return (
    <fieldset
      aria-labelledby={labelId}
      className={
        "grid min-w-0 gap-ds-5xl md:grid-cols-[132px_minmax(0,1fr)] md:gap-ds-7xl" +
        (first ? "" : " border-t border-outline-low pt-ds-7xl")
      }
    >
      <div className="min-w-0">
        <p className="annotation font-data tabular-nums">{step}</p>
        <h2 id={labelId} className="mt-ds-xxs text-title-1 font-semibold text-text-high">
          {legend}
        </h2>
        <p className="mt-ds-xs text-pretty text-para text-text-low">{hint}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-ds-5xl">{children}</div>
    </fieldset>
  );
}

/** One line of the live rail: annotation label, then the value or a dash. */
function RailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-ds-2xl">
      <dt className="annotation shrink-0">{label}</dt>
      <dd className="min-w-0 truncate text-right text-body-1 text-text-med">{value}</dd>
    </div>
  );
}

export function ProjectCreateForm({
  businessUnits,
  departments,
  users,
}: {
  businessUnits: { id: string; name: string }[];
  departments: { id: string; name: string; businessUnitId: string }[];
  users: RefUser[];
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [businessProblem, setBusinessProblem] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [analystId, setAnalystId] = useState("");
  const [developerId, setDeveloperId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const departmentOptions = useMemo(
    () =>
      departments
        .filter((d) => !businessUnitId || d.businessUnitId === businessUnitId)
        .map((d) => ({ value: d.id, label: d.name })),
    [departments, businessUnitId],
  );

  const userOptions = useMemo(
    () => users.map((u) => ({ value: u.id, label: `${u.name} (${roleLabel(u.role)})` })),
    [users],
  );

  const userName = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u.name]));
    return (id: string) => byId.get(id) ?? null;
  }, [users]);

  const values: Record<(typeof FIELD_ORDER)[number], string> = {
    name,
    businessUnitId,
    departmentId,
    businessProblem,
    expectedOutcome,
    ownerId,
    expectedDeliveryDate,
  };
  const completed = FIELD_ORDER.filter((key) => values[key].trim() !== "").length;
  const ratio = completed / FIELD_ORDER.length;

  const unitName = businessUnits.find((b) => b.id === businessUnitId)?.name ?? null;
  const deptName = departments.find((d) => d.id === departmentId)?.name ?? null;

  /** Clears a field's error as soon as the user starts fixing it — an error
   *  that stays put while you type reads as "still wrong". */
  function change(setter: (value: string) => void, key: string) {
    return (value: string) => {
      setter(value);
      setFieldErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    };
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name the project.";
    else if (name.trim().length < 3) errors.name = "Use at least 3 characters.";
    if (!businessUnitId) errors.businessUnitId = "Choose a business unit.";
    if (!departmentId) errors.departmentId = "Choose a department.";
    if (!businessProblem.trim()) errors.businessProblem = "Describe the business problem.";
    if (!expectedOutcome.trim()) errors.expectedOutcome = "Describe the expected outcome.";
    if (!ownerId) errors.ownerId = "Assign a project owner.";
    if (!expectedDeliveryDate) {
      errors.expectedDeliveryDate = "Set an expected delivery date.";
    } else if (expectedDeliveryDate < todayIsoDate()) {
      errors.expectedDeliveryDate = `Pick a date from ${formatDate(todayIsoDate())} onward.`;
    }
    setFieldErrors(errors);

    const firstInvalid = FIELD_ORDER.find((key) => errors[key]);
    if (firstInvalid) document.getElementById(firstInvalid)?.focus();
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const project = await postJson<{ id: string }>("/api/v1/projects", {
        name: name.trim(),
        businessUnitId,
        departmentId,
        businessProblem: businessProblem.trim(),
        expectedOutcome: expectedOutcome.trim(),
        ownerId,
        analystId: analystId || undefined,
        developerId: developerId || undefined,
        expectedDeliveryDate,
      });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setFormError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn’t create the project. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-w-0 items-start gap-ds-9xl lg:grid-cols-[minmax(0,1fr)_264px] lg:gap-ds-7xl">
      <form onSubmit={handleSubmit} noValidate className="flex min-w-0 flex-col gap-ds-7xl">
        <LiveRegion>
          {formError && (
            <InlineBanner tone="error" title="Couldn’t create project">
              {formError}
            </InlineBanner>
          )}
        </LiveRegion>

        <FormBand
          first
          step="01"
          legend="Identification"
          hint="What this initiative is called, and who owns it organisationally."
        >
          <TextInputField
            id="name"
            label="Project name"
            placeholder="e.g. Warehouse demand forecasting"
            hint="How this initiative is referred to in review meetings."
            value={name}
            onChange={change(setName, "name")}
            required
            error={fieldErrors.name}
          />

          <div className="grid grid-cols-1 gap-ds-5xl sm:grid-cols-2">
            <SelectField
              id="businessUnitId"
              label="Business unit"
              value={businessUnitId}
              onChange={(v) => {
                setBusinessUnitId(v);
                setDepartmentId("");
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next.businessUnitId;
                  delete next.departmentId;
                  return next;
                });
              }}
              options={businessUnits.map((b) => ({ value: b.id, label: b.name }))}
              required
              error={fieldErrors.businessUnitId}
            />
            <SelectField
              id="departmentId"
              label="Department"
              hint={businessUnitId ? undefined : "Choose a business unit first."}
              value={departmentId}
              onChange={change(setDepartmentId, "departmentId")}
              options={departmentOptions}
              placeholder={businessUnitId ? "Select…" : "Select a business unit first"}
              disabled={!businessUnitId}
              required
              error={fieldErrors.departmentId}
            />
          </div>
        </FormBand>

        <FormBand
          step="02"
          legend="The case"
          hint="Recorded once at Idea stage and reviewed at the Approval gate."
        >
          <TextAreaField
            id="businessProblem"
            label="Business problem"
            hint="What's broken or missing today?"
            value={businessProblem}
            onChange={change(setBusinessProblem, "businessProblem")}
            required
            error={fieldErrors.businessProblem}
          />

          <TextAreaField
            id="expectedOutcome"
            label="Expected outcome"
            hint="What does success look like?"
            value={expectedOutcome}
            onChange={change(setExpectedOutcome, "expectedOutcome")}
            required
            error={fieldErrors.expectedOutcome}
          />
        </FormBand>

        <FormBand
          step="03"
          legend="People and dates"
          hint="One accountable owner. Analyst and developer can be assigned later by the AI Team Lead."
        >
          <SelectField
            id="ownerId"
            label="Project owner"
            hint="Accountable for delivery."
            value={ownerId}
            onChange={change(setOwnerId, "ownerId")}
            options={userOptions}
            required
            error={fieldErrors.ownerId}
          />

          <div className="grid grid-cols-1 gap-ds-5xl sm:grid-cols-2">
            <SelectField
              id="analystId"
              label="AI analyst"
              value={analystId}
              onChange={setAnalystId}
              options={userOptions}
            />
            <SelectField
              id="developerId"
              label="Developer"
              value={developerId}
              onChange={setDeveloperId}
              options={userOptions}
            />
          </div>

          <TextInputField
            id="expectedDeliveryDate"
            label="Expected delivery date"
            type="date"
            hint="The date this is currently committed to. Changing it later requires a recorded scope change."
            value={expectedDeliveryDate}
            onChange={change(setExpectedDeliveryDate, "expectedDeliveryDate")}
            required
            error={fieldErrors.expectedDeliveryDate}
          />
        </FormBand>

        <div className="flex flex-wrap items-center gap-ds-md border-t border-outline-low pt-ds-5xl">
          <Button type="submit" variant="primary" disabled={submitting} aria-busy={submitting}>
            {submitting ? "Creating…" : "Create project"}
          </Button>
          <ButtonLink href="/projects" variant="ghost">
            Cancel
          </ButtonLink>
          <p className="ml-auto text-caption-2 text-text-low">
            Saved to the portfolio immediately. Nothing is sent for approval yet.
          </p>
        </div>
      </form>

      {/* Live rail. Reflects what has been entered so far and where the record
          lands, so the pipeline consequence of pressing Create is visible
          before it is pressed rather than only on the detail page after. */}
      <aside
        aria-label="Record preview"
        className="min-w-0 rounded-xl border border-outline-low bg-surface-0 p-ds-5xl lg:sticky lg:top-ds-5xl"
      >
        <div className="flex items-baseline justify-between gap-ds-md">
          <p className="annotation">Preview</p>
          <p className="font-data text-caption-2 tabular-nums text-text-low">
            <span className={completed === FIELD_ORDER.length ? "text-primary-high" : "text-text-med"}>
              {completed}
            </span>
            /{FIELD_ORDER.length}
          </p>
        </div>

        <div
          className="mt-ds-md h-px w-full overflow-hidden bg-outline-med"
          role="progressbar"
          aria-label="Required fields completed"
          aria-valuemin={0}
          aria-valuemax={FIELD_ORDER.length}
          aria-valuenow={completed}
        >
          <div
            className="h-full w-full origin-left bg-primary-med transition-transform duration-300 ease-[var(--ease-move)]"
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>

        <p className="mt-ds-4xl text-pretty text-title-1 font-semibold text-text-high">
          {name.trim() || <span className="text-text-low">Untitled project</span>}
        </p>
        <p className="mt-ds-xxs truncate text-para text-text-low">
          {unitName ? `${unitName}${deptName ? ` › ${deptName}` : ""}` : "No business unit yet"}
        </p>

        <dl className="mt-ds-5xl flex flex-col gap-ds-md border-t border-outline-low pt-ds-5xl">
          <RailRow
            label="Owner"
            value={userName(ownerId) ?? <span className="text-text-low">Unassigned</span>}
          />
          <RailRow
            label="Analyst"
            value={userName(analystId) ?? <span className="text-text-low">Later</span>}
          />
          <RailRow
            label="Developer"
            value={userName(developerId) ?? <span className="text-text-low">Later</span>}
          />
          <RailRow
            label="Due"
            value={
              expectedDeliveryDate ? (
                <span className="font-data tabular-nums">{formatDate(expectedDeliveryDate)}</span>
              ) : (
                <span className="text-text-low">Not set</span>
              )
            }
          />
        </dl>

        <div className="mt-ds-5xl border-t border-outline-low pt-ds-5xl">
          <p className="annotation">Stage pipeline</p>
          <ol className="mt-ds-md flex flex-col gap-ds-md">
            {STAGE_ORDER.slice(0, PREVIEW_STAGE_COUNT).map((stage, index) => {
              const isEntry = index === 0;
              return (
                <li key={stage} className="flex items-center gap-ds-md">
                  <span
                    aria-hidden
                    className={
                      "h-[7px] w-[7px] shrink-0 rounded-pill " +
                      (isEntry ? "bg-primary-med" : "bg-outline-high")
                    }
                  />
                  <span
                    className={
                      "truncate text-body-1 " +
                      (isEntry ? "font-semibold text-text-high" : "text-text-low")
                    }
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                  {isEntry && (
                    <span className="ml-auto shrink-0 rounded-pill bg-primary-wash px-ds-md text-caption-1 font-semibold uppercase tracking-[0.08em] text-primary-high">
                      Starts here
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-ds-md text-caption-2 text-text-low">
            + {STAGE_ORDER.length - PREVIEW_STAGE_COUNT} further gated stages through to
            Completed.
          </p>
        </div>
      </aside>
    </div>
  );
}
