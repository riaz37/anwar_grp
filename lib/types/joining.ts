/**
 * Joining Coordination types (assignment spec Sec 6 > Joining Coordination;
 * BUILD_PLAN.md Sec 2.2 `/joining` module, Sec 3.1 item 6).
 *
 * The spec's whole brief for this module is two sentences:
 *
 *   "A simple checklist should cover: candidate acceptance, required documents,
 *    reference check, offer letter, joining date, IT request, workspace,
 *    ID card, transport, induction, department notification, joining
 *    completion, departmental handover.
 *    Each item should have an owner, due date, status, and optional evidence."
 *
 * So this file is deliberately the smallest domain module in `lib/types`. It
 * carries exactly those four per-item facts plus the two things any list of
 * dated obligations needs in practice (a note, and who ticked it), and one
 * derived summary type. Nothing here schedules, escalates, or decides.
 *
 * Same client-facing conventions as `lib/types/domain.ts`: ISO strings for
 * dates, `PersonRef` for people, `version` echoed on every write.
 */

import { urgencyOf } from "@/components/tasks/types";
import type { DocumentRef, PersonRef } from "./domain";

/* ── Status ──────────────────────────────────────────────────────────────── */

/**
 * Three states, not two and not five.
 *
 * PENDING and DONE are forced by the spec ("status" on a checklist). The third,
 * BLOCKED, is the one addition, and it earns its place: a joining checklist's
 * characteristic failure is an item that has been sitting with another team for
 * two weeks with nobody saying so — "IT request raised, waiting on Facilities
 * for the desk" is a different fact from "IT request not started", and the two
 * need different people chased.
 *
 * Deliberately NOT included:
 *  - IN_PROGRESS. Nobody chases an in-progress item differently from a pending
 *    one, so it would be a status that changes no behaviour — and it would cost
 *    the checkbox, which is the entire interaction model here (see
 *    `components/joining/JoiningItemRow.tsx`). A tri-state control for a fact
 *    with no consequence is exactly the ceremony this tab is supposed not to
 *    have.
 *  - OVERDUE. Overdue is a function of the clock and the due date, not
 *    something a person sets — `isOverdue()` below derives it. Storing it would
 *    mean a status that silently goes stale at midnight.
 */
export const JOINING_ITEM_STATUSES = ["PENDING", "BLOCKED", "DONE"] as const;

export type JoiningItemStatus = (typeof JOINING_ITEM_STATUSES)[number];

export const JOINING_ITEM_STATUS_LABELS: Record<JoiningItemStatus, string> = {
  PENDING: "Pending",
  BLOCKED: "Blocked",
  DONE: "Done",
};

/* ── The item ────────────────────────────────────────────────────────────── */

/**
 * One line of one application's joining checklist.
 *
 * RECONCILIATION NOTE — `prisma.JoiningChecklistItem` is being written
 * concurrently and does not exist at the time of writing, so every field name
 * below is this agent's proposal. Three worth agreeing on explicitly:
 *
 *  1. `label` is free text with a seeded default list (`STANDARD_JOINING_
 *     CHECKLIST` below) rather than an enum of the spec's thirteen items. The
 *     spec's list is what a checklist "should cover", not a closed set — real
 *     joinings add "Factory gate pass" or "Uniform issue" — and an enum would
 *     make those unrepresentable. The seed list gives the spec's coverage
 *     without the rigidity.
 *  2. `document` is a single ref, not a list. The spec says "optional
 *     evidence", singular, and one item = one artefact (the signed offer
 *     letter, the reference-check form) holds up in practice. If it needs to
 *     become a list, that is additive.
 *  3. `blockedReason` is required whenever `status === "BLOCKED"` — enforced
 *     client-side today (see `_mock-joining.ts`), and it should be enforced in
 *     the route too. A blocked item with no reason is precisely the
 *     untraceable hand-off this system exists to remove, and it is the same
 *     rule `InterviewRescheduleEntry.reason` already follows.
 */
