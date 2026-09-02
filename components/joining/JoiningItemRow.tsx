"use client";

import { useId, useState } from "react";
import { dueLabel, urgencyOf } from "@/components/tasks/types";
import { Button } from "@/components/ui/Button";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import { PaperclipIcon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/StatusPill";
import { JOINING_ITEM_STATUS_TONE } from "@/components/ui/tone";
import { formatDateTime } from "@/lib/format";
import {
  isOverdue,
  JOINING_ITEM_STATUS_LABELS,
  type JoiningChecklistItem,
  type JoiningItemStatus,
} from "@/lib/types/joining";

/**
 * One line of the checklist.
 *
 * The interaction weight here is deliberate and is the whole point of the tab:
 * marking an item done is a **checkbox**, not a confirm-gated ceremony. Ticking
 * "ID card" is an operational note a TA admin makes twenty times a week — it is
 * not the Communication approval (which puts a message in front of a candidate)
 * or the Decision approve/reject (which decides whether someone is hired), both
 * of which earn their two-step confirms. Undo lives one level up, on the
 * section, because that is the honest cheap safety net for a cheap action:
 * reverse it, don't interrogate it.
 *
 * Everything past the tick is progressive disclosure. Owner and due date are on
 * the collapsed row because they are what you scan for; notes, evidence and the
 * blocked control are behind "Details", because on any given day you open one
 * row out of thirteen.
 */

const OVERDUE_TEXT = "text-warning-ink";

export interface JoiningItemRowProps {
  item: JoiningChecklistItem;
  /** `YYYY-MM-DD`, threaded from the server so SSR and hydration agree. */
  today: string;
  /** A write on this row is in flight; controls are disabled, not hidden. */
  busy: boolean;
  onStatusChange: (status: JoiningItemStatus, blockedReason: string) => void;
  onSaveNotes: (notes: string) => void;
  onAttach: (result: { storageKey: string; file: File }) => void | Promise<void>;
}

export function JoiningItemRow({
  item,
  today,
  busy,
  onStatusChange,
  onSaveNotes,
  onAttach,
}: JoiningItemRowProps) {
  const rowId = useId();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(item.notes);
  const [blockDraft, setBlockDraft] = useState(item.blockedReason);
  const [blocking, setBlocking] = useState(false);

  const done = item.status === "DONE";
  const late = isOverdue(item, today);
  const dueToday =
    item.dueDate !== null &&
    urgencyOf(item.dueDate, new Date(`${today}T12:00:00Z`)) === "today";
  const notesDirty = notes.trim() !== item.notes;

  return (
    <li className="px-md py-sm lg:px-lg">
      <div className="flex items-start gap-sm">
        {/*
          A real checkbox: keyboard-operable for free, announced as a checkbox,
          and the 44px hit area comes from the padding on the label rather than
          from a bigger box (DESIGN.md > Accessibility). The label text is the
          item, so the whole line is the target.
        */}
        <input
          id={rowId}
          type="checkbox"
          checked={done}
          disabled={busy}
          onChange={(event) =>
            onStatusChange(event.target.checked ? "DONE" : "PENDING", "")
          }
          className="mt-[13px] size-[18px] shrink-0 accent-[var(--accent-ink)] disabled:cursor-progress"
        />

        <div className="min-w-0 flex-1">
          <label
            htmlFor={rowId}
            className={`flex min-h-11 cursor-pointer items-center py-sm text-body font-medium ${
              done ? "text-muted" : "text-text"
            }`}
          >
            {item.label}
          </label>

          <div className="-mt-sm flex flex-wrap items-center gap-x-md gap-y-2xs pb-2xs text-body-sm">
            <span className="text-muted">{item.owner.name}</span>

            <span
              className={`font-data tabular-nums ${
                done
                  ? "text-muted"
                  : late
                    ? `${OVERDUE_TEXT} font-medium`
                    : dueToday
                      ? "font-medium text-text"
                      : "text-muted"
              }`}
            >
              {done ? (
                <>
                  Done{" "}
                  {item.completedAt ? formatDateTime(item.completedAt) : ""}
                  {item.completedBy ? ` by ${item.completedBy.name}` : ""}
                </>
              ) : item.dueDate === null ? (
                /* Said out loud rather than left blank. The backend's
                   auto-seeded checklist sets no due dates, so this is a common
                   state — and an item nobody has dated is an item nobody can be
                   late on, which is worth noticing. */
                <span className="font-sans italic text-muted">No due date</span>
              ) : (
                <>Due {dueLabel(item.dueDate, new Date(`${today}T12:00:00Z`))}</>
              )}
            </span>

            {/* The pill appears only when the status is not the plain "still to
                do" default. A pill on every row would make the two that mean
                something invisible. */}
            {item.status === "BLOCKED" && (
              <Pill
                tone={JOINING_ITEM_STATUS_TONE.BLOCKED}
                label={JOINING_ITEM_STATUS_LABELS.BLOCKED}
              />
            )}

            {item.document && (
              <span className="inline-flex min-w-0 items-center gap-xs text-muted">
                <PaperclipIcon className="size-4 shrink-0" />
                <span className="truncate">{item.document.fileName}</span>
              </span>
            )}
          </div>

          {item.status === "BLOCKED" && item.blockedReason && !open && (
            <p className="mt-xs max-w-[62ch] text-body-sm text-warning-ink">
              {item.blockedReason}
            </p>
          )}
        </div>

        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${rowId}-details`}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 shrink-0 items-center rounded-sm px-sm text-body-sm font-medium text-accent-ink transition-colors duration-100 ease-move hover:bg-accent-soft"
        >
          {open ? "Close" : "Details"}
          <span className="sr-only"> for {item.label}</span>
        </button>
      </div>

      {open && (
        <div
          id={`${rowId}-details`}
          className="mb-sm ml-lg mt-sm flex max-w-[var(--container-form)] flex-col gap-lg border-l-2 border-border pl-md"
        >
          <div className="flex flex-col gap-2xs">
            <label
              htmlFor={`${rowId}-notes`}
              className="text-body-sm font-medium text-text"
            >
              Note
              <span className="ml-xs font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id={`${rowId}-notes`}
              rows={2}
              value={notes}
              disabled={busy}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ticket number, who you spoke to, what is left."
              className="min-h-24 w-full resize-y rounded-sm border border-border bg-surface px-sm py-sm text-body leading-normal text-text transition-colors duration-100 ease-move placeholder:text-muted hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
            />
            {notesDirty && (
              <div className="mt-2xs">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onSaveNotes(notes)}
                >
                  Save note
                </Button>
              </div>
            )}
          </div>

          {/* Evidence: the spec's "optional evidence". Real presigned-upload
              flow (BUILD_PLAN.md Sec 2.6) — only the Document row is mocked,
              see `_mock-joining.ts`. */}
          <DocumentUpload
            ownerType="JOINING_CHECKLIST_ITEM"
            ownerId={item.id}
            label="Evidence"
            hint="The signed offer letter, a reference-check form, a gate-pass approval."
            document={item.document}
            onUploaded={onAttach}
          />

          {/* The blocked control lives here rather than on the row: it is the
              rare path, it needs a reason typed, and putting it beside the
              checkbox would imply the two are equal-weight choices. */}
          <div className="border-t border-border pt-md">
            {item.status === "BLOCKED" ? (
              <div className="flex flex-wrap items-center gap-md">
                <p className="min-w-0 flex-1 text-body-sm text-muted">
                  Blocked since this item was last updated. Clear the block once
                  it is moving again.
                </p>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => onStatusChange("PENDING", "")}
                >
                  Clear block
                </Button>
              </div>
            ) : blocking ? (
              <div className="flex flex-col gap-2xs">
                <label
                  htmlFor={`${rowId}-blocked`}
                  className="text-body-sm font-medium text-text"
                >
                  What is this waiting on?
                </label>
                <textarea
                  id={`${rowId}-blocked`}
                  rows={2}
                  value={blockDraft}
                  disabled={busy}
                  onChange={(event) => setBlockDraft(event.target.value)}
                  className="min-h-24 w-full resize-y rounded-sm border border-border bg-surface px-sm py-sm text-body leading-normal text-text transition-colors duration-100 ease-move hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
                />
                <p className="text-caption text-muted">
                  Named out loud so whoever picks this up knows who to chase.
                  Kept internally — nothing here reaches the candidate.
                </p>
                <div className="mt-sm flex flex-wrap gap-sm">
                  <Button
                    variant="primary"
                    disabled={busy || blockDraft.trim().length === 0}
                    onClick={() => {
                      onStatusChange("BLOCKED", blockDraft);
                      setBlocking(false);
                    }}
                  >
                    Mark blocked
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setBlockDraft(item.blockedReason);
                      setBlocking(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-md">
                <p className="min-w-0 flex-1 text-body-sm text-muted">
                  Stuck with another team? Mark it blocked so it shows in the
                  readiness summary instead of quietly going overdue.
                </p>
                <Button
                  variant="secondary"
                  disabled={busy || done}
                  onClick={() => setBlocking(true)}
                >
                  Mark blocked
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
