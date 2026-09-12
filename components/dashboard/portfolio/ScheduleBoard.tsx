"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ProjectHealth } from "@prisma/client";
import { cn } from "@/lib/utils";
import { HEALTH_TONE } from "@/components/projects/projectTone";
import { Button } from "@/components/ui/Button";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/primitives/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/primitives/tooltip";
import { BoardEmpty, BoardSection } from "./board";

export interface ScheduleRow {
  projectId: string;
  name: string;
  health: ProjectHealth;
  startDate: string;
  expectedDeliveryDate: string;
  criticalMilestoneName: string | null;
  criticalMilestoneDate: string | null;
  criticalMilestoneOverdue: boolean;
}

const TONE_BAR: Record<string, string> = {
  neutral: "bg-text-low",
  warning: "bg-warn-med",
  error: "bg-danger-med",
};

const TONE_DOT: Record<string, string> = {
  neutral: "bg-text-low",
  warning: "bg-warn-med",
  error: "bg-danger-med",
};

const HEALTH_FILTERS: { health: ProjectHealth; label: string }[] = [
  { health: "DELAYED", label: "Delayed" },
  { health: "AT_RISK", label: "At risk" },
  { health: "BLOCKED", label: "Blocked" },
];

type WindowPreset = "90d" | "180d" | "all";

const WINDOW_PRESETS: { key: WindowPreset; label: string }[] = [
  { key: "90d", label: "90d" },
  { key: "180d", label: "180d" },
  { key: "all", label: "All" },
];

const DAY_MS = 24 * 60 * 60 * 1000;
const TICK_COUNT = 4;
const ROW_LIMIT = 10;

/** Width of the project-name column. The gridlines, the axis labels and every
 *  row's bar track are all positioned against this one offset, so a tick label
 *  and the bar under it share a coordinate space. */
const NAME_COL = "var(--gantt-name-col)";
const TRACK_OFFSET = `calc(${NAME_COL} + var(--spacing-ds-lg))`;

