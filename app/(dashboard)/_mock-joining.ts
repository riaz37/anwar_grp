import "server-only";
import {
  STANDARD_JOINING_CHECKLIST,
  type JoiningChecklistItem,
  type JoiningItemStatus,
  type NewJoiningItemInput,
} from "@/lib/types/joining";
import type { DocumentRef, Viewer } from "@/lib/types/domain";
import { personById } from "./_mock-reference";

/**
 * TEMPORARY mock data + write store for Joining Coordination (spec Sec 6 >
 * Joining Coordination, Sec 11 Scenario 5; BUILD_PLAN.md Sec 3.1 item 6).
 *
 * Same convention as `_mock-approvals.ts`, including `import "server-only"` —
 * the store is module state on the server, mutated only through the server
 * actions in `_joining-actions.ts`, never from a component.
 *
 * ── SWAP POINTS ───────────────────────────────────────────────────────────
 *
 * The backend's Phase 6 routes landed while this surface was being built, so —
 * as in Phase 5 — the swap points below are read off the real handlers,
 * `prisma/schema.prisma`, `lib/joining-checklist.ts` and
 * `lib/reporting/joining-readiness.ts`, not guessed.
 *
 *   app/(dashboard)/candidates/[id]/page.tsx
 *     getMockJoiningChecklist(applicationId)
 *       -> GET /api/v1/applications/{id}/joining-checklist
 *          200 -> items ordered by `createdAt` (so the auto-seeded template
 *                 keeps the PDF's own order), each with `owner` and `createdBy`
 *                 expanded. An EMPTY ARRAY is a normal state, not an error and
 *                 not a 404 — every application before JOINING has one, and the
 *                 tab renders its empty state from it.
 *          403 -> the read roles are TA_ADMIN / RECRUITER / DEPT_HEAD /
 *                 HIRING_MANAGER / HR_LEADERSHIP / AUDIT_USER / TECH_ADMIN, and
 *                 `applicationScopeWhere` narrows further by department. A
 *                 PANEL_MEMBER cannot read this tab at all, which the panel has
 *                 to handle — today the mock returns items to everybody.
 *     computeReadiness(items, today)  [lib/types/joining.ts]
 *       -> GET /api/v1/applications/{id}/joining-readiness
 *          NOT on the critical path for this tab: the counts are derived from
 *          the list the page already holds, and a second round trip for
 *          arithmetic over data in hand is waste. The route exists for the
 *          dashboards (spec Sec 8: "Joining actions", "Upcoming joining"),
 *          which need counts without items. See gap 5 on keeping the two
 *          definitions in step.
 *
 *   app/(dashboard)/_joining-actions.ts
 *     setItemStatusAction  -> PATCH /api/v1/joining-checklist-items/{id}
 *                             { version, status }
 *                             `completedAt` is set server-side on the move to
 *                             DONE and cleared on the move off it — never sent
 *                             from the client, which is right. Audit is written
 *                             by the route. Stale `version` -> 409.
 *     saveItemNotesAction  -> PATCH /api/v1/joining-checklist-items/{id}
 *                             { version, notes }   (same route, `notes` only)
 *     addJoiningItemAction -> POST  /api/v1/applications/{id}/joining-checklist
 *                             { label, ownerId, dueDate?, notes? }
 *     seedJoiningChecklistAction
 *                          -> no route, deliberately: the backend seeds the
 *                             thirteen default items automatically inside the
 *                             stage transition into JOINING
 *                             (PATCH /applications/{id}/stage ->
 *                              buildDefaultChecklistItems). See gap 3 — this
 *                             action is the only genuinely divergent one, and
 *                             what it covers is starting a checklist *before*
 *                             the stage moves.
 *     attachJoiningDocumentAction
 *                          -> POST  /api/v1/documents  (create the row for the
 *                             storageKey the real presign+PUT already produced;
 *                             `ownerType: JOINING_CHECKLIST_ITEM`,
 *                             `ownerId: <checklist item id>`, NOT the
 *                             application id) then PATCH the item.
 *                             DONE (backend): the download-authz checker for
 *                             this owner type is registered at boot
 *                             (`lib/phase6-document-authz.ts` via
 *                             `instrumentation.ts`) and it grants the item's
 *                             *owner* as well as the application's readers —
 *                             which is what makes an IT-owned item's evidence
 *                             readable by the IT staffer who uploaded it. See
 *                             gap 6 for what is still missing.
 *
 * ── CONTRACT GAPS TO RESOLVE DURING THE WIRING PASS ───────────────────────
 * Listed here rather than silently papered over in a `.map()`:
 *
 *  1. `blockedReason` has no column. `JoiningChecklistItem` server-side has
 *     `notes` and nothing else free-text, so "what is this blocked on" would
 *     land in the same field as "ticket IT-4471, spoke to Rakib" and the two
 *     would overwrite each other. This UI treats them as separate facts because
 *     they are: the note is working context, the reason is why the item cannot
 *     move. RECOMMENDED: add `blockedReason String?` and require it (server-
 *     side, not just in the form) whenever `status = BLOCKED` — the same rule
 *     `InterviewRescheduleHistory.reason` and the approval-rejection comment
 *     already need. FALLBACK if that is refused: the fetch layer prefixes the
 *     reason into `notes` and parses it back out, which is worse and should be
 *     called what it is.
 *  2. `dueDate` is nullable server-side AND `buildDefaultChecklistItems()` sets
 *     none, so the auto-seeded thirteen items all arrive dateless. That makes
 *     "overdue" — the single most useful signal on this tab, and the thing
 *     spec Sec 8's "Joining actions" dashboard tile counts — vacuously zero on
 *     every freshly-seeded checklist. `JoiningChecklistItem.dueDate` here is
 *     `string | null` so the client can render the truth ("No due date"), but
 *     the real fix is server-side: seed due dates from
 *     `Requisition.targetJoiningDate` (this file's
 *     `STANDARD_JOINING_CHECKLIST.dueOffsetDays` is a ready-made offset table),
 *     or make the column non-null and require one on create. The PDF is
 *     explicit: "Each item should have an owner, due date, status".
 *  3. `buildDefaultChecklistItems()` assigns every one of the thirteen items to
 *     `defaultOwnerId` (the assigned recruiter). Six of the PDF's own items —
 *     IT request, Workspace, ID card, Transport, Offer letter, Induction —
 *     belong to IT, Administration and HR, and a checklist that starts with all
 *     thirteen on the recruiter is a checklist whose owner column carries no
 *     information until somebody reassigns thirteen rows by hand. The seed here
 *     spreads them by function (`STANDARD_JOINING_CHECKLIST.ownerFunction`);
 *     the backend needs an equivalent — a per-item default role resolved against
 *     the department's users, or a small config table.
 *  4. Seeding is stage-triggered server-side (on the transition INTO JOINING)
 *     and user-triggered here. Both should exist: a recruiter with a signed
 *     acceptance starts chasing the offer letter while the application still
 *     reads SELECTED, and today that means adding items one at a time. Either
 *     expose the seed as its own idempotent call
 *     (`POST /applications/{id}/joining-checklist/seed-default`, no-op when
 *     items exist — the stage route already has exactly that guard) or accept
 *     thirteen sequential POSTs from the client, which is the wrong hand-off
 *     for one button press.
 *  5. `JoiningReadinessSummary` (server) and `JoiningReadiness`
 *     (`lib/types/joining.ts`) are two definitions of the same four counts, and
 *     they already differ: the server splits `pendingCount`/`inProgressCount`
 *     and adds `completionPercentage` and `isReady`. They agree today on
 *     `overdueCount` and on `isReady`/`complete` — keep them agreeing, or the
 *     Joining tab and the TA-Head dashboard will report different numbers for
 *     the same candidate. The server's `overdueCount` compares against
 *     `new Date()` (an instant) while this client compares calendar dates,
 *     which will disagree for anything due today.
 *  6. `completedBy` has no column — the schema has `completedAt` and
 *     `createdById` but not "who ticked it". The row displays it ("Done 2 Sep,
 *     10:15 by Sadia Karim") because on a checklist shared across four
 *     departments, *who* said the ID card was issued is the disputed fact.
 *     It is recoverable from `AuditLog` (the route does write one), but not in
 *     a list query. RECOMMENDED: add `completedById String?`.
 *  7. `JoiningChecklistItemStatus` server-side is
 *     PENDING | IN_PROGRESS | DONE | BLOCKED; this file has three. The fetch
 *     layer maps IN_PROGRESS -> PENDING, which is lossless for everything this
 *     UI does with status (nobody chases an in-progress item differently) but
 *     IS lossy on write-back — a UI reopen of an IN_PROGRESS item would send
 *     PENDING and quietly drop the distinction. Either drop IN_PROGRESS
 *     server-side, or the mapper preserves the original value and only writes
 *     status when the user actually changed it. See `lib/types/joining.ts` for
 *     why the UI does not surface a fourth state.
 *  8. There is no DELETE for a checklist item. The seeded set is thirteen rows
 *     and plenty of hires need ten of them ("Transport" is meaningless for a
 *     remote role), so today the only way to close out an inapplicable item is
 *     to tick it done — which corrupts the completion count the readiness
 *     summary and the dashboards read. Needs either DELETE or a
 *     `NOT_APPLICABLE` status excluded from the denominator.
 *
 * ── FIXTURE COVERAGE ──────────────────────────────────────────────────────
 * The four states the tab renders, one application each:
 *   app_8802  JOINING  — 13 items, 7 done, 2 overdue, 1 blocked  → warning
 *   app_8705  JOINED   — 13 items, all done                      → success
 *   app_8851  SELECTED — 6 items, 2 done, nothing late           → accent
 *   everything else    — no checklist started                    → empty state
 */

