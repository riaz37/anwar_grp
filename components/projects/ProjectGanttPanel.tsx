"use client";

import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/StatusPill";
import { Card } from "@/components/ui/primitives/card";
import { formatDate } from "@/lib/format";
import type { ApiEnvelope, ApiErrorShape } from "@/lib/api-client";
import { MILESTONE_STATUS_LABELS, TASK_STATUS_LABELS } from "./projectTone";
import { Block, Empty, Monogram, Num } from "./detail/chrome";
import type { CriticalPathItem, CriticalPathResult } from "@/lib/critical-path";

/**
 * Per-project Gantt (AGENTIC_DASHBOARD_PLAN.md Group F, Product Direction
 * item 2 / RESOLVED-OPEN-items #7): a critical-path-highlighted timeline
 * of one project's milestones and tasks, not a portfolio-wide chart.
 *
 * Custom horizontal-bar timeline over a Gantt library on purpose: neither
 * `frappe-gantt` nor `gantt-task-react` has a version confirmed compatible
 * with this repo's React 19.2.8 / Next 16.3.4 (both newer than anything a
 * library's peerDependencies range has been tested against), and a
 * dependency-managed DOM (frappe-gantt renders and mutates its own SVG
 * outside React) fights this design system's exact-token styling more than
 * it helps for what is, per-project, a few dozen dated items at most. Plain
 * divs positioned by date give full control over the critical-path accent
 * and match every sibling panel's hand-built chrome.
 *
 * Self-fetching rather than prop-fed like its siblings (`WorkSection`,
 * `BlockersSection`, …): those are wired into `ProjectDetailView`'s props
 * chain, which a parallel workstream is consolidating the new tabs into —
 * this component only needs a `projectId` so it can be dropped into that
 * wiring without a second edit to fetch data through it.
 */