function windowForPreset(
  preset: WindowPreset,
  rows: ScheduleRow[],
  now: Date,
): { start: Date; end: Date } {
  if (preset !== "all") {
    const halfDays = preset === "90d" ? 45 : 90;
    return {
      start: new Date(now.getTime() - halfDays * DAY_MS),
      end: new Date(now.getTime() + halfDays * DAY_MS),
    };
  }
  if (rows.length === 0) {
    return {
      start: new Date(now.getTime() - 30 * DAY_MS),
      end: new Date(now.getTime() + 30 * DAY_MS),
    };
  }
  const starts = rows.map((r) => new Date(r.startDate).getTime());
  const ends = rows.map((r) => new Date(r.expectedDeliveryDate).getTime());
  return {
    start: new Date(Math.min(...starts, now.getTime())),
    end: new Date(Math.max(...ends, now.getTime())),
  };
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Portfolio schedule: one bar per off-track project, running from its start
 * date to its expected delivery date, coloured by health, with a tick on the
 * bar marking the binding (critical-path) milestone. Not a per-task
 * breakdown — that belongs to the project's own Gantt tab.
 *
 * The health filters double as the page's counts: `Delayed 4` is both the
 * number and the control that isolates it, which is why this page carries no
 * separate KPI tile row.
 *
 * Client component because the health filter, the time window and the row
 * limit are all local view state over the full row set the server sends; the
 * dataset is one dashboard's worth of at-risk projects, so nothing refetches.
 */
export function ScheduleBoard({
  rows,
  nowIso,
  className,
}: {
  rows: ScheduleRow[];
  className?: string;
  /** ISO timestamp captured on the server at render time. Passed down instead
   *  of calling `new Date()` here: the server render and the first hydration
   *  pass would otherwise compute two different instants and every
   *  now-derived position would mismatch. */
  nowIso: string;
}) {
  const [selectedHealths, setSelectedHealths] = useState<Set<ProjectHealth>>(
    () => new Set(HEALTH_FILTERS.map((f) => f.health)),
  );
  const [windowPreset, setWindowPreset] = useState<WindowPreset>("all");
  const [expanded, setExpanded] = useState(false);

  const now = useMemo(() => new Date(nowIso), [nowIso]);

  const healthCounts = useMemo(
    () =>
      rows.reduce<Partial<Record<ProjectHealth, number>>>(
        (acc, row) => ({ ...acc, [row.health]: (acc[row.health] ?? 0) + 1 }),
        {},
      ),
    [rows],
  );

  const filteredRows = useMemo(
    () => rows.filter((r) => selectedHealths.has(r.health)),
    [rows, selectedHealths],
  );
  const visibleRows = expanded ? filteredRows : filteredRows.slice(0, ROW_LIMIT);

  const { start: windowStart, end: windowEnd } = useMemo(
    () => windowForPreset(windowPreset, filteredRows, now),
    [windowPreset, filteredRows, now],
  );
  const totalMs = windowEnd.getTime() - windowStart.getTime();
  const nowPercent = clampPercent(
    ((now.getTime() - windowStart.getTime()) / totalMs) * 100,
  );

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
    [],
  );
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
    const percent = (i / TICK_COUNT) * 100;
    return {
      percent,
      label: dateFormatter.format(
        new Date(windowStart.getTime() + (totalMs * i) / TICK_COUNT),
      ),
      // The today marker owns its slot on the axis; a date label that would
      // collide with it is dropped rather than overprinted.
      labelHidden: Math.abs(percent - nowPercent) < 10,
    };
  });

  const controls =
    rows.length === 0 ? null : (
      <>
        <ToggleGroup
          aria-label="Filter the schedule by health"
          className="gap-ds-xxs"
          onValueChange={(next) => {
            setSelectedHealths(new Set(next as ProjectHealth[]));
            setExpanded(false);
          }}
          spacing={2}
          type="multiple"
          value={Array.from(selectedHealths)}
          variant="default"
        >
          {HEALTH_FILTERS.map((entry) => (
            <ToggleGroupItem
              className="h-auto gap-ds-sm rounded-sm px-ds-md py-ds-xxs text-caption-2 font-normal text-text-low hover:bg-surface-2 hover:text-text-high data-[state=on]:bg-primary-wash data-[state=on]:text-primary-high data-[state=on]:shadow-none"
              key={entry.health}
              value={entry.health}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-pill",
                  TONE_DOT[HEALTH_TONE[entry.health]] ?? TONE_DOT.neutral,
                )}
              />
              {entry.label}
              <span className="font-data tabular-nums">
                {healthCounts[entry.health] ?? 0}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <ToggleGroup
          aria-label="Time window"
          className="rounded-sm bg-surface-2 p-ds-xxs"
          onValueChange={(next) => next && setWindowPreset(next as WindowPreset)}
          type="single"
          value={windowPreset}
          variant="default"
        >
          {WINDOW_PRESETS.map((preset) => (
            <ToggleGroupItem
              className="h-auto rounded-sm px-ds-md py-ds-xxs font-data text-caption-2 font-medium text-text-low hover:bg-transparent hover:text-text-high data-[state=on]:bg-surface-4 data-[state=on]:text-text-high"
              key={preset.key}
              value={preset.key}
            >
              {preset.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </>
    );

  /* One quiet legend instead of the explanatory paragraph this panel used to
     carry above it: a bar is the project's runway, the tick is the milestone
     that binds it. */
  const footer =
    rows.length === 0 ? undefined : (
      <>
        <span className="flex flex-wrap items-center gap-ds-2xl text-caption-1 text-text-low">
          <span className="flex items-center gap-ds-sm">
            <span aria-hidden="true" className="h-2 w-4 rounded-sm bg-text-low" />
            start → expected delivery
          </span>
          <span className="flex items-center gap-ds-sm">
            <span aria-hidden="true" className="h-3 w-0.5 bg-text-high" />
            key milestone
          </span>
        </span>
        {filteredRows.length > ROW_LIMIT && (
          <span className="flex items-center gap-ds-2xl">
            <span className="font-data text-caption-2 tabular-nums text-text-low">
              {visibleRows.length} of {filteredRows.length}
            </span>
            <Button
              className="h-auto p-0 text-caption-2 font-medium text-primary-high"
              onClick={() => setExpanded((v) => !v)}
              variant="link"
            >
              {expanded ? "Show the top 10" : `Show all ${filteredRows.length}`}
            </Button>
          </span>
        )}
      </>
    );

  return (
    <BoardSection
      controls={controls}
      count={rows.length === 0 ? "nothing off track" : `${rows.length} off track`}
      className={cn("rise-in", className)}
      footer={footer}
      headingId="board-schedule"
      label="Schedule"
    >
      {rows.length === 0 ? (
        <BoardEmpty tone="success">
          No active project is blocked, delayed or at risk. Projects appear here
          the moment their health drops off track.
        </BoardEmpty>
      ) : filteredRows.length === 0 ? (
        <BoardEmpty>
          Nothing matches the selected health filters. Re-select one above to
          bring its projects back.
        </BoardEmpty>
      ) : (
        <div className="overflow-x-auto">
          {/* The name column narrows on phones so a usable slice of the
              timeline stays on screen before the horizontal scroll starts. */}
          <div className="min-w-[24rem] [--gantt-name-col:8.5rem] sm:min-w-[38rem] sm:[--gantt-name-col:14rem]">
            {/* Shared date axis. Hidden on the narrowest screens, where the
                name column eats the track and each bar's own tooltip is the
                readable path to the same dates. */}
            <div
              aria-hidden="true"
              className="relative hidden h-5 sm:block"
              style={{
                marginLeft: TRACK_OFFSET,
                marginRight: "var(--spacing-ds-xs)",
              }}
            >
              {ticks
                .filter((tick) => !tick.labelHidden)
                .map((tick) => (
                  <span
                    className={cn(
                      "absolute top-ds-md whitespace-nowrap font-data text-caption-2 tabular-nums text-text-low",
                      tick.percent === 0
                        ? "translate-x-0"
                        : tick.percent === 100
                          ? "-translate-x-full"
                          : "-translate-x-1/2",
                    )}
                    key={tick.percent}
                    style={{ left: `${tick.percent}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              <span
                className={cn(
                  "absolute top-ds-md whitespace-nowrap bg-surface-shell px-ds-xs text-caption-1 font-semibold uppercase tracking-[0.08em] text-text-high",
                  // Kept inside the track at both extremes: with the "All"
                  // window, today can land exactly on either edge.
                  nowPercent > 92
                    ? "-translate-x-full"
                    : nowPercent < 8
                      ? "translate-x-0"
                      : "-translate-x-1/2",
                )}
                style={{ left: `${nowPercent}%` }}
              >
                Today
              </span>
            </div>

            <div className="relative pb-ds-md pt-ds-md">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-0 hidden sm:block"
                style={{
                  left: TRACK_OFFSET,
                  right: "var(--spacing-ds-xs)",
                }}
              >
                {ticks.map((tick) => (
                  <span
                    className="absolute inset-y-0 w-px bg-outline-low"
                    key={tick.percent}
                    style={{ left: `${tick.percent}%` }}
                  />
                ))}
                <span
                  className="absolute inset-y-0 z-10 w-px bg-text-high/60"
                  style={{ left: `${nowPercent}%` }}
                />
              </div>

              <ul className="relative z-10">
                {visibleRows.map((row) => (
                  <ScheduleBar
                    dateFormatter={dateFormatter}
                    key={row.projectId}
                    row={row}
                    totalMs={totalMs}
                    windowStart={windowStart}
                  />
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </BoardSection>
  );
}

function ScheduleBar({
  row,
  windowStart,
  totalMs,
  dateFormatter,
}: {
  row: ScheduleRow;
  windowStart: Date;
  totalMs: number;
  dateFormatter: Intl.DateTimeFormat;
}) {
  const start = new Date(row.startDate);
  const end = new Date(row.expectedDeliveryDate);
  const startPercent = clampPercent(
    ((start.getTime() - windowStart.getTime()) / totalMs) * 100,
  );
  const endPercent = clampPercent(
    ((end.getTime() - windowStart.getTime()) / totalMs) * 100,
  );
  const width = Math.max(endPercent - startPercent, 1.5);
  const tone = HEALTH_TONE[row.health];
  const dateRange = `${dateFormatter.format(start)} – ${dateFormatter.format(end)}`;

  const milestoneDate = row.criticalMilestoneDate
    ? new Date(row.criticalMilestoneDate)
    : null;
  const milestonePercent = milestoneDate
    ? clampPercent(((milestoneDate.getTime() - windowStart.getTime()) / totalMs) * 100)
    : null;
  const milestoneCaption = row.criticalMilestoneName
    ? `${row.criticalMilestoneOverdue ? "Overdue" : "Next"}: ${row.criticalMilestoneName}${
        milestoneDate ? ` (${dateFormatter.format(milestoneDate)})` : ""
      }`
    : null;

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            className="group grid items-center gap-ds-lg rounded-sm py-ds-xs pr-ds-xs transition-colors duration-100 hover:bg-surface-1"
            href={`/projects/${row.projectId}`}
            style={{ gridTemplateColumns: `${NAME_COL} minmax(0,1fr)` }}
          >
            <div className="flex min-w-0 items-center gap-ds-md pl-ds-xs">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-pill",
                  TONE_DOT[tone] ?? TONE_DOT.neutral,
                )}
              />
              <div className="min-w-0">
                <p className="truncate text-body-1 font-medium leading-tight text-text-high group-hover:text-primary-high">
                  {row.name}
                </p>
                {row.criticalMilestoneOverdue && row.criticalMilestoneName && (
                  <p className="mt-ds-xxs truncate text-caption-1 text-danger-high">
                    Overdue: {row.criticalMilestoneName}
                  </p>
                )}
              </div>
            </div>

            <div className="relative h-5 w-full min-w-0">
              {/* Baseline rail: keeps a short bar legible as a segment of a
                  full timeline instead of a chip floating in empty space. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-outline-base"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1/2 h-2 -translate-y-1/2 rounded-sm",
                  TONE_BAR[tone] ?? TONE_BAR.neutral,
                )}
                style={{ left: `${startPercent}%`, width: `${width}%` }}
              />
              {milestonePercent !== null && (
                /* The binding milestone, marked where it actually falls —
                   a manager reads "is the tick behind the today line?"
                   faster than any badge. */
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2",
                    row.criticalMilestoneOverdue
                      ? "bg-danger-high"
                      : "bg-text-high",
                  )}
                  style={{ left: `${milestonePercent}%` }}
                />
              )}
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          {[row.name, dateRange, milestoneCaption].filter(Boolean).join(" · ")}
        </TooltipContent>
      </Tooltip>
    </li>
  );
}
