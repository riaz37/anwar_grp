"use client";

import { useId, useRef, useState } from "react";
import type { DocumentOwnerType } from "@prisma/client";
import { ApiRequestError, postJson } from "@/lib/api-client";
import { formatDateTime, formatFileSize } from "@/lib/format";
import {
  ALLOWED_UPLOAD_TYPES_LABEL,
  UPLOAD_ACCEPT,
  validateUploadFile,
} from "@/lib/upload-constraints";
import { DownloadIcon, PaperclipIcon } from "./icons";
import { InlineBanner, LiveRegion } from "./InlineBanner";

/** An already-attached document, as returned by the documents API. */
export interface DocumentRef {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
}

interface PresignUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

type UploadState =
  | { phase: "idle" }
  | { phase: "presigning" | "uploading" | "attaching" }
  | { phase: "error"; message: string }
  | { phase: "done"; fileName: string };

const BUTTON =
  "inline-flex min-h-11 items-center gap-xs rounded-sm border border-border-strong bg-surface px-md " +
  "text-body-sm font-medium text-text transition-colors duration-100 ease-move " +
  "hover:bg-surface-sunken disabled:cursor-progress disabled:opacity-60";

const PHASE_LABEL: Record<string, string> = {
  presigning: "Preparing upload…",
  uploading: "Uploading…",
  attaching: "Linking to record…",
};

export interface DocumentUploadProps {
  /** Prisma `DocumentOwnerType` for the record this file belongs to. */
  ownerType: DocumentOwnerType;
  /**
   * Id of the owning record. `null` puts the control in *deferred* mode: the
   * file is validated and held locally and reported through `onFileStaged`,
   * because a presigned key cannot be issued for a record that does not exist
   * yet. Used by the create forms.
   */
  ownerId: string | null;
  label: string;
  hint?: string;
  /** Already-attached document, if any. */
  document?: DocumentRef | null;
  /** Deferred mode: the caller holds the file until the record is created. */
  onFileStaged?: (file: File | null) => void;
  /** Real mode: fired once the object store has the bytes. */
  onUploaded?: (result: {
    storageKey: string;
    file: File;
  }) => void | Promise<void>;
}

/**
 * Upload control backed by the **real** Phase 1 presigned-URL flow
 * (BUILD_PLAN.md Sec 2.6 — never a public bucket, never a DB blob):
 *
 *   1. `POST /api/v1/documents/presign-upload` → `{ uploadUrl, storageKey }`
 *   2. `PUT uploadUrl` with the raw file body and its `Content-Type`
 *   3. tell the owning module to create the `Document` row for `storageKey`
 *
 * Steps 1 and 2 run for real here. Step 3 is the module-owned write and is the
 * only mocked part — see the TODO in `attachDocument()` below.
 */
