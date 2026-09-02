"use server";

import type { JoiningChecklistItem, NewJoiningItemInput } from "@/lib/types/joining";
import type { JoiningItemStatus } from "@/lib/types/joining";
import { resolveViewer } from "./_mock-evaluations";
import {
  addChecklistItem,
  attachItemDocument,
  JoiningMockError,
  saveItemNotes,
  seedStandardChecklist,
  setItemStatus,
} from "./_mock-joining";
import { MOCK_CURRENT_USER } from "./_mock-reference";

/**
 * Server actions behind the Joining tab's five writes.
 *
 * They are server actions rather than local stubs for the same reason the
 * approval and evaluation actions are: the identity recorded against a tick
 * (`completedBy`) must come from the session, not from the browser. "Who marked
 * the offer letter done" is the one fact this checklist exists to preserve, and
 * a client-supplied name is worth nothing.
 *
 * Every action returns the whole updated item (or list) rather than an
 * `{ ok: true }`, so the client never has to reconstruct `version`,
 * `completedBy` or `completedAt` — all three are server-owned, and guessing
 * them is how an undo ends up echoing a stale version.
 *
 * SWAP POINTS — see the block at the top of `_mock-joining.ts`; each action
 * below maps to exactly one route there.
 *
 * `viewerId` is a parameter only because the mock has no session. With
 * `getSession()` in place it disappears from all five signatures.
 *
 * The thrown `Error.message` is what the tab renders in its inline banner, so
 * every message has to read like something a recruiter would say — see
 * `JoiningMockError`'s messages, which are the strings the API's
 * `error.message` should carry too.
 */

function requireViewer(viewerId: string | undefined) {
  return resolveViewer(viewerId) ?? MOCK_CURRENT_USER;
}

function rethrow(error: unknown, fallback: string): never {
  throw new Error(error instanceof JoiningMockError ? error.message : fallback);
}

/**
 * The tab's primary write, and the one that has to feel instant: the row
 * updates optimistically and calls this, reverting only if it throws.
 */
export async function setItemStatusAction(
  input: {
    itemId: string;
    status: JoiningItemStatus;
    blockedReason: string;
    version: number;
  },
  viewerId?: string,
): Promise<JoiningChecklistItem> {
  try {
    return setItemStatus(input, requireViewer(viewerId));
  } catch (error) {
    return rethrow(error, "That change wasn’t saved. Try again.");
  }
}

export async function saveItemNotesAction(input: {
  itemId: string;
  notes: string;
  version: number;
}): Promise<JoiningChecklistItem> {
  try {
    return saveItemNotes(input);
  } catch (error) {
    return rethrow(error, "That note wasn’t saved. Try again.");
  }
}

export async function addJoiningItemAction(
  applicationId: string,
  input: NewJoiningItemInput,
): Promise<JoiningChecklistItem> {
  try {
    return addChecklistItem(applicationId, input);
  } catch (error) {
    return rethrow(error, "That item wasn’t added. Try again.");
  }
}

/**
 * Seeds the spec's own thirteen items. `targetJoiningDate` and the default
 * owners come from the page (the requisition and the reference lists), not from
 * this file — with the real API both are resolved server-side from the
 * application's requisition and the users table.
 */
export async function seedJoiningChecklistAction(
  applicationId: string,
  targetJoiningDate: string,
  ownerByFunction: Record<string, string>,
): Promise<JoiningChecklistItem[]> {
  try {
    return seedStandardChecklist(
      applicationId,
      targetJoiningDate,
      ownerByFunction,
    );
  } catch (error) {
    return rethrow(error, "The checklist wasn’t created. Try again.");
  }
}

/**
 * Records evidence against an item. The presign + PUT half already happened for
 * real in `DocumentUpload` before this is called — this is step 3 of
 * BUILD_PLAN.md Sec 2.6's flow, and the only mocked part.
 */
export async function attachJoiningDocumentAction(
  input: {
    itemId: string;
    version: number;
    storageKey: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  },
  viewerId?: string,
): Promise<JoiningChecklistItem> {
  try {
    return attachItemDocument(input, requireViewer(viewerId));
  } catch (error) {
    return rethrow(error, "That file wasn’t linked to the item. Try again.");
  }
}
