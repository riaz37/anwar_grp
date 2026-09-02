"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { FilterSelect, SearchInput } from "@/components/ui/Filters";
import { RequisitionStatusPill } from "@/components/ui/StatusPill";
import {
  nextSort,
  SortableHeader,
  type SortState,
} from "@/components/ui/SortableHeader";
import { TH_BASE } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  POSITION_LEVEL_LABELS,
  REQUISITION_STATUSES,
  REQUISITION_STATUS_LABELS,
  type Requisition,
} from "@/lib/types/domain";

type SortKey =
  | "ref"
  | "position"
  | "vacancyCount"
  | "targetJoiningDate"
  | "approvalStatus";

/** Table order for status sorting = workflow order, not alphabetical. */
const STATUS_ORDER = new Map(
  REQUISITION_STATUSES.map((status, index) => [status, index]),
);

/* Progressive column disclosure. At 390px only reference, position and status
   survive — enough to find a row and see its state without sideways scrolling,
   which is the thing that makes data tables unusable on a phone. */
const COMPACT_COL = "hidden md:table-cell";
const SECONDARY_COL = "hidden lg:table-cell";
const TERTIARY_COL = "hidden xl:table-cell";

const CELL = "px-xs py-sm align-top text-body-sm sm:px-sm md:px-md";

function compare(a: Requisition, b: Requisition, key: SortKey): number {
  switch (key) {
    case "vacancyCount":
      return a.vacancyCount - b.vacancyCount;
    case "approvalStatus":
      return (
        (STATUS_ORDER.get(a.approvalStatus) ?? 0) -
        (STATUS_ORDER.get(b.approvalStatus) ?? 0)
      );
    case "targetJoiningDate":
      return a.targetJoiningDate.localeCompare(b.targetJoiningDate);
    case "position":
      return a.position.localeCompare(b.position);
    default:
      return a.ref.localeCompare(b.ref);
  }
}

