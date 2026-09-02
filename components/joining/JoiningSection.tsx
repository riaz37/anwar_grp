"use client";

import { useState } from "react";
import {
  addJoiningItemAction,
  attachJoiningDocumentAction,
  saveItemNotesAction,
  seedJoiningChecklistAction,
  setItemStatusAction,
} from "@/app/(dashboard)/_joining-actions";
import { Button } from "@/components/ui/Button";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { todayIsoDate } from "@/lib/format";
import type { ApplicationStage, PersonRef } from "@/lib/types/domain";
import {
  computeReadiness,
  sortChecklist,
  STANDARD_JOINING_CHECKLIST,
  type ApplicationJoining,
  type JoiningChecklistItem,
  type JoiningItemStatus,
  type NewJoiningItemInput,
} from "@/lib/types/joining";
import { AddJoiningItemForm } from "./AddJoiningItemForm";
import { JoiningItemRow } from "./JoiningItemRow";
import { JoiningReadinessSummary } from "./JoiningReadinessSummary";

/**
 * The Joining tab: spec Sec 6 > Joining Coordination, and Sec 11's Scenario 5
 * ("assign joining tasks · update checklist items · show readiness for
 * joining") end to end.
 *
 * This is the lightest tab in the application panel, on purpose. The spec asks
 * for "a simple checklist" and nothing more, and the work it coordinates is
 * clerical — an ID card, a desk, a bus route. So: no approval, no confirm
 * dialogs, no stage side-effects. Tick, undo, move on.
 *
 * The one deliberate weight is `blockedReason`: an item you cannot finish has
 * to say what it is waiting on, because "blocked with no reason" is the exact
 * untraceable hand-off this whole product exists to remove.
 *
 * Why the tab is always present, never conditionally rendered on stage: the
 * panel's other tabs already behave this way — Screening renders before anyone
 * has screened, Interviews before anything is scheduled — and a tab strip whose
 * membership changes as an application moves is a tab strip people stop
 * trusting. It also has real use before JOINING: a recruiter with a signed
 * acceptance starts chasing the offer letter and the reference check while the
 * application still reads SELECTED. The empty state carries the stage-awareness
 * instead, in words.
 */

/** Stages at which a joining checklist is normal rather than early. */
const COORDINATION_STAGES: ReadonlySet<ApplicationStage> = new Set([
  "SELECTED",
  "JOINING",
  "JOINED",
]);

interface PendingUndo {
  itemId: string;
  label: string;
  status: JoiningItemStatus;
  blockedReason: string;
  /** The version the undo must echo — the one the *last write* returned. */
  version: number;
  message: string;
}

