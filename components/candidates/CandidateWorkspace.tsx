"use client";

import { useRef, useState } from "react";
import {
  ApplicationPanel,
  type ApplicationDetail,
  type ApplicationSectionsConfig,
} from "@/components/applications/ApplicationPanel";
import { StagePill } from "@/components/ui/StatusPill";
import { dueLabel, urgencyOf } from "@/components/tasks/types";
import type {
  ApplicationStage,
  ApplicationSummary,
  PersonRef,
  StageHistoryEntry,
} from "@/lib/types/domain";

/**
 * The per-application tab strip of the Candidate Workspace
 * (BUILD_PLAN.md Sec 5 decision #6).
 *
 * One candidate, many applications (spec Sec 6). The shared profile is
 * rendered by the page above this component and stays put; only the strip and
 * the panel beneath it change. Each tab carries that application's stage and
 * due signal, so the recruiter can see which of a candidate's applications
 * needs them without opening each one.
 *
 * ARIA: a real `tablist`/`tab`/`tabpanel` with roving tabindex — arrow keys
 * move between tabs, Home/End jump to the ends, and only the active tab is in
 * the tab order (DESIGN.md > Accessibility: keyboard nav everywhere).
 */

const URGENCY_TEXT = {
  overdue: "text-error-ink",
  today: "text-warning-ink",
  upcoming: "text-muted",
} as const;

export function CandidateWorkspace({
  applications: initialApplications,
  historyByApplication: initialHistory,
  detailByApplication,
  sectionsConfig,
  people,
  currentUser,
}: {
  applications: ApplicationSummary[];
  historyByApplication: Record<string, StageHistoryEntry[]>;
  /** Screening / interviews / communications, one entry per application. */
  detailByApplication: Record<string, ApplicationDetail>;
  /** Reference data shared by every application's sections. */
  sectionsConfig: ApplicationSectionsConfig;
  people: readonly PersonRef[];
  currentUser: PersonRef;
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [history, setHistory] = useState(initialHistory);
  const [activeId, setActiveId] = useState(
    initialApplications[0]?.id ?? "",
  );
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (applications.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface px-lg py-2xl text-center">
        <h2 className="text-section text-text">No applications yet</h2>
        <p className="mx-auto mt-sm max-w-[52ch] text-body-sm text-muted">
          This candidate is on file but hasn’t been linked to a requisition.
          Linking them creates an application — the record that carries a stage,
          an assigned recruiter and a next action.
        </p>
      </div>
    );
  }

  const active =
    applications.find((application) => application.id === activeId) ??
    applications[0];

  function focusTab(index: number) {
    const bounded = (index + applications.length) % applications.length;
    const target = applications[bounded];
    setActiveId(target.id);
    tabRefs.current[target.id]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusTab(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusTab(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusTab(0);
        break;
      case "End":
        event.preventDefault();
        focusTab(applications.length - 1);
        break;
      default:
        break;
    }
  }

  /**
   * Optimistic local update. With the real API this stays exactly as is — the
   * PATCH response supplies the new version, and `router.refresh()` on the
   * conflict path is what reconciles a stale view.
   */
  function handleApplied(
    applicationId: string,
    change: {
      stage: ApplicationStage;
      nextAction: string;
      actionOwner: PersonRef;
      dueDate: string;
      version: number;
    },
  ) {
    const previous = applications.find(
      (application) => application.id === applicationId,
    );
    if (!previous) return;

    setApplications((current) =>
      current.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              ...change,
              stageChangedAt: new Date().toISOString(),
            }
          : application,
      ),
    );

    setHistory((current) => ({
      ...current,
      [applicationId]: [
        ...(current[applicationId] ?? []),
        {
          id: `${applicationId}_sh_local_${(current[applicationId]?.length ?? 0) + 1}`,
          applicationId,
          fromStage: previous.stage,
          toStage: change.stage,
          changedBy: currentUser,
          changedAt: new Date().toISOString(),
        },
      ],
    }));
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Applications for this candidate"
        aria-orientation="horizontal"
        className="flex gap-xs overflow-x-auto border-b border-border"
      >
        {applications.map((application, index) => {
          const selected = application.id === active.id;
          const urgency = urgencyOf(application.dueDate);

          return (
            <button
              key={application.id}
              ref={(node) => {
                tabRefs.current[application.id] = node;
              }}
              role="tab"
              id={`tab-${application.id}`}
              aria-selected={selected}
              aria-controls={`panel-${application.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(application.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`-mb-px flex min-h-11 min-w-44 shrink-0 flex-col items-start gap-xs border-b-2 px-md py-sm text-left transition-colors duration-100 ease-move ${
                selected
                  ? "border-accent bg-surface"
                  : "border-transparent hover:bg-surface-sunken"
              }`}
            >
              <span className="font-data text-caption tabular-nums text-muted">
                {application.requisitionRef}
              </span>
              <span
                className={`text-body-sm ${selected ? "font-semibold text-text" : "font-medium text-muted"}`}
              >
                {application.requisitionTitle}
              </span>
              <span className="flex flex-wrap items-center gap-sm">
                <StagePill stage={application.stage} />
                <span
                  className={`font-data text-caption tabular-nums ${URGENCY_TEXT[urgency]}`}
                >
                  {dueLabel(application.dueDate)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {applications.map((application) => (
        <div
          key={application.id}
          role="tabpanel"
          id={`panel-${application.id}`}
          aria-labelledby={`tab-${application.id}`}
          hidden={application.id !== active.id}
          tabIndex={0}
          className="rounded-b-md border border-t-0 border-border bg-surface px-md py-lg lg:px-lg"
        >
          {application.id === active.id && (
            <ApplicationPanel
              application={application}
              history={history[application.id] ?? []}
              detail={
                detailByApplication[application.id] ?? {
                  screening: null,
                  interviews: [],
                  communications: [],
                  department: "—",
                  businessUnit: "—",
                }
              }
              config={sectionsConfig}
              currentUser={currentUser}
              people={people}
              onApplied={(change) => handleApplied(application.id, change)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
