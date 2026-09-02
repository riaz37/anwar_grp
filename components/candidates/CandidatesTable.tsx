"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import { FilterSelect, SearchInput } from "@/components/ui/Filters";
import { StagePill } from "@/components/ui/StatusPill";
import {
  nextSort,
  SortableHeader,
  type SortState,
} from "@/components/ui/SortableHeader";
import { TH_BASE } from "@/components/ui/table";
import { PaperclipIcon } from "@/components/ui/icons";
import { dueLabel, urgencyOf } from "@/components/tasks/types";
import {
  ALL_STAGES,
  CANDIDATE_SOURCES,
  CANDIDATE_SOURCE_LABELS,
  isTerminalStage,
  PIPELINE_STAGES,
  STAGE_LABELS,
  type ApplicationSummary,
  type CandidateWithApplications,
} from "@/lib/types/domain";

type SortKey = "name" | "createdAt" | "applications" | "dueDate";

/* See RequisitionsTable for the rationale: at 390px this reduces to candidate,
   current stage and next due — no sideways scrolling to answer "who needs me". */
const COMPACT_COL = "hidden md:table-cell";
const SECONDARY_COL = "hidden lg:table-cell";
const TERTIARY_COL = "hidden xl:table-cell";
const CELL = "px-xs py-sm align-top text-body-sm sm:px-sm md:px-md";

const URGENCY_TEXT = {
  overdue: "text-error-ink",
  today: "text-warning-ink",
  upcoming: "text-muted",
} as const;

/**
 * The application a recruiter means when they say "where is this candidate?" —
 * the least-advanced live one (that is where the work is), falling back to the
 * most recent if every application has ended.
 */
function primaryApplication(
  candidate: CandidateWithApplications,
): ApplicationSummary | undefined {
  const live = candidate.applications.filter(
    (application) => !isTerminalStage(application.stage),
  );
  const pool = live.length > 0 ? live : candidate.applications;
  // Branch stages (ON_HOLD, REDIRECTED) are not on the line, so they sort
  // after every pipeline stage rather than before it.
  const rank = (application: ApplicationSummary) => {
    const index = PIPELINE_STAGES.indexOf(
      application.stage as (typeof PIPELINE_STAGES)[number],
    );
    return index === -1 ? PIPELINE_STAGES.length : index;
  };
  return [...pool].sort((a, b) => rank(a) - rank(b))[0];
}