export function JoiningSection({
  applicationId,
  stage,
  joining,
  items,
  owners,
  assignedRecruiter,
  viewerId,
  onChange,
}: {
  applicationId: string;
  stage: ApplicationStage;
  joining: ApplicationJoining;
  /**
   * Controlled, exactly like `ScreeningSection`/`InterviewsSection`: the list
   * lives on `ApplicationPanel` so the tab strip's count and attention dot stay
   * in step with it, and so switching tabs (which unmounts the panel) does not
   * throw away a tick that was just made.
   */
  items: readonly JoiningChecklistItem[];
  /** Everyone who can own an item — recruiting plus IT / Admin / HR. */
  owners: readonly (PersonRef & { role: string })[];
  assignedRecruiter: PersonRef;
  /** Dev-only viewer override id; drops out with the mock data. */
  viewerId?: string;
  onChange: (items: JoiningChecklistItem[]) => void;
}) {
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [undo, setUndo] = useState<PendingUndo | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);

  const today = joining.today || todayIsoDate();
  const readiness = computeReadiness(items, today);
  const ordered = sortChecklist(items);

  const commit = onChange;

  function replaceItem(next: JoiningChecklistItem) {
    commit(items.map((item) => (item.id === next.id ? next : item)));
  }

  async function changeStatus(
    item: JoiningChecklistItem,
    status: JoiningItemStatus,
    blockedReason: string,
    /** Set when this call *is* the undo, so undoing does not offer its own undo. */
    isUndo = false,
  ) {
    const snapshot = [...items];
    setError(null);
    setBusyItemId(item.id);

    // Optimistic: the row flips immediately. A checklist that waits on a round
    // trip before the box ticks is a checklist people tick twice.
    commit(
      items.map((entry) =>
        entry.id === item.id
          ? { ...entry, status, blockedReason }
          : entry,
      ),
    );

    try {
      const saved = await setItemStatusAction(
        {
          itemId: item.id,
          status,
          blockedReason,
          version: item.version,
        },
        viewerId,
      );
      commit(snapshot.map((entry) => (entry.id === saved.id ? saved : entry)));

      const label =
        status === "DONE"
          ? `“${item.label}” marked done.`
          : status === "BLOCKED"
            ? `“${item.label}” marked blocked.`
            : `“${item.label}” reopened.`;
      setAnnouncement(label);
      setUndo(
        isUndo
          ? null
          : {
              itemId: item.id,
              label: item.label,
              status: item.status,
              blockedReason: item.blockedReason,
              version: saved.version,
              message: label,
            },
      );
    } catch (caught) {
      commit(snapshot);
      setUndo(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "That change wasn’t saved. Try again.",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function runUndo() {
    if (!undo) return;
    const current = items.find((entry) => entry.id === undo.itemId);
    if (!current) return;
    await changeStatus(
      { ...current, version: undo.version },
      undo.status,
      undo.blockedReason,
      true,
    );
    setAnnouncement(`“${undo.label}” put back.`);
    setUndo(null);
  }

  async function saveNotes(item: JoiningChecklistItem, notes: string) {
    setError(null);
    setBusyItemId(item.id);
    try {
      replaceItem(
        await saveItemNotesAction({
          itemId: item.id,
          notes,
          version: item.version,
        }),
      );
      setAnnouncement(`Note saved on “${item.label}”.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That note wasn’t saved. Try again.",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function attach(
    item: JoiningChecklistItem,
    result: { storageKey: string; file: File },
  ) {
    setError(null);
    setBusyItemId(item.id);
    try {
      replaceItem(
        await attachJoiningDocumentAction(
          {
            itemId: item.id,
            version: item.version,
            storageKey: result.storageKey,
            fileName: result.file.name,
            contentType: result.file.type,
            sizeBytes: result.file.size,
          },
          viewerId,
        ),
      );
      setAnnouncement(`${result.file.name} attached to “${item.label}”.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That file wasn’t linked to the item. Try again.",
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function addItem(input: NewJoiningItemInput) {
    setError(null);
    setUndo(null);
    try {
      const added = await addJoiningItemAction(applicationId, input);
      commit([...items, added]);
      setAnnouncement(`“${added.label}” added to the checklist.`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "That item wasn’t added. Try again.",
      );
    }
  }

  async function seed() {
    setError(null);
    setSeeding(true);
    try {
      const seeded = await seedJoiningChecklistAction(
        applicationId,
        joining.targetJoiningDate ?? today,
        joining.seedOwnerByFunction,
      );
      commit([...items, ...seeded]);
      setAnnouncement(
        `Standard joining checklist started — ${seeded.length} items.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The checklist wasn’t created. Try again.",
      );
    } finally {
      setSeeding(false);
    }
  }

  const banners = (
    <LiveRegion>
      {error ? (
        <InlineBanner
          tone="error"
          title="That didn’t save"
          onDismiss={() => setError(null)}
        >
          {error}
        </InlineBanner>
      ) : undo ? (
        /* The undo affordance, and the whole reason a tick needs no confirm
           step: reversing a mistake is one click and it is right here. It is a
           plain line rather than a floating toast because a toast that vanishes
           on a timer is not an undo, it is a race. */
        <p className="flex flex-wrap items-center gap-md rounded-sm border border-border bg-surface-sunken px-md py-xs text-body-sm text-text">
          <span className="min-w-0 flex-1">{undo.message}</span>
          <Button
            variant="ghost"
            disabled={busyItemId !== null}
            onClick={() => void runUndo()}
          >
            Undo
          </Button>
        </p>
      ) : (
        announcement && <span className="sr-only">{announcement}</span>
      )}
    </LiveRegion>
  );

  if (items.length === 0) {
    const coordinating = COORDINATION_STAGES.has(stage);
    return (
      <div className="flex max-w-[var(--container-form)] flex-col gap-lg">
        {banners}
        <div className="rounded-md border border-dashed border-border bg-surface px-lg py-xl">
          <h4 className="text-subhead text-text">No joining checklist yet</h4>
          <p className="mt-sm max-w-[58ch] text-body-sm text-muted">
            {coordinating
              ? "This is where the hand-off from recruiting to the candidate’s first day is tracked: acceptance, documents, the offer letter, IT, workspace, induction. Each item gets an owner, a due date and — where it needs proof — a file."
              : "Joining coordination starts once this candidate is selected. You can begin early if an acceptance is already in hand — chasing the offer letter and reference checks before the stage moves is normal."}
          </p>
          <p className="mt-md max-w-[58ch] text-body-sm text-muted">
            Starting the standard checklist creates the{" "}
            <span className="font-data tabular-nums">
              {STANDARD_JOINING_CHECKLIST.length}
            </span>{" "}
            items Anwar Group’s joining process uses, with default owners and
            due dates around the target joining date. Edit, remove or add to
            them as the hire needs.
          </p>
          <div className="mt-lg flex flex-wrap items-center gap-md">
            <Button
              variant={coordinating ? "primary" : "secondary"}
              disabled={seeding}
              aria-busy={seeding}
              onClick={() => void seed()}
            >
              {seeding ? "Starting…" : "Start the standard checklist"}
            </Button>
            <AddJoiningItemForm
              owners={owners}
              defaultOwnerId={assignedRecruiter.id}
              defaultDueDate={joining.targetJoiningDate ?? today}
              busy={seeding}
              onAdd={addItem}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-[var(--container-form)] flex-col gap-lg">
      {banners}

      <JoiningReadinessSummary
        items={items}
        readiness={readiness}
        today={today}
        targetJoiningDate={joining.targetJoiningDate}
      />

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <h4 className="sr-only">Checklist items</h4>
        <ul className="divide-y divide-border">
          {ordered.map((item) => (
            <JoiningItemRow
              key={item.id}
              item={item}
              today={today}
              busy={busyItemId === item.id}
              onStatusChange={(status, blockedReason) =>
                void changeStatus(item, status, blockedReason)
              }
              onSaveNotes={(notes) => void saveNotes(item, notes)}
              onAttach={(result) => attach(item, result)}
            />
          ))}
        </ul>
      </div>

      <AddJoiningItemForm
        owners={owners}
        defaultOwnerId={assignedRecruiter.id}
        defaultDueDate={joining.targetJoiningDate ?? today}
        busy={busyItemId !== null}
        onAdd={addItem}
      />
    </div>
  );
}