/* ── Seed helpers ────────────────────────────────────────────────────────── */

function isoDateOffset(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function timestampDaysAgo(offset: number, hour = 10): string {
  const date = new Date();
  date.setUTCHours(hour, 15, 0, 0);
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString();
}

function evidence(
  id: string,
  fileName: string,
  daysAgo: number,
  uploadedBy: string,
): DocumentRef {
  return {
    id,
    fileName,
    contentType: "application/pdf",
    sizeBytes: 120_000 + ((fileName.length * 4_871) % 500_000),
    uploadedAt: timestampDaysAgo(daysAgo),
    uploadedBy,
  };
}

interface ItemSeed {
  label: string;
  ownerId: string;
  /** Days from today; negative is in the past. */
  dueInDays: number;
  status: JoiningItemStatus;
  notes?: string;
  blockedReason?: string;
  document?: DocumentRef;
  /** Days ago the item was ticked. Required when `status` is DONE. */
  completedDaysAgo?: number;
  completedById?: string;
}

function buildItems(
  applicationId: string,
  seeds: readonly ItemSeed[],
): JoiningChecklistItem[] {
  return seeds.map((seed, index) => {
    const done = seed.status === "DONE";
    return {
      id: `jci_${applicationId}_${index + 1}`,
      applicationId,
      label: seed.label,
      owner: personById(seed.ownerId),
      dueDate: isoDateOffset(seed.dueInDays),
      status: seed.status,
      notes: seed.notes ?? "",
      blockedReason: seed.blockedReason ?? "",
      document: seed.document ?? null,
      completedBy: done ? personById(seed.completedById ?? seed.ownerId) : null,
      completedAt: done ? timestampDaysAgo(seed.completedDaysAgo ?? 1) : null,
      createdAt: timestampDaysAgo(24),
      updatedAt: timestampDaysAgo(done ? (seed.completedDaysAgo ?? 1) : 3),
      version: done ? 2 : 1,
    } satisfies JoiningChecklistItem;
  });
}

/**
 * Imran Kabir → REQ-2026-105, stage JOINING, starting in eight days. The
 * realistic mid-coordination state: most of the paperwork is done, the physical
 * onboarding is not, one item is stuck with another department, and two are
 * late. This is the fixture the readiness summary's warning path is built
 * against.
 */
const JOINING_IN_FLIGHT: readonly ItemSeed[] = [
  {
    label: "Candidate acceptance",
    ownerId: "usr_recruiter_1",
    dueInDays: -13,
    status: "DONE",
    notes: "Accepted by phone, confirmed by email the same afternoon.",
    completedDaysAgo: 13,
  },
  {
    label: "Required documents",
    ownerId: "usr_recruiter_1",
    dueInDays: -6,
    status: "DONE",
    notes:
      "NID, last three payslips, all four academic certificates and the release letter received.",
    completedDaysAgo: 6,
  },
  {
    label: "Reference check",
    ownerId: "usr_recruiter_1",
    dueInDays: -6,
    status: "DONE",
    notes:
      "Two references taken — previous line manager and HR. Both positive, nothing flagged.",
    document: evidence(
      "doc_jci_8802_ref",
      "imran-kabir-reference-check.pdf",
      6,
      "Sadia Karim",
    ),
    completedDaysAgo: 6,
  },
  {
    label: "Offer letter",
    ownerId: "usr_hr_1",
    dueInDays: -10,
    status: "DONE",
    notes: "Signed copy filed. Original with HR records.",
    document: evidence(
      "doc_jci_8802_offer",
      "imran-kabir-offer-letter-signed.pdf",
      9,
      "Shamima Nasrin",
    ),
    completedDaysAgo: 9,
    completedById: "usr_hr_1",
  },
  {
    label: "Joining date",
    ownerId: "usr_recruiter_1",
    dueInDays: -12,
    status: "DONE",
    notes: "Confirmed for the 1st. Candidate is clear of their notice by then.",
    completedDaysAgo: 12,
  },
  {
    label: "IT request",
    ownerId: "usr_it_1",
    dueInDays: 1,
    status: "BLOCKED",
    blockedReason:
      "Laptop stock is out until the next procurement batch lands. IT have asked whether a loan unit for the first fortnight is acceptable.",
    notes: "Raised on the IT portal, ticket IT-4471.",
  },
  {
    label: "Workspace",
    ownerId: "usr_admin_1",
    dueInDays: -2,
    status: "PENDING",
    notes: "Desk allocation waiting on the floor plan for the merged team.",
  },
  {
    label: "ID card",
    ownerId: "usr_admin_2",
    dueInDays: -1,
    status: "PENDING",
    notes: "Photograph received from the candidate; card not printed yet.",
  },
  {
    label: "Transport",
    ownerId: "usr_admin_1",
    dueInDays: 5,
    status: "DONE",
    notes: "Added to the Uttara morning route.",
    completedDaysAgo: 2,
  },
  {
    label: "Induction",
    ownerId: "usr_hr_2",
    dueInDays: 9,
    status: "PENDING",
    notes: "Next induction session is the first Sunday after joining.",
  },
  {
    label: "Department notification",
    ownerId: "usr_recruiter_1",
    dueInDays: 3,
    status: "DONE",
    notes: "Plant Operations told; hiring manager has the start date.",
    completedDaysAgo: 1,
  },
  {
    label: "Joining completion",
    ownerId: "usr_recruiter_1",
    dueInDays: 8,
    status: "PENDING",
  },
  {
    label: "Departmental handover",
    ownerId: "usr_hm_1",
    dueInDays: 11,
    status: "PENDING",
    notes: "Handover pack to be prepared by the outgoing shift supervisor.",
  },
];

/**
 * Tahmina Akhter → REQ-2026-105, stage JOINED. Everything ticked — the state
 * the summary's success path renders, and the reason the summary distinguishes
 * "complete" from "nothing started" rather than treating 0-of-0 as done.
 */
const JOINING_COMPLETE: readonly ItemSeed[] = [
  { label: "Candidate acceptance", ownerId: "usr_recruiter_2", dueInDays: -46, status: "DONE", completedDaysAgo: 46 },
  { label: "Required documents", ownerId: "usr_recruiter_2", dueInDays: -40, status: "DONE", completedDaysAgo: 39 },
  {
    label: "Reference check",
    ownerId: "usr_recruiter_2",
    dueInDays: -40,
    status: "DONE",
    document: evidence(
      "doc_jci_8705_ref",
      "tahmina-akhter-reference-check.pdf",
      38,
      "Mahmudul Haque",
    ),
    completedDaysAgo: 38,
  },
  {
    label: "Offer letter",
    ownerId: "usr_hr_1",
    dueInDays: -43,
    status: "DONE",
    document: evidence(
      "doc_jci_8705_offer",
      "tahmina-akhter-offer-letter-signed.pdf",
      42,
      "Shamima Nasrin",
    ),
    completedDaysAgo: 42,
    completedById: "usr_hr_1",
  },
  { label: "Joining date", ownerId: "usr_recruiter_2", dueInDays: -45, status: "DONE", completedDaysAgo: 45 },
  { label: "IT request", ownerId: "usr_it_2", dueInDays: -32, status: "DONE", notes: "Laptop and accounts issued on day one.", completedDaysAgo: 31 },
  { label: "Workspace", ownerId: "usr_admin_1", dueInDays: -30, status: "DONE", completedDaysAgo: 30 },
  { label: "ID card", ownerId: "usr_admin_2", dueInDays: -28, status: "DONE", completedDaysAgo: 27 },
  { label: "Transport", ownerId: "usr_admin_1", dueInDays: -28, status: "DONE", notes: "Mirpur route, morning shift.", completedDaysAgo: 28 },
  { label: "Induction", ownerId: "usr_hr_2", dueInDays: -24, status: "DONE", completedDaysAgo: 24 },
  { label: "Department notification", ownerId: "usr_recruiter_2", dueInDays: -30, status: "DONE", completedDaysAgo: 30 },
  { label: "Joining completion", ownerId: "usr_recruiter_2", dueInDays: -25, status: "DONE", notes: "Started on schedule.", completedDaysAgo: 25 },
  { label: "Departmental handover", ownerId: "usr_hm_1", dueInDays: -22, status: "DONE", completedDaysAgo: 22, completedById: "usr_hm_1" },
];

/**
 * Sabina Yeasmin → REQ-2026-117, stage SELECTED. A checklist started early and
 * trimmed to the items that actually apply — six, not thirteen. Proof that the
 * standard list is a starting point rather than a fixed form, and the fixture
 * behind the "on track" (accent) summary.
 */
const JOINING_EARLY: readonly ItemSeed[] = [
  {
    label: "Candidate acceptance",
    ownerId: "usr_recruiter_1",
    dueInDays: -2,
    status: "DONE",
    notes: "Verbal acceptance; written confirmation received this morning.",
    completedDaysAgo: 1,
  },
  {
    label: "Joining date",
    ownerId: "usr_recruiter_1",
    dueInDays: -1,
    status: "DONE",
    notes: "Agreed for the 15th, subject to her notice being waived.",
    completedDaysAgo: 1,
  },
  { label: "Offer letter", ownerId: "usr_hr_1", dueInDays: 2, status: "PENDING", notes: "Drafted, waiting on countersignature." },
  { label: "Required documents", ownerId: "usr_recruiter_1", dueInDays: 4, status: "PENDING" },
  { label: "Reference check", ownerId: "usr_recruiter_1", dueInDays: 6, status: "PENDING" },
  { label: "Department notification", ownerId: "usr_recruiter_1", dueInDays: 9, status: "PENDING" },
];

/* ── Store ───────────────────────────────────────────────────────────────── */

/**
 * Module-level and mutable, exactly like `_mock-approvals.ts`'s `STORE`: it
 * survives a `router.refresh()` within one server process and resets on
 * restart, which is what makes the tick/undo interaction demonstrable without a
 * database. It disappears entirely with the swap points above.
 */
let STORE: JoiningChecklistItem[] = [
  ...buildItems("app_8802", JOINING_IN_FLIGHT),
  ...buildItems("app_8705", JOINING_COMPLETE),
  ...buildItems("app_8851", JOINING_EARLY),
];

export function getMockJoiningChecklist(
  applicationId: string,
): JoiningChecklistItem[] {
  return STORE.filter((item) => item.applicationId === applicationId);
}

/* ── Writes (called only from the server actions) ────────────────────────── */

export class JoiningMockError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "JoiningMockError";
    this.code = code;
  }
}

