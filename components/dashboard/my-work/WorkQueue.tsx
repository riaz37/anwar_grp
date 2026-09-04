"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Flag, Inbox, ListChecks } from "lucide-react";
import { Pill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel, PanelEmpty, PanelHeader } from "./Panel";
import type { QueueBucket, QueueItem, QueueKind } from "./types";

type KindFilter = "all" | QueueKind;

const KIND_FILTERS: readonly { value: KindFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "task", label: "Tasks" },
  { value: "milestone", label: "Milestones" },
];

/** Bucket order is the reading order: what's late, then what's next. */
const BUCKETS: readonly {
  key: QueueBucket;
  label: string;
  /** Says what the group means, for the reader who has never seen it. */
  note: string;
  alarming?: boolean;
}[] = [
  {
    key: "overdue",
    label: "Past due",
    note: "date has already passed",
    alarming: true,
  },
  { key: "today", label: "Today", note: "due before the day is out" },
  { key: "week", label: "Next 7 days", note: "this week's commitments" },
  { key: "later", label: "Later", note: "more than a week out" },
  { key: "undated", label: "No date", note: "nothing scheduled yet" },
];

const KIND_LABEL: Record<QueueKind, string> = {
  task: "Task",
  milestone: "Milestone",
};

/** Short, comparable phrasing for "when" — the exact date sits beside it. */
function relativeLabel(days: number | null): string {
  if (days === null) return "unscheduled";
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

/**
 * The personal queue: every open task and milestone owned by the signed-in
 * user, grouped by how soon it is due and filterable by record type without a
 * round trip.
 *
 * Grouping by time rather than by type is the whole argument of the page — a
 * milestone due tomorrow and a task due tomorrow are the same problem, and
 * splitting them into two lists forces the reader to merge them by eye. The
 * type filter is there for when you genuinely want one or the other.
 */
export function WorkQueue({ items }: { items: readonly QueueItem[] }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [lateOnly, setLateOnly] = useState(false);

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (kind === "all" || item.kind === kind) &&
          (!lateOnly || item.overdue),
      ),
    [items, kind, lateOnly],
  );

  const groups = BUCKETS.map((bucket) => ({
    ...bucket,
    items: visible.filter((item) => item.bucket === bucket.key),
  })).filter((group) => group.items.length > 0);

  const overdueCount = items.filter((item) => item.overdue).length;

  return (
    <Panel>
      <PanelHeader
        title="Your queue"
        meta={
          visible.length === items.length
            ? `${items.length} open`
            : `${visible.length} of ${items.length}`
        }
      >
        <div className="flex flex-wrap items-center gap-ds-md">
          <div
            role="group"
            aria-label="Filter the queue by record type"
            className="flex items-center gap-ds-xxs rounded-md bg-surface-2 p-ds-xxs"
          >
            {KIND_FILTERS.map((filter) => {
              const active = kind === filter.value;
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setKind(filter.value)}
                  className={cn(
                    "rounded-sm px-ds-xl py-ds-sm text-caption-2 font-semibold transition-colors duration-150 ease-move",
                    active
                      ? "bg-surface-4 text-text-high shadow-secondary-button"
                      : "text-text-low hover:text-text-med",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-pressed={lateOnly}
            onClick={() => setLateOnly((value) => !value)}
            disabled={overdueCount === 0}
            className={cn(
              "flex items-center gap-ds-sm rounded-pill border px-ds-xl py-ds-sm text-caption-2 font-semibold transition-colors duration-150 ease-move",
              lateOnly
                ? "border-danger-outline bg-danger-wash text-danger-high"
                : "border-outline-low text-text-low hover:border-outline-med hover:text-text-med",
              overdueCount === 0 && "opacity-50",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                overdueCount > 0 ? "bg-danger-med" : "bg-text-low",
              )}
            />
            Past due only
            <span className="font-data tabular-nums">{overdueCount}</span>
          </button>
        </div>
      </PanelHeader>

      {items.length === 0 ? (
        <PanelEmpty
          icon={<Inbox size={16} strokeWidth={2} aria-hidden="true" />}
          title="Your queue is clear"
        >
          Nothing is assigned to you right now. Tasks land here when a team lead
          names you as the owner of a next action, and milestones when you take
          responsibility for a delivery date on a project.
        </PanelEmpty>
      ) : visible.length === 0 ? (
        <PanelEmpty
          icon={<Inbox size={16} strokeWidth={2} aria-hidden="true" />}
          title="Nothing matches these filters"
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setKind("all");
                setLateOnly(false);
              }}
            >
              Show everything
            </Button>
          }
        >
          You have {items.length} open{" "}
          {items.length === 1 ? "item" : "items"} in total — they are just
          filtered out of this view.
        </PanelEmpty>
      ) : (
        <div>
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h3 className="flex items-baseline justify-between gap-ds-md border-y border-outline-low bg-surface-1 px-ds-5xl py-ds-md">
                <span
                  className={cn(
                    "annotation",
                    group.alarming && "text-danger-high",
                  )}
                >
                  {group.label}
                </span>
                <span className="flex items-baseline gap-ds-md">
                  <span className="hidden text-caption-2 font-medium text-text-low sm:inline">
                    {group.note}
                  </span>
                  <span className="font-data text-caption-2 tabular-nums text-text-low">
                    {group.items.length}
                  </span>
                </span>
              </h3>

              <ul className="divide-y divide-outline-low">
                {group.items.map((item) => (
                  <QueueRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Panel>
  );
}

/**
 * One queue row, and one link: the destination for the title and for the
 * project is the same project workspace, so the row is a single anchor rather
 * than two competing hit areas.
 */
function QueueRow({ item }: { item: QueueItem }) {
  const Glyph = item.kind === "task" ? ListChecks : Flag;

  return (
    <li>
      <Link
        href={`/projects/${item.projectId}`}
        className="group flex flex-wrap items-center gap-x-ds-2xl gap-y-ds-md px-ds-5xl py-ds-xl transition-colors duration-150 ease-move hover:bg-surface-1"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-sm border",
            item.overdue
              ? "border-danger-outline bg-danger-wash text-danger-high"
              : "border-outline-low bg-surface-2 text-text-low",
          )}
        >
          <Glyph size={13} strokeWidth={2} />
        </span>

        <span className="min-w-[14rem] flex-1">
          <span className="block truncate text-body-2 font-semibold text-text-high underline-offset-4 group-hover:underline">
            {item.title}
          </span>
          <span className="mt-ds-xxs flex items-center gap-ds-sm text-caption-2 text-text-low">
            <span className="font-data uppercase tracking-[0.08em]">
              {KIND_LABEL[item.kind]}
            </span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{item.projectName}</span>
          </span>
        </span>

        <span className="shrink-0">
          <Pill tone={item.statusTone} label={item.statusLabel} />
        </span>

        <span className="w-[7.5rem] shrink-0 text-right">
          {item.dueIso ? (
            <time
              dateTime={item.dueIso}
              className={cn(
                "block font-data text-caption-2 tabular-nums",
                item.overdue ? "text-danger-high" : "text-text-med",
              )}
            >
              {formatDate(item.dueIso)}
            </time>
          ) : (
            <span className="block text-caption-2 text-text-low">
              No deadline
            </span>
          )}
          <span
            className={cn(
              "mt-ds-xxs block text-caption-1",
              item.overdue ? "text-danger-high" : "text-text-low",
            )}
          >
            {relativeLabel(item.daysUntilDue)}
          </span>
        </span>
      </Link>
    </li>
  );
}