export function CandidatesTable({
  candidates,
}: {
  candidates: CandidateWithApplications[];
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [stage, setStage] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState<SortKey>>({
    key: "dueDate",
    direction: "asc",
  });

  const recruiterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const candidate of candidates) {
      for (const application of candidate.applications) {
        seen.set(
          application.assignedRecruiter.id,
          application.assignedRecruiter.name,
        );
      }
    }
    return [...seen]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [candidates]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = candidates.filter((candidate) => {
      if (source && candidate.source !== source) return false;
      if (
        stage &&
        !candidate.applications.some(
          (application) => application.stage === stage,
        )
      ) {
        return false;
      }
      if (
        recruiter &&
        !candidate.applications.some(
          (application) => application.assignedRecruiter.id === recruiter,
        )
      ) {
        return false;
      }
      if (!needle) return true;
      return [
        candidate.name,
        candidate.email,
        candidate.mobile,
        ...candidate.applications.map(
          (application) =>
            `${application.requisitionRef} ${application.requisitionTitle}`,
        ),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "applications":
          return (a.applications.length - b.applications.length) * direction;
        case "createdAt":
          return a.createdAt.localeCompare(b.createdAt) * direction;
        case "dueDate": {
          const aDue = primaryApplication(a)?.dueDate ?? "9999-12-31";
          const bDue = primaryApplication(b)?.dueDate ?? "9999-12-31";
          return aDue.localeCompare(bDue) * direction;
        }
        default:
          return a.name.localeCompare(b.name) * direction;
      }
    });
  }, [candidates, query, source, stage, recruiter, sort]);

  const filtersActive = Boolean(query || source || stage || recruiter);

  function clearFilters() {
    setQuery("");
    setSource("");
    setStage("");
    setRecruiter("");
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center gap-md">
        <SearchInput
          value={query}
          onChange={setQuery}
          label="Search candidates"
          placeholder="Name, email, mobile, requisition…"
        />
        <FilterSelect
          label="Source"
          allLabel="All sources"
          value={source}
          onChange={setSource}
          options={CANDIDATE_SOURCES.map((value) => ({
            value,
            label: CANDIDATE_SOURCE_LABELS[value],
          }))}
        />
        <FilterSelect
          label="Stage"
          allLabel="All stages"
          value={stage}
          onChange={setStage}
          options={ALL_STAGES.map((value) => ({
            value,
            label: STAGE_LABELS[value],
          }))}
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
        {visible.length} of {candidates.length} candidates
      </p>

      {visible.length === 0 ? (
        <EmptyState filtersActive={filtersActive} onClearFilters={clearFilters} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-surface">
          <table className="w-full border-collapse text-body-sm md:min-w-[54rem]">
            <caption className="sr-only">
              Candidates, sortable by name, applications, next due date and date
              added.
            </caption>
            <thead className="border-b border-border bg-surface-sunken">
              <tr>
                <SortableHeader
                  columnKey="name"
                  sort={sort}
                  onSort={(key) => setSort((c) => nextSort(c, key))}
                >
                  Candidate
                </SortableHeader>
                <th scope="col" className={`${TH_BASE} ${TERTIARY_COL}`}>
                  Mobile
                </th>
                <th scope="col" className={`${TH_BASE} ${SECONDARY_COL}`}>
                  Source
                </th>
                <SortableHeader
                  columnKey="applications"
                  sort={sort}
                  onSort={(key) => setSort((c) => nextSort(c, key))}
                  className={COMPACT_COL}
                >
                  Applications
                </SortableHeader>
                <th scope="col" className={TH_BASE}>
                  Current stage
                </th>
                <th scope="col" className={`${SECONDARY_COL} ${TH_BASE}`}>
                  Recruiter
                </th>
                <SortableHeader
                  columnKey="dueDate"
                  sort={sort}
                  onSort={(key) => setSort((c) => nextSort(c, key))}
                >
                  Next due
                </SortableHeader>
                <th scope="col" className={`${TH_BASE} ${COMPACT_COL}`}>
                  CV
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((candidate) => {
                const primary = primaryApplication(candidate);
                // A finished application has no outstanding action, so it must
                // not read as overdue — that would put false urgency on the
                // queue.
                const due =
                  primary && !isTerminalStage(primary.stage) ? primary : null;
                const urgency = due ? urgencyOf(due.dueDate) : "upcoming";
                const uploadOpen = uploadFor === candidate.id;

                return [
                  <tr
                    key={candidate.id}
                    className="transition-colors duration-100 ease-move hover:bg-surface-sunken"
                  >
                    <td className={CELL}>
                      <Link
                        href={`/candidates/${candidate.id}`}
                        className="rounded-sm font-medium text-accent-ink underline decoration-transparent underline-offset-2 transition-colors duration-100 ease-move hover:decoration-current"
                      >
                        {candidate.name}
                      </Link>
                      {/* Capped on mobile so the stage and due columns stay on
                          screen; unconstrained once there is room. */}
                      <span className="block max-w-[6.5rem] truncate text-caption text-muted sm:max-w-none">
                        {candidate.email}
                      </span>
                    </td>
                    <td
                      className={`${CELL} ${TERTIARY_COL} whitespace-nowrap font-data tabular-nums text-muted`}
                    >
                      {candidate.mobile}
                    </td>
                    <td
                      className={`${CELL} ${SECONDARY_COL} whitespace-nowrap text-muted`}
                    >
                      {CANDIDATE_SOURCE_LABELS[candidate.source]}
                    </td>
                    <td
                      className={`${CELL} ${COMPACT_COL} font-data tabular-nums text-text`}
                    >
                      {candidate.applications.length}
                    </td>
                    <td className={CELL}>
                      {primary ? (
                        <>
                          <StagePill stage={primary.stage} />
                          <span className="mt-2xs block truncate text-caption text-muted">
                            {primary.requisitionRef}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">No application</span>
                      )}
                    </td>
                    <td
                      className={`${CELL} ${SECONDARY_COL} whitespace-nowrap text-muted`}
                    >
                      {primary?.assignedRecruiter.name ?? "—"}
                    </td>
                    <td
                      className={`${CELL} font-data tabular-nums md:whitespace-nowrap ${URGENCY_TEXT[urgency]}`}
                    >
                      {due ? dueLabel(due.dueDate) : "—"}
                    </td>
                    <td className={`${CELL} ${COMPACT_COL} whitespace-nowrap`}>
                      <button
                        type="button"
                        aria-expanded={uploadOpen}
                        aria-controls={`cv-upload-${candidate.id}`}
                        onClick={() =>
                          setUploadFor(uploadOpen ? null : candidate.id)
                        }
                        className="inline-flex min-h-11 items-center gap-xs rounded-sm px-xs text-body-sm font-medium text-accent-ink transition-colors duration-100 ease-move hover:bg-accent-soft"
                      >
                        <PaperclipIcon />
                        {candidate.cvDocument ? "Replace CV" : "Attach CV"}
                      </button>
                    </td>
                  </tr>,

                  uploadOpen ? (
                    <tr key={`${candidate.id}-upload`} className="bg-surface-sunken">
                      <td
                        id={`cv-upload-${candidate.id}`}
                        colSpan={8}
                        className="px-md py-md lg:px-lg"
                      >
                        {/* Real presigned-upload flow — see DocumentUpload. */}
                        <DocumentUpload
                          ownerType="CANDIDATE"
                          ownerId={candidate.id}
                          label={`CV for ${candidate.name}`}
                          hint="Replaces the CV on file."
                          document={candidate.cvDocument}
                        />
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
        {filtersActive ? "No candidates match those filters" : "No candidates yet"}
      </h2>
      <p className="mx-auto mt-sm max-w-[52ch] text-body-sm text-muted">
        {filtersActive
          ? "Stage and recruiter filters match across all of a candidate’s applications, so a narrower combination can rule everyone out. Try clearing one."
          : "A candidate profile holds the person: name, contact details, CV and where they came from. Applications — one per requisition — are added on top, so the same person can be considered for several positions without being entered twice."}
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
          <ButtonLink href="/candidates/new" variant="primary">
            Add the first candidate
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