export function ProjectGanttPanel({ projectId }: { projectId: string }) {
  const [result, setResult] = useState<CriticalPathResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    // See ProjectTimelinePanel's identical guard: React 18 StrictMode's
    // double-invoked effect aborts the first run's fetch, but its
    // `.finally` still fires and would flip `loading` false before the
    // second run's real fetch resolves. `ignore` keeps a stale run from
    // touching state.
    let ignore = false;
    setLoading(true);
    setError(null);

    fetch(`/api/v1/projects/${projectId}/gantt`, { signal: controller.signal })
      .then(async (response) => {
        const envelope = (await response
          .json()
          .catch(() => null)) as ApiEnvelope<CriticalPathResult> | null;
        if (!response.ok || !envelope?.success || !envelope.data) {
          throw new Error(envelopeMessage(envelope?.error ?? null));
        }
        if (!ignore) setResult(envelope.data);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Couldn’t load the Gantt timeline.",
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

  return (
    <Block
      id="gantt"
      eyebrow="Timeline and dependencies"
      title="Gantt"
      description="Milestones and tasks ordered by due date. The highlighted chain is the critical path: the sequence of dates that actually drives the expected delivery date."
    >
      {loading && (
        <p className="py-ds-9xl text-center text-body-1 text-muted-foreground">
          Loading timeline…
        </p>
      )}

      {!loading && error && (
        <Empty title="Couldn’t load the timeline">{error}</Empty>
      )}

      {!loading && !error && result && <GanttTimeline result={result} />}
    </Block>
  );
}

function envelopeMessage(error: ApiErrorShape | string | null): string {
  if (!error) return "Couldn’t load the Gantt timeline.";
  if (typeof error === "string") return error;
  return error.message || "Couldn’t load the Gantt timeline.";
}

function GanttTimeline({ result }: { result: CriticalPathResult }) {
  const dated = result.items.filter((item) => item.date !== null);
  const undated = result.items.filter((item) => item.date === null);

  if (result.items.length === 0) {
    return (
      <Empty title="Nothing to schedule yet">
        Add a milestone or task with a due date to see the project's timeline
        and its critical path.
      </Empty>
    );
  }

  const times = [
    ...dated.map((item) => new Date(item.date as string).getTime()),
    new Date(result.expectedDeliveryDate).getTime(),
  ];
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  // A single-point range (e.g. one milestone due today) would divide by
  // zero below — widen it by a day either side so the bar still renders.
  const span = Math.max(maxTime - minTime, 24 * 60 * 60 * 1000);
  const rangeStart = minTime - span * 0.05;
  const rangeSpan = span * 1.1;

  function position(dateIso: string): number {
    const t = new Date(dateIso).getTime();
    return ((t - rangeStart) / rangeSpan) * 100;
  }

  const sorted = [...dated].sort(
    (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime(),
  );

  const deliveryPosition = position(result.expectedDeliveryDate);

  return (
    <div className="flex flex-col gap-ds-2xl">
      <div className="flex flex-wrap items-center gap-ds-xl text-caption-2 text-muted-foreground">
        <LegendSwatch className="bg-primary-med" label="Critical path" />
        <LegendSwatch className="bg-surface-4" label="Other work" />
        <LegendSwatch className="bg-danger-med" label="Expected delivery date" />
      </div>

      <Card className="gap-0 rounded-xl bg-surface-0 p-ds-2xl shadow-none">
        <div className="relative h-4">
          <div
            className="absolute top-0 h-full w-px bg-danger-med"
            style={{ left: `${clampPercent(deliveryPosition)}%` }}
          />
        </div>

        <ol className="mt-ds-md flex flex-col gap-ds-md">
          {sorted.map((item) => (
            <GanttRow
              key={item.id}
              item={item}
              startPercent={clampPercent(
                item.dependsOnId
                  ? position(
                      result.items.find((n) => n.id === item.dependsOnId)?.date ??
                        (item.date as string),
                    )
                  : position(item.date as string) - 2,
              )}
              endPercent={clampPercent(position(item.date as string))}
            />
          ))}
        </ol>
      </Card>

      {undated.length > 0 && (
        <div className="mt-ds-2xl">
          <p className="annotation">Not yet scheduled</p>
          <ul className="mt-ds-2xl flex flex-col gap-ds-xs">
            {undated.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-ds-md rounded-lg border border-outline-low px-ds-2xl py-ds-md text-body-1"
              >
                <Monogram name={item.ownerName} />
                <span className="min-w-0 flex-1 font-medium text-text-high">
                  {item.label}
                </span>
                <StatusBadge item={item} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GanttRow({
  item,
  startPercent,
  endPercent,
}: {
  item: CriticalPathItem;
  startPercent: number;
  endPercent: number;
}) {
  const barLeft = Math.min(startPercent, endPercent);
  const barWidth = Math.max(endPercent - startPercent, 0.75);

  return (
    <li className="flex flex-wrap items-center gap-ds-md">
      <div className="flex w-full items-center gap-ds-md sm:w-56 sm:shrink-0">
        <Monogram name={item.ownerName} />
        <div className="min-w-0 flex-1">
          <p
            className={
              "truncate text-body-1 font-medium " +
              (item.isCriticalPath ? "text-primary-high" : "text-text-high")
            }
          >
            {item.label}
          </p>
          <p className="text-caption-2 text-muted-foreground">
            {item.type === "MILESTONE" ? "Milestone" : "Task"} ·{" "}
            {item.date && <Num>{formatDate(item.date.slice(0, 10))}</Num>}
          </p>
        </div>
      </div>

      <div className="relative h-6 min-w-32 flex-1">
        <div
          className={
            "absolute top-1/2 h-2 -translate-y-1/2 rounded-pill " +
            (item.isCriticalPath
              ? "bg-primary-med shadow-primary-button"
              : "bg-surface-4")
          }
          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
        />
        <div
          className={
            "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-0 " +
            (item.isCriticalPath ? "bg-primary-high" : "bg-text-low")
          }
          style={{ left: `${endPercent}%` }}
        />
      </div>

      <div className="shrink-0">
        <StatusBadge item={item} />
      </div>
    </li>
  );
}

function StatusBadge({ item }: { item: CriticalPathItem }) {
  const label =
    item.type === "MILESTONE"
      ? MILESTONE_STATUS_LABELS[item.status as keyof typeof MILESTONE_STATUS_LABELS]
      : TASK_STATUS_LABELS[item.status as keyof typeof TASK_STATUS_LABELS];
  return (
    <Pill
      tone={item.isCriticalPath ? "accent" : "neutral"}
      label={label ?? item.status}
    />
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-ds-xs">
      <span aria-hidden="true" className={`size-2 rounded-pill ${className}`} />
      {label}
    </span>
  );
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}
