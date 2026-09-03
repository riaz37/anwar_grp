"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { SelectField, TextAreaField, TextInputField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { ApiRequestError, postJson } from "@/lib/api-client";
import { todayIsoDate } from "@/lib/format";

interface RefUser {
  id: string;
  name: string;
  role: Role;
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

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Project name is required.";
    if (!businessUnitId) errors.businessUnitId = "Choose a business unit.";
    if (!departmentId) errors.departmentId = "Choose a department.";
    if (!businessProblem.trim()) errors.businessProblem = "Describe the business problem.";
    if (!expectedOutcome.trim()) errors.expectedOutcome = "Describe the expected outcome.";
    if (!ownerId) errors.ownerId = "Assign a project owner.";
    if (!expectedDeliveryDate) errors.expectedDeliveryDate = "Set an expected delivery date.";
    setFieldErrors(errors);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
      <LiveRegion>
        {formError && (
          <InlineBanner tone="error" title="Couldn’t create project">
            {formError}
          </InlineBanner>
        )}
      </LiveRegion>

      <TextInputField
        id="name"
        label="Project name"
        value={name}
        onChange={setName}
        required
        error={fieldErrors.name}
      />

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <SelectField
          id="businessUnitId"
          label="Business unit"
          value={businessUnitId}
          onChange={(v) => {
            setBusinessUnitId(v);
            setDepartmentId("");
          }}
          options={businessUnits.map((b) => ({ value: b.id, label: b.name }))}
          required
          error={fieldErrors.businessUnitId}
        />
        <SelectField
          id="departmentId"
          label="Department"
          value={departmentId}
          onChange={setDepartmentId}
          options={departmentOptions}
          required
          error={fieldErrors.departmentId}
        />
      </div>

      <TextAreaField
        id="businessProblem"
        label="Business problem"
        hint="What's broken or missing today?"
        value={businessProblem}
        onChange={setBusinessProblem}
        required
        error={fieldErrors.businessProblem}
      />

      <TextAreaField
        id="expectedOutcome"
        label="Expected outcome"
        hint="What does success look like?"
        value={expectedOutcome}
        onChange={setExpectedOutcome}
        required
        error={fieldErrors.expectedOutcome}
      />

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <SelectField
          id="ownerId"
          label="Project owner"
          hint="Accountable for delivery."
          value={ownerId}
          onChange={setOwnerId}
          options={userOptions}
          required
          error={fieldErrors.ownerId}
        />
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
        value={expectedDeliveryDate}
        onChange={setExpectedDeliveryDate}
        required
        error={fieldErrors.expectedDeliveryDate}
        placeholder={todayIsoDate()}
      />

      <div className="flex items-center gap-sm border-t border-border pt-lg">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "Creating…" : "Create project"}
        </Button>
      </div>
    </form>
  );
}

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}
