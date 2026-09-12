"use client";

import { useEffect, useMemo, useState } from "react";
import { Pill } from "@/components/ui/StatusPill";
import type { Tone } from "@/components/ui/tone";
import { formatDateTime } from "@/lib/format";
import { ApiRequestError, getJson } from "@/lib/api-client";
import {
  Block,
  Empty,
  LOG_ROW,
  Num,
} from "./detail/chrome";

type TimelineEntryType =
  | "STAGE_CHANGE"
  | "DELAY_REASON"
  | "BLOCKER_RAISED"
  | "BLOCKER_RESOLVED"
  | "SCOPE_CHANGE"
  | "RISK_RAISED"
  | "RISK_STATUS_CHANGE"
  | "AGENT_FLAG_RAISED"
  | "AGENT_FLAG_RESOLVED";

interface TimelineEntryView {
  type: TimelineEntryType;
  timestamp: string;
  actorId: string | null;
  actorName: string | null;
  summary: string;
}

const TYPE_LABELS: Record<TimelineEntryType, string> = {
  STAGE_CHANGE: "Stage change",
  DELAY_REASON: "Delay",
  BLOCKER_RAISED: "Blocker raised",
  BLOCKER_RESOLVED: "Blocker resolved",
  SCOPE_CHANGE: "Scope change",
  RISK_RAISED: "Risk raised",
  RISK_STATUS_CHANGE: "Risk status change",
  AGENT_FLAG_RAISED: "Agent flag raised",
  AGENT_FLAG_RESOLVED: "Agent flag resolved",
};

const TYPE_TONE: Record<TimelineEntryType, Tone> = {
  STAGE_CHANGE: "accent",
  DELAY_REASON: "warning",
  BLOCKER_RAISED: "error",
  BLOCKER_RESOLVED: "success",
  SCOPE_CHANGE: "info",
  RISK_RAISED: "warning",
  RISK_STATUS_CHANGE: "info",
  AGENT_FLAG_RAISED: "error",
  AGENT_FLAG_RESOLVED: "success",
};

const ALL_TYPES = Object.keys(TYPE_LABELS) as TimelineEntryType[];

/**
 * Project memory / timeline tab: the merged, chronological read of every
 * event source `lib/project-memory.ts` aggregates (stage history, delay
 * reasons, blockers, scope changes, risk activity, agent flags), fetched
 * once and filtered client-side — event counts per project are small
 * enough that a second server round trip per filter change isn't worth it
 * (AGENTIC_DASHBOARD_PLAN.md "NEW — Project memory / timeline surface").
 */
export function ProjectTimelinePanel({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<TimelineEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<TimelineEntryType>>(
    () => new Set(ALL_TYPES),
  );

  useEffect(() => {
    const controller = new AbortController();
    // React 18 StrictMode double-invokes this effect in dev: the first
    // run's fetch is aborted by the cleanup below, but its `.finally`
    // still fires (aborting rejects the promise, it doesn't cancel the
    // callback chain) and would flip `loading` false before the second
    // run's real fetch resolves — flashing "No events to show" ahead of
    // the actual data. `ignore` guards every state setter so only the
    // most recent effect run's promise can update state.
    let ignore = false;
    setLoading(true);
    setError(null);
    getJson<TimelineEntryView[]>(
      `/api/v1/projects/${projectId}/timeline`,
      controller.signal,
    )
      .then((data) => {
        if (!ignore) setEntries(data);
      })
      .catch((err) => {
        if (ignore) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof ApiRequestError
            ? err.message
            : "Couldn’t load the project timeline.",
        );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [projectId]);

  function toggleType(type: TimelineEntryType) {
    setActiveTypes((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  const visibleEntries = useMemo(
    () => entries.filter((entry) => activeTypes.has(entry.type)),
    [entries, activeTypes],
  );

  return (
    <Block
      id="timeline"
      eyebrow="Project memory"
      title="Timeline"
      count={visibleEntries.length}
      description="Every stage change, delay, blocker, scope change, risk, and agent flag on this project, merged into one chronological record."
    >
      <fieldset className="flex flex-wrap gap-ds-md">
        <legend className="annotation mb-ds-xs w-full">Filter by type</legend>
        {ALL_TYPES.map((type) => {
          const active = activeTypes.has(type);
          const countForType = entries.filter((e) => e.type === type).length;
          return (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-ds-xs text-caption-2 text-text-med"
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggleType(type)}
                className="size-3.5 rounded-sm border-outline-low accent-primary-med"
              />
              <span className={active ? "text-text-high" : undefined}>
                {TYPE_LABELS[type]}
              </span>
              <Num>{countForType}</Num>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-ds-5xl" aria-live="polite">
        {loading && (
          <p className="text-body-1 text-text-low">Loading timeline…</p>
        )}

        {!loading && error && (
          <p className="text-body-1 text-danger-high">{error}</p>
        )}

        {!loading && !error && visibleEntries.length === 0 && (
          <Empty title="No events to show">
            {entries.length === 0
              ? "Nothing has happened on this project yet. Stage changes, blockers, scope changes, risks, and agent flags will all appear here as they occur."
              : "No events match the selected filters."}
          </Empty>
        )}

        {!loading && !error && visibleEntries.length > 0 && (
          <ol className="-mx-ds-md divide-y divide-outline-low border-y border-outline-low">
            {visibleEntries.map((entry, index) => (
              <li key={`${entry.type}-${entry.timestamp}-${index}`} className={LOG_ROW}>
                <div className="flex flex-wrap items-start gap-ds-xl">
                  <Pill tone={TYPE_TONE[entry.type]} label={TYPE_LABELS[entry.type]} />
                  <p className="min-w-[16rem] flex-1 text-body-1 text-text-high">
                    {entry.summary}
                  </p>
                </div>
                <p className="mt-ds-md text-caption-2 text-text-low">
                  {entry.actorName ?? "System"} ·{" "}
                  <Num>{formatDateTime(entry.timestamp)}</Num>
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Block>
  );
}