function replace(next: JoiningChecklistItem): JoiningChecklistItem {
  STORE = STORE.map((item) => (item.id === next.id ? next : item));
  return next;
}

function requireItem(itemId: string, version: number): JoiningChecklistItem {
  const item = STORE.find((entry) => entry.id === itemId);
  if (!item) {
    throw new JoiningMockError(
      "NOT_FOUND",
      "That checklist item no longer exists. Reload the page to see the current list.",
    );
  }
  if (item.version !== version) {
    throw new JoiningMockError(
      "VERSION_CONFLICT",
      "Someone else updated this item while you had it open. Reload to see their change.",
    );
  }
  return item;
}

/**
 * The tab's primary write. Kept as one function over all three statuses rather
 * than a `complete()`/`reopen()` pair, because the undo affordance is literally
 * "set it back to what it was" — a dedicated un-complete endpoint would be a
 * second code path doing the same thing with different bugs.
 */
export function setItemStatus(
  input: {
    itemId: string;
    status: JoiningItemStatus;
    blockedReason: string;
    version: number;
  },
  viewer: Viewer,
): JoiningChecklistItem {
  const item = requireItem(input.itemId, input.version);

  if (input.status === "BLOCKED" && input.blockedReason.trim().length === 0) {
    throw new JoiningMockError(
      "VALIDATION_ERROR",
      "A blocked item has to say what it is waiting on, so whoever picks it up knows who to chase.",
    );
  }

  const done = input.status === "DONE";
  return replace({
    ...item,
    status: input.status,
    blockedReason:
      input.status === "BLOCKED" ? input.blockedReason.trim() : "",
    completedBy: done ? { id: viewer.id, name: viewer.name } : null,
    completedAt: done ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
    version: item.version + 1,
  });
}

