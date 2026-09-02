"use client";

import { useId, useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextInputField,
} from "@/components/ui/Field";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { todayIsoDate } from "@/lib/format";
import {
  POSITION_LEVELS,
  POSITION_LEVEL_LABELS,
  REQUISITION_STATUS_LABELS,
  type OrgUnitRef,
  type PersonRef,
} from "@/lib/types/domain";

/**
 * New-requisition form — every field spec Sec 6 > Requisitions lists:
 * business unit, department, position, vacancy count, position level, hiring
 * manager, assigned recruiter, target joining date, approval status, ERF/RRF
 * attachment.
 *
 * Only two approval statuses are offered on create. The remaining five
 * (`APPROVED`, `OPEN`, `ON_HOLD`, `FILLED`, `CLOSED`) are outcomes of the
 * approval chain and the recruiting process, not things a recruiter types in —
 * offering them here would let the UI assert an approval that never happened.
 */

const CREATE_STATUSES = ["DRAFT", "AWAITING_APPROVAL"] as const;

type Errors = Partial<
  Record<
    | "businessUnit"
    | "department"
    | "position"
    | "vacancyCount"
    | "positionLevel"
    | "hiringManager"
    | "recruiter"
    | "targetJoiningDate"
    | "approvalStatus",
    string
  >
>;

type SubmitState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "submitted" }
  | { phase: "error"; message: string };