export function RequisitionsTable({
  requisitions,
}: {
  requisitions: Requisition[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [businessUnit, setBusinessUnit] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [sort, setSort] = useState<SortState<SortKey>>({
    key: "targetJoiningDate",
    direction: "asc",
  });

  // Options come from the loaded rows rather than a separate reference fetch,
  // so a filter can never offer a value that matches nothing on this page.
  const businessUnitOptions = useMemo(
    () =>
      dedupe(
        requisitions.map((requisition) => ({
          value: requisition.businessUnit.id,
          label: requisition.businessUnit.name,
        })),
      ),
    [requisitions],
  );

  const recruiterOptions = useMemo(
    () =>
      dedupe(
        requisitions.map((requisition) => ({
          value: requisition.assignedRecruiter.id,
          label: requisition.assignedRecruiter.name,
        })),
      ),
    [requisitions],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = requisitions.filter((requisition) => {
      if (status && requisition.approvalStatus !== status) return false;
      if (businessUnit && requisition.businessUnit.id !== businessUnit) {
        return false;
      }
      if (recruiter && requisition.assignedRecruiter.id !== recruiter) {
        return false;
      }
      if (!needle) return true;
      return [
        requisition.ref,
        requisition.position,
        requisition.department.name,
        requisition.businessUnit.name,
        requisition.hiringManager.name,
        requisition.assignedRecruiter.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) => compare(a, b, sort.key) * direction,
    );
  }, [requisitions, query, status, businessUnit, recruiter, sort]);

  const filtersActive = Boolean(query || status || businessUnit || recruiter);

  function clearFilters() {
    setQuery("");
    setStatus("");
    setBusinessUnit("");
    setRecruiter("");
  }

  function handleSort(key: SortKey) {
    setSort((current) => nextSort(current, key));
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center gap-md">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Search requisitions"
          placeholder="Reference, position, manager…"
        />
        <FilterSelect
          label="Status"
          allLabel="All statuses"
          value={status}
          onChange={setStatus}
          options={REQUISITION_STATUSES.map((value) => ({
            value,
            label: REQUISITION_STATUS_LABELS[value],
          }))}
        />
        <FilterSelect
          label="Unit"
          allLabel="All business units"
          value={businessUnit}
          onChange={setBusinessUnit}
          options={businessUnitOptions}
        />
        <FilterSelect
          label="Recruiter"
          allLabel="All recruiters"
          value={recruiter}
          onChange={setRecruiter}
          options={recruiterOptions}
        />
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 rounded-sm px-sm text-body-sm font-medium text-accent-ink transition-colors duration-100 ease-move hover:bg-accent-soft"
          >
            Clear filters
          </button>
        )}
      </div>

      <p aria-live="polite" className="font-data text-body-sm tabular-nums text-muted">
        {visible.length} of {requisitions.length} requisitions
      </p>

      {visible.length === 0 ? (
        <EmptyState
          filtersActive={filtersActive}
          onClearFilters={clearFilters}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-body-sm md:min-w-[52rem]">
            <caption className="sr-only">
              Requisitions, sortable by reference, position, vacancies, target
              joining date and approval status.
            </caption>
            <thead className="border-b border-border bg-surface-sunken">
              <tr>
                <SortableHeader columnKey="ref" sort={sort} onSort={handleSort}>
                  Reference
                </SortableHeader>
                <SortableHeader
                  columnKey="position"
                  sort={sort}
                  onSort={handleSort}
                >
                  Position
                </SortableHeader>
                <th scope="col" className={`${TH_BASE} ${SECONDARY_COL}`}>
                  Business unit
                </th>
                <SortableHeader
                  columnKey="vacancyCount"
                  sort={sort}
                  onSort={handleSort}
                  align="right"
                  className={COMPACT_COL}
                >
                  Vac.
                </SortableHeader>
                <th scope="col" className={`${TH_BASE} ${TERTIARY_COL}`}>
                  Hiring manager
                </th>
                <th scope="col" className={`${TH_BASE} ${SECONDARY_COL}`}>
                  Recruiter
                </th>
                <SortableHeader
                  columnKey="targetJoiningDate"
                  sort={sort}
                  onSort={handleSort}
                  className={COMPACT_COL}
                >
                  Target joining
                </SortableHeader>
                <SortableHeader
                  columnKey="approvalStatus"
                  sort={sort}
                  onSort={handleSort}
                >
                  Status
                </SortableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((requisition) => (
                <tr
                  key={requisition.id}
                  className="transition-colors duration-100 ease-move hover:bg-surface-sunken"
                >
                  <td
                    className={`${CELL} whitespace-nowrap font-data tabular-nums`}
                  >
                    <Link
                      href={`/requisitions/${requisition.id}`}
                      className="rounded-sm font-medium text-accent-ink underline decoration-transparent underline-offset-2 transition-colors duration-100 ease-move hover:decoration-current pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                    >
                      {requisition.ref}
                    </Link>
                  </td>
                  {/* Nowrap only from `md`: at 390px forcing a long title onto
                      one line pushes the status column off screen. */}
                  <td className={`${CELL} md:whitespace-nowrap`}>
                    <span className="font-medium text-text">
                      {requisition.position}
                    </span>
                    <span className="block text-caption text-muted">
                      {POSITION_LEVEL_LABELS[requisition.positionLevel]}
                    </span>
                  </td>
                  <td className={`${CELL} ${SECONDARY_COL} text-muted`}>
                    {requisition.businessUnit.name}
                    <span className="block text-caption">
                      {requisition.department.name}
                    </span>
                  </td>
                  <td
                    className={`${CELL} ${COMPACT_COL} text-right font-data tabular-nums text-text`}
                  >
                    {requisition.vacancyCount}
                  </td>
                  <td className={`${CELL} ${TERTIARY_COL} text-muted`}>
                    {requisition.hiringManager.name}
                  </td>
                  <td className={`${CELL} ${SECONDARY_COL} text-muted`}>
                    {requisition.assignedRecruiter.name}
                  </td>
                  <td
                    className={`${CELL} ${COMPACT_COL} whitespace-nowrap font-data tabular-nums text-text`}
                  >
                    {formatDate(requisition.targetJoiningDate)}
                  </td>
                  <td className={CELL}>
                    <RequisitionStatusPill status={requisition.approvalStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function dedupe(
  options: { value: string; label: string }[],
): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const option of options) seen.set(option.value, option.label);
  return [...seen]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function EmptyState({
  filtersActive,
  onClearFilters,
}: {
  filtersActive: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface px-lg py-2xl text-center">
      <h2 className="text-section text-text">
        {filtersActive ? "No requisitions match those filters" : "No requisitions yet"}
      </h2>
      <p className="mx-auto mt-sm max-w-[52ch] text-body-sm text-muted">
        {filtersActive
          ? "Try a broader status or business unit — a requisition only appears here once it has been registered, even while it is still a draft."
          : "A requisition records what is being hired for and who owns it: business unit, department, position, vacancy count, hiring manager and the recruiter accountable for filling it. Register the first one to start assigning candidates."}
      </p>
      <div className="mt-lg flex flex-wrap items-center justify-center gap-md">
        {filtersActive ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="min-h-11 rounded-sm border border-border-strong bg-surface px-md text-body-sm font-medium text-text transition-colors duration-100 ease-move hover:bg-surface-sunken"
          >
            Clear filters
          </button>
        ) : (
          <ButtonLink href="/requisitions/new" variant="primary">
            Register a requisition
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