export interface JoiningChecklistItem {
  id: string;
  applicationId: string;
  /** What has to happen, e.g. "Offer letter". */
  label: string;
  /** Who owes it. Not always the recruiter — IT, Admin and Finance own items. */
  owner: PersonRef;
  /**
   * ISO calendar date, `YYYY-MM-DD`, or null.
   *
   * Nullable against this agent's preference, because the backend's
   * `JoiningChecklistItem.dueDate` is nullable *and its auto-seeded default
   * checklist sets no due date at all* — thirteen dateless rows is the single
   * most common state the real API produces today. A client type that could not
   * represent it would render a lie. The add form still requires one (the spec
   * says every item has a due date), and the row renders "No due date" rather
   * than an empty cell, so the gap is visible instead of silent. See gap 2 in
   * `app/(dashboard)/_mock-joining.ts`.
   */
  dueDate: string | null;
  status: JoiningItemStatus;
  /** Free-text working note. Empty string, never null, so the form is simple. */
  notes: string;
  /** Why the item is blocked. Empty unless `status === "BLOCKED"`. */
  blockedReason: string;
  /** Optional evidence — the signed offer letter, the reference-check form. */
  document: DocumentRef | null;
  /** Who ticked it, and when. Both null until `status === "DONE"`. */
  completedBy: PersonRef | null;
  /** ISO-8601 timestamp. */
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Optimistic-lock token; echoed on every write (BUILD_PLAN.md Sec 2.4). */
  version: number;
}

/** The three fields the add form collects. Everything else is defaulted. */
export interface NewJoiningItemInput {
  label: string;
  ownerId: string;
  /** ISO calendar date, `YYYY-MM-DD`. */
  dueDate: string;
}

/* ── The spec's own list ─────────────────────────────────────────────────── */

/**
 * The thirteen items spec Sec 6 > Joining Coordination names, verbatim and in
 * its own order, with the default owner *function* each one belongs to.
 *
 * The labels are the same thirteen strings as the server's
 * `DEFAULT_CHECKLIST_TEMPLATE` (`lib/joining-checklist.ts`) — both were taken
 * from the PDF verbatim, independently, and they agree. What this adds is the
 * two things the server's version leaves flat: a default owner *function* per
 * item, and a due-date offset. See gaps 2 and 3 in
 * `app/(dashboard)/_mock-joining.ts` for why that matters — a seeded checklist
 * with thirteen dateless rows all owned by the recruiter has an owner column
 * and a due column that carry no information.
 *
 * It exists at all so starting a checklist is one click rather than thirteen
 * trips through a three-field form — spec Sec 7 asks for "low in mandatory data
 * entry" and "frequent actions require only a few steps", and typing out the
 * client's own list by hand on every hire is neither.
 *
 * `dueOffsetDays` is relative to the target joining date, negative meaning
 * "before". They are ordinary defaults a recruiter edits, not a scheduling
 * engine — this module deliberately has none.
 */
export interface StandardJoiningItem {
  label: string;
  /** Who normally owns it, for the seed. Resolved to a real person at seed time. */
  ownerFunction:
    | "RECRUITER"
    | "HIRING_MANAGER"
    | "IT"
    | "ADMIN"
    | "HR";
  dueOffsetDays: number;
}

export const STANDARD_JOINING_CHECKLIST: readonly StandardJoiningItem[] = [
  { label: "Candidate acceptance", ownerFunction: "RECRUITER", dueOffsetDays: -21 },
  { label: "Required documents", ownerFunction: "RECRUITER", dueOffsetDays: -14 },
  { label: "Reference check", ownerFunction: "RECRUITER", dueOffsetDays: -14 },
  { label: "Offer letter", ownerFunction: "HR", dueOffsetDays: -18 },
  { label: "Joining date", ownerFunction: "RECRUITER", dueOffsetDays: -20 },
  { label: "IT request", ownerFunction: "IT", dueOffsetDays: -7 },
  { label: "Workspace", ownerFunction: "ADMIN", dueOffsetDays: -5 },
  { label: "ID card", ownerFunction: "ADMIN", dueOffsetDays: -3 },
  { label: "Transport", ownerFunction: "ADMIN", dueOffsetDays: -3 },
  { label: "Induction", ownerFunction: "HR", dueOffsetDays: 1 },
  { label: "Department notification", ownerFunction: "RECRUITER", dueOffsetDays: -5 },
  { label: "Joining completion", ownerFunction: "RECRUITER", dueOffsetDays: 0 },
  { label: "Departmental handover", ownerFunction: "HIRING_MANAGER", dueOffsetDays: 3 },
];