export function RequisitionForm({
  businessUnits,
  departments,
  recruiters,
  hiringManagers,
}: {
  businessUnits: readonly OrgUnitRef[];
  departments: readonly (OrgUnitRef & { businessUnitId: string })[];
  recruiters: readonly PersonRef[];
  hiringManagers: readonly PersonRef[];
}) {
  const prefix = useId();

  const [businessUnitId, setBusinessUnitId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [position, setPosition] = useState("");
  const [vacancyCount, setVacancyCount] = useState("1");
  const [positionLevel, setPositionLevel] = useState("");
  const [hiringManagerId, setHiringManagerId] = useState("");
  const [recruiterId, setRecruiterId] = useState("");
  const [targetJoiningDate, setTargetJoiningDate] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<string>("DRAFT");
  const [notes, setNotes] = useState("");
  const [erfFile, setErfFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<SubmitState>({ phase: "idle" });

  const submitting = state.phase === "submitting";

  const departmentOptions = useMemo(
    () =>
      departments
        .filter((department) => department.businessUnitId === businessUnitId)
        .map((department) => ({
          value: department.id,
          label: department.name,
        })),
    [departments, businessUnitId],
  );

  function validate(): Errors {
    const found: Errors = {};
    if (!businessUnitId) found.businessUnit = "Choose the business unit.";
    if (!departmentId) found.department = "Choose the department.";
    if (!position.trim()) {
      found.position = "Enter the position title as it will be advertised.";
    }
    const vacancies = Number(vacancyCount);
    if (!Number.isInteger(vacancies) || vacancies < 1 || vacancies > 999) {
      found.vacancyCount = "Enter how many people are being hired (1–999).";
    }
    if (!positionLevel) found.positionLevel = "Choose the position level.";
    if (!hiringManagerId) {
      found.hiringManager = "Choose the hiring manager who owns this vacancy.";
    }
    if (!recruiterId) {
      found.recruiter =
        "Choose the recruiter accountable for filling this requisition.";
    }
    if (!targetJoiningDate) {
      found.targetJoiningDate = "Set the date the hire is needed by.";
    } else if (targetJoiningDate < todayIsoDate()) {
      found.targetJoiningDate = "The target joining date is in the past.";
    }
    if (!approvalStatus) found.approvalStatus = "Choose a starting status.";
    return found;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.getElementById(`${prefix}-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    setState({ phase: "submitting" });

    /* ──────────────────────────────────────────────────────────────────────
     * SWAP POINT — requisition create
     *
     * `POST /api/v1/requisitions` exists already.
     *
     * TODO(frontend): replace this no-op with:
     *
     *   const requisition = await postJson("/api/v1/requisitions", {
     *     businessUnitId, departmentId, position,
     *     vacancyCount: Number(vacancyCount), positionLevel,
     *     hiringManagerId, assignedRecruiterId: recruiterId,
     *     targetJoiningDate, erfRrfDocumentId,
     *   });
     *   router.push(`/requisitions/${requisition.id}`);
     *
     * Three contract mismatches to settle before that swap:
     *   1. The route ignores a client-supplied status and always creates as
     *      DRAFT. So "Starting status: Awaiting approval" has to become a
     *      follow-up `PATCH /api/v1/requisitions/{id}/status` — or the field
     *      is dropped from this form. Not decided unilaterally here.
     *   2. `notes` is not in the create schema. Either add it server-side or
     *      remove the field; it is optional today, so nothing breaks either
     *      way.
     *   3. `erfRrfDocumentId` must reference an existing `Document` row, and
     *      no route creates one yet — see the TODO(backend) block in
     *      `components/ui/DocumentUpload.tsx`.
     *
     * The ERF/RRF is staged in `erfFile` rather than uploaded on selection,
     * because a presigned key needs a real ownerId that only exists after the
     * POST. On the *detail* page the upload runs for real, since the id exists.
     * ────────────────────────────────────────────────────────────────────── */
    await new Promise((resolve) => setTimeout(resolve, 400));
    setState({ phase: "submitted" });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-lg">
      <LiveRegion>
        {state.phase === "submitted" && (
          <InlineBanner
            tone="info"
            title="Not saved — the requisition API isn’t wired up yet"
            onDismiss={() => setState({ phase: "idle" })}
          >
            The form validated and would have posted to{" "}
            <code className="font-mono text-caption">
              POST /api/v1/requisitions
            </code>
            . See the SWAP POINT comment in{" "}
            <code className="font-mono text-caption">
              components/requisitions/RequisitionForm.tsx
            </code>
            .
          </InlineBanner>
        )}
        {state.phase === "error" && (
          <InlineBanner
            tone="error"
            title="That requisition wasn’t saved"
            onDismiss={() => setState({ phase: "idle" })}
          >
            {state.message}
          </InlineBanner>
        )}
      </LiveRegion>

      <fieldset className="flex flex-col gap-md border-0 p-0">
        <legend className="mb-sm text-subhead text-text">Where</legend>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <SelectField
            id={`${prefix}-businessUnit`}
            label="Business unit"
            required
            disabled={submitting}
            value={businessUnitId}
            onChange={(value) => {
              setBusinessUnitId(value);
              setDepartmentId("");
            }}
            error={errors.businessUnit}
            options={businessUnits.map((unit) => ({
              value: unit.id,
              label: unit.name,
            }))}
          />
          <SelectField
            id={`${prefix}-department`}
            label="Department"
            required
            disabled={submitting || !businessUnitId}
            value={departmentId}
            onChange={setDepartmentId}
            error={errors.department}
            hint={
              businessUnitId
                ? undefined
                : "Choose a business unit first."
            }
            options={departmentOptions}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-md border-0 p-0">
        <legend className="mb-sm text-subhead text-text">What</legend>

        <TextInputField
          id={`${prefix}-position`}
          label="Position"
          required
          disabled={submitting}
          value={position}
          onChange={setPosition}
          error={errors.position}
          hint="The job title candidates will see."
        />

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <NumberField
            id={`${prefix}-vacancyCount`}
            label="Vacancy count"
            required
            min={1}
            max={999}
            disabled={submitting}
            value={vacancyCount}
            onChange={setVacancyCount}
            error={errors.vacancyCount}
          />
          <SelectField
            id={`${prefix}-positionLevel`}
            label="Position level"
            required
            disabled={submitting}
            value={positionLevel}
            onChange={setPositionLevel}
            error={errors.positionLevel}
            hint="Drives which approval chain applies."
            options={POSITION_LEVELS.map((value) => ({
              value,
              label: POSITION_LEVEL_LABELS[value],
            }))}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-md border-0 p-0">
        <legend className="mb-sm text-subhead text-text">Who and when</legend>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <SelectField
            id={`${prefix}-hiringManager`}
            label="Hiring manager"
            required
            disabled={submitting}
            value={hiringManagerId}
            onChange={setHiringManagerId}
            error={errors.hiringManager}
            options={hiringManagers.map((person) => ({
              value: person.id,
              label: person.name,
            }))}
          />
          <SelectField
            id={`${prefix}-recruiter`}
            label="Assigned recruiter"
            required
            disabled={submitting}
            value={recruiterId}
            onChange={setRecruiterId}
            error={errors.recruiter}
            options={recruiters.map((person) => ({
              value: person.id,
              label: person.name,
            }))}
          />
          <TextInputField
            id={`${prefix}-targetJoiningDate`}
            label="Target joining date"
            type="date"
            required
            disabled={submitting}
            value={targetJoiningDate}
            onChange={setTargetJoiningDate}
            error={errors.targetJoiningDate}
          />
          <SelectField
            id={`${prefix}-approvalStatus`}
            label="Starting status"
            required
            disabled={submitting}
            value={approvalStatus}
            onChange={setApprovalStatus}
            error={errors.approvalStatus}
            hint="Later statuses are set by the approval chain, not here."
            options={CREATE_STATUSES.map((value) => ({
              value,
              label: REQUISITION_STATUS_LABELS[value],
            }))}
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-md border-0 p-0">
        <legend className="mb-sm text-subhead text-text">Paperwork</legend>

        <DocumentUpload
          ownerType="REQUISITION"
          ownerId={null}
          label="ERF / RRF"
          hint="The signed employee or recruitment requisition form. Attached when you save."
          onFileStaged={setErfFile}
        />

        <TextAreaField
          id={`${prefix}-notes`}
          label="Notes"
          rows={3}
          disabled={submitting}
          value={notes}
          onChange={setNotes}
          hint="Context for the recruiter — hard requirements, why the role exists."
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-md border-t border-border pt-lg">
        <Button
          type="submit"
          variant="primary"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Saving…" : "Save requisition"}
        </Button>
        <ButtonLink href="/requisitions" variant="ghost">
          Cancel
        </ButtonLink>
        {erfFile && (
          <span className="text-body-sm text-muted">
            “{erfFile.name}” will upload with this record.
          </span>
        )}
      </div>
    </form>
  );
}