export function DocumentUpload({
  ownerType,
  ownerId,
  label,
  hint,
  document: existing,
  onFileStaged,
  onUploaded,
}: DocumentUploadProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ phase: "idle" });
  const [stagedFile, setStagedFile] = useState<File | null>(null);

  const busy =
    state.phase === "presigning" ||
    state.phase === "uploading" ||
    state.phase === "attaching";

  async function handleFile(file: File) {
    const validationError = validateUploadFile(file);
    if (validationError) {
      setState({ phase: "error", message: validationError });
      return;
    }

    // Deferred mode — hold the file; the create form uploads it once the
    // record (and therefore a real ownerId) exists.
    if (ownerId === null) {
      setStagedFile(file);
      setState({ phase: "idle" });
      onFileStaged?.(file);
      return;
    }

    try {
      setState({ phase: "presigning" });
      const presigned = await postJson<PresignUploadResult>(
        "/api/v1/documents/presign-upload",
        {
          ownerType,
          ownerId,
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        },
      );

      setState({ phase: "uploading" });
      const putResponse = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error(`Object store rejected the upload (${putResponse.status}).`);
      }

      setState({ phase: "attaching" });
      await onUploaded?.({ storageKey: presigned.storageKey, file });

      setState({ phase: "done", fileName: file.name });
      setStagedFile(null);
    } catch (error) {
      setState({
        phase: "error",
        message:
          error instanceof ApiRequestError || error instanceof Error
            ? error.message
            : "The upload failed. Try again, or contact your administrator.",
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const attachedName = existing?.fileName ?? stagedFile?.name ?? null;

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-col gap-2xs">
        <label htmlFor={inputId} className="text-body-sm font-medium text-text">
          {label}
        </label>
        <p id={`${inputId}-hint`} className="text-caption text-muted">
          {hint ? `${hint} ` : ""}
          {ALLOWED_UPLOAD_TYPES_LABEL}, up to 20 MB.
        </p>
      </div>

      {existing ? (
        /* Stacked rather than a single row: this control is used both in a
           full-width panel and in a 20rem sidebar, and a row layout collapses
           the filename to two characters in the narrow case. */
        <div className="rounded-md border border-border bg-surface-sunken px-md py-sm">
          <p className="flex items-start gap-sm text-body-sm font-medium text-text">
            <PaperclipIcon className="mt-[3px] shrink-0 text-muted" />
            <span className="min-w-0 break-all">{existing.fileName}</span>
          </p>
          <p className="mt-2xs font-data text-caption tabular-nums text-muted">
            {formatFileSize(existing.sizeBytes)} · uploaded{" "}
            {formatDateTime(existing.uploadedAt)} by {existing.uploadedBy}
          </p>
          {/* Download goes through `GET /api/v1/documents/{id}/presign-download`
              (exists since Phase 1). It fails closed until the owning module
              registers a `DocumentDownloadAuthzChecker` for this ownerType —
              see the TODO block at the bottom of this file. */}
          <a
            href={`/api/v1/documents/${existing.id}/presign-download`}
            className="-ml-xs mt-2xs inline-flex min-h-11 items-center gap-xs rounded-sm px-xs text-body-sm font-medium text-accent-ink underline decoration-transparent underline-offset-2 transition-colors duration-100 ease-move hover:decoration-current"
          >
            <DownloadIcon />
            Download
          </a>
        </div>
      ) : (
        stagedFile && (
          <div className="flex flex-wrap items-center gap-md rounded-md border border-dashed border-border-strong bg-surface-sunken px-md py-sm">
            <PaperclipIcon className="shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-sm font-medium text-text">
                {stagedFile.name}
              </p>
              <p className="font-data text-caption tabular-nums text-muted">
                {formatFileSize(stagedFile.size)} · uploads when you save this
                record
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStagedFile(null);
                onFileStaged?.(null);
              }}
              className="min-h-11 rounded-sm px-sm text-body-sm font-medium text-accent-ink"
            >
              Remove
            </button>
          </div>
        )
      )}

      <div className="flex flex-wrap items-center gap-md">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={UPLOAD_ACCEPT}
          aria-describedby={`${inputId}-hint`}
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
          className="sr-only"
        />
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={() => inputRef.current?.click()}
          className={BUTTON}
        >
          <PaperclipIcon />
          {busy
            ? PHASE_LABEL[state.phase]
            : attachedName
              ? "Replace file"
              : "Choose file"}
        </button>

        {state.phase === "done" && (
          <span className="text-body-sm text-success-ink">
            {state.fileName} uploaded.
          </span>
        )}
      </div>

      <LiveRegion>
        {state.phase === "error" && (
          <InlineBanner
            tone="error"
            title="That file wasn’t uploaded"
            onDismiss={() => setState({ phase: "idle" })}
          >
            {state.message}
          </InlineBanner>
        )}
      </LiveRegion>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * BACKEND HAND-OFF — document persistence
 *
 * TODO(backend): the presigned upload (steps 1-2) is real; step 3 — the
 * caller creating the `Document` row for `storageKey` via `onUploaded` — is
 * wired up per owner type as the ProjectFlow domain routes land. Each owner
 * type also needs a `DocumentDownloadAuthzChecker` registered at boot
 * (`instrumentation.ts`) or the Download link above 403s — `lib/documents.ts`
 * fails closed for any `DocumentOwnerType` with no checker registered.
 * ────────────────────────────────────────────────────────────────────────── */