export function saveItemNotes(
  input: { itemId: string; notes: string; version: number },
): JoiningChecklistItem {
  const item = requireItem(input.itemId, input.version);
  return replace({
    ...item,
    notes: input.notes.trim(),
    updatedAt: new Date().toISOString(),
    version: item.version + 1,
  });
}

export function attachItemDocument(
  input: {
    itemId: string;
    version: number;
    storageKey: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  },
  viewer: Viewer,
): JoiningChecklistItem {
  const item = requireItem(input.itemId, input.version);
  return replace({
    ...item,
    document: {
      // SWAP POINT — this id is invented. With `POST /api/v1/documents` in
      // place it is the real `Document.id`, which is what the presign-download
      // link keys off; until then the Download link on an item attached in
      // this session cannot resolve. See the TODO block below.
      id: `doc_local_${input.storageKey.replace(/[^a-zA-Z0-9]/g, "_")}`,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      uploadedAt: new Date().toISOString(),
      uploadedBy: viewer.name,
    },
    updatedAt: new Date().toISOString(),
    version: item.version + 1,
  });
}

function newItem(
  applicationId: string,
  input: NewJoiningItemInput,
): JoiningChecklistItem {
  const now = new Date().toISOString();
  return {
    id: `jci_local_${applicationId}_${Date.now()}_${Math.round(Math.random() * 1e6)}`,
    applicationId,
    label: input.label.trim(),
    owner: personById(input.ownerId),
    dueDate: input.dueDate,
    status: "PENDING",
    notes: "",
    blockedReason: "",
    document: null,
    completedBy: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

export function addChecklistItem(
  applicationId: string,
  input: NewJoiningItemInput,
): JoiningChecklistItem {
  if (input.label.trim().length === 0) {
    throw new JoiningMockError("VALIDATION_ERROR", "Give the item a label.");
  }
  if (!input.dueDate) {
    throw new JoiningMockError("VALIDATION_ERROR", "Give the item a due date.");
  }
  const item = newItem(applicationId, input);
  STORE = [...STORE, item];
  return item;
}

/**
 * Seeds the spec's own thirteen items in one call. `targetJoiningDate` anchors
 * the default due dates; the caller passes the requisition's, falling back to
 * three weeks out when the requisition could not be read.
 */
export function seedStandardChecklist(
  applicationId: string,
  targetJoiningDate: string,
  ownerByFunction: Record<string, string>,
): JoiningChecklistItem[] {
  if (getMockJoiningChecklist(applicationId).length > 0) {
    throw new JoiningMockError(
      "ALREADY_EXISTS",
      "This application already has a joining checklist.",
    );
  }

  const anchor = new Date(`${targetJoiningDate}T00:00:00Z`);
  const seeded = STANDARD_JOINING_CHECKLIST.map((standard) => {
    const due = new Date(anchor);
    due.setUTCDate(due.getUTCDate() + standard.dueOffsetDays);
    return newItem(applicationId, {
      label: standard.label,
      ownerId: ownerByFunction[standard.ownerFunction] ?? "usr_recruiter_1",
      dueDate: due.toISOString().slice(0, 10),
    });
  });

  STORE = [...STORE, ...seeded];
  return seeded;
}

/* ──────────────────────────────────────────────────────────────────────────
 * BACKEND HAND-OFF — joining evidence documents
 *
 * DONE (backend, Phase 6): the `JOINING_CHECKLIST_ITEM`
 * `DocumentDownloadAuthzChecker` is registered at boot
 * (`lib/phase6-document-authz.ts` via `instrumentation.ts`), so the Download
 * link on an attached item is live as soon as a real `Document` row exists to
 * point it at. Its rule already covers the case this UI creates: the item's
 * *owner* — routinely an IT or Administration user, not the assigned recruiter
 * — can read the evidence they uploaded.
 *
 * STILL OPEN: `POST /api/v1/documents` — the `Document`-row write documented in
 * `components/ui/DocumentUpload.tsx`. The route file exists
 * (`app/api/v1/documents/route.ts`, added in Phase 2) and it is what
 * `attachItemDocument()` above stands in for; the outstanding piece is calling
 * it from the action with `ownerType: JOINING_CHECKLIST_ITEM` and
 * `ownerId: <checklist item id>` (NOT the application id — the authz checker
 * keys off the item), then PATCHing the item with the returned document id.
 *
 * Until that call is wired, the presign + PUT half of the flow is real in this
 * tab (bytes genuinely reach the object store) and only the row is mocked, so
 * an item attached in a mock session shows the filename but its Download link
 * cannot resolve. Documented rather than hidden — the alternative was faking
 * the upload too, which would have hidden a working half of the feature.
 * ────────────────────────────────────────────────────────────────────────── */