/**
 * Everything the Joining tab needs for one application, gathered where the data
 * is fetched rather than re-derived in the component.
 *
 * `today` is here rather than read from `new Date()` inside the tab on purpose:
 * "overdue" is the only time-dependent thing this surface renders, and a server
 * pass and a client rehydration that disagree about the calendar date would
 * produce a hydration mismatch on exactly the rows that matter most. The page
 * resolves it once and hands it down. (Consequence: a tab left open across
 * midnight shows yesterday's overdue set until the next navigation. Acceptable
 * — a checklist is not a clock — and cheaper than a ticking timer.)
 */
export interface ApplicationJoining {
  items: JoiningChecklistItem[];
  /** From the application's requisition. Null when it could not be read. */
  targetJoiningDate: string | null;
  /** The server's calendar date, `YYYY-MM-DD`. */
  today: string;
  /** Default owner per function, used when seeding the standard checklist. */
  seedOwnerByFunction: Record<StandardJoiningItem["ownerFunction"], string>;
}

/* ── Readiness ───────────────────────────────────────────────────────────── */

/**
 * "Show readiness for joining" (spec Sec 11, Scenario 5) as four counts.
 *
 * Counts, not a score or a percentage-with-a-verdict: readiness is "what is
 * left and what is late", and a single number would hide which. The same
 * restraint the evaluation summary is built under — summarise, never conclude.
 */
export interface JoiningReadiness {
  total: number;
  doneCount: number;
  /** Not done, and past its due date. Derived from `today`, never stored. */
  overdueCount: number;
  blockedCount: number;
  /** True only when there is at least one item and every one of them is done. */
  complete: boolean;
}

/**
 * Not done and past its due date. `today` is `YYYY-MM-DD`.
 *
 * An item with no due date is never overdue — it cannot be late for a date
 * nobody set. That is a deliberately quiet answer to a loud problem, which is
 * why the row surfaces the missing date in words instead.
 */
export function isOverdue(item: JoiningChecklistItem, today: string): boolean {
  if (item.status === "DONE" || item.dueDate === null) return false;
  return urgencyOf(item.dueDate, new Date(`${today}T12:00:00Z`)) === "overdue";
}

/**
 * Pure, given `today` — so the server render and the client rehydration of the
 * same checklist always agree on what is overdue. The calendar date is threaded
 * down from the page rather than read from `new Date()` in the component for
 * exactly that reason.
 */
export function computeReadiness(
  items: readonly JoiningChecklistItem[],
  today: string,
): JoiningReadiness {
  const doneCount = items.filter((item) => item.status === "DONE").length;
  return {
    total: items.length,
    doneCount,
    overdueCount: items.filter((item) => isOverdue(item, today)).length,
    blockedCount: items.filter((item) => item.status === "BLOCKED").length,
    complete: items.length > 0 && doneCount === items.length,
  };
}

/**
 * Sort order for the list: everything outstanding first, by due date, then the
 * done items in the order they were completed. Dateless items sort after dated
 * ones within their group, in creation order — which, for the backend's
 * auto-seeded checklist, means the spec's own thirteen items keep the spec's
 * own order.
 *
 * Deliberately not "blocked at the top" — the checklist is read top-to-bottom
 * as a sequence of work (the spec's own ordering is roughly chronological), and
 * pulling blocked items out of that sequence breaks the reading. The readiness
 * summary is where "one item is stuck" is surfaced.
 */
export function sortChecklist(
  items: readonly JoiningChecklistItem[],
): JoiningChecklistItem[] {
  return [...items].sort((a, b) => {
    const aDone = a.status === "DONE" ? 1 : 0;
    const bDone = b.status === "DONE" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    // `~` sorts after every digit, so a dateless item lands at the end of its
    // group rather than at the front (where an empty string would put it).
    const aDue = a.dueDate ?? "~";
    const bDue = b.dueDate ?? "~";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return a.createdAt.localeCompare(b.createdAt);
  });
}
