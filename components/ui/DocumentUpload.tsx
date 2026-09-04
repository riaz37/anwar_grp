"use client";

import { useCallback, useId, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { DocumentOwnerType } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/primitives/progress";
import { ApiRequestError, postJson } from "@/lib/api-client";
import { formatDateTime, formatFileSize } from "@/lib/format";
import {
  ALLOWED_UPLOAD_TYPES_LABEL,
  UPLOAD_ACCEPT,
  validateUploadFile,
} from "@/lib/upload-constraints";
import { cn } from "@/lib/utils";
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

const PHASE_LABEL: Record<UploadState["phase"], string> = {
  idle: "",
  presigning: "Preparing upload",
  uploading: "Uploading",
  attaching: "Linking to record",
  error: "",
  done: "",
};

/**
 * `PUT` the bytes with `XMLHttpRequest` rather than `fetch`.
 *
 * `fetch` still has no upload-progress event in any shipping browser
 * (`ReadableStream` request bodies are Chromium-only and need HTTP/2), so a
 * progress bar driven by `fetch` can only ever be a fake animation. A 20 MB
 * scan on a site link takes long enough that a fake bar is a lie worth
 * avoiding.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(`The object store rejected the upload (${xhr.status}).`));
    });
    xhr.addEventListener("error", () =>
      reject(new Error("The connection dropped while the file was uploading.")),
    );
    xhr.addEventListener("abort", () =>
      reject(new Error("The upload was cancelled.")),
    );

    xhr.send(file);
  });
}

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
 * Upload control backed by the **real** presigned-URL flow (BUILD_PLAN.md
 * Sec 2.6: never a public bucket, never a DB blob):
 *
 *   1. `POST /api/v1/documents/presign-upload` gives `{ uploadUrl, storageKey }`
 *   2. `PUT uploadUrl` with the raw file body and its `Content-Type`
 *   3. tell the owning module to create the `Document` row for `storageKey`
 *
 * Steps 1 and 2 run for real here. Step 3 is the module-owned write; see the
 * hand-off note at the bottom of this file.
 *
 * The drop zone is a real one: `dragenter`/`dragover`/`dragleave`/`drop` are
 * all handled, the depth counter below stops the highlight flickering as the
 * pointer crosses child elements, and the underlying `<input type="file">`
 * stays in the DOM as the keyboard and screen-reader path. Drag-and-drop is
 * an accelerator layered on top of it, never the only way in.
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
  /* Real byte-level figure from the XHR progress event. Held outside `state`
     so it survives the transition into `attaching`: the bar holds at its last
     measured value instead of snapping back to zero for the final round-trip. */
  const [percent, setPercent] = useState(0);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  /* `dragenter` fires again for every descendant the pointer crosses, and the
     matching `dragleave` fires for the one it left. Counting depth instead of
     toggling a boolean is what keeps the zone from strobing. */
  const dragDepth = useRef(0);
  const [dragActive, setDragActive] = useState(false);

  const busy =
    state.phase === "presigning" ||
    state.phase === "uploading" ||
    state.phase === "attaching";

  const handleFile = useCallback(
    async function handleFile(file: File) {
      const validationError = validateUploadFile(file);
      if (validationError) {
        setState({ phase: "error", message: validationError });
        return;
      }

      // Deferred mode: hold the file; the create form uploads it once the
      // record (and therefore a real ownerId) exists.
      if (ownerId === null) {
        setStagedFile(file);
        setState({ phase: "idle" });
        onFileStaged?.(file);
        return;
      }

      try {
        setPercent(0);
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
        await putWithProgress(presigned.uploadUrl, file, setPercent);

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
    },
    [ownerType, ownerId, onFileStaged, onUploaded],
  );

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (busy) return;
    dragDepth.current += 1;
    setDragActive(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    /* Without this the browser navigates to the file instead of dropping it.
       `dropEffect` makes the cursor say "copy" rather than "move". */
    event.preventDefault();
    if (!busy) event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const attachedName = existing?.fileName ?? stagedFile?.name ?? null;

  return (
    <div className="flex flex-col gap-ds-md">
      <div className="flex flex-col gap-ds-xxs">
        <label htmlFor={inputId} className="text-body-1 font-medium text-text-high">
          {label}
        </label>
        <p id={`${inputId}-hint`} className="text-caption-2 text-text-low">
          {hint ? `${hint} ` : ""}
          {ALLOWED_UPLOAD_TYPES_LABEL}, up to 20 MB.
        </p>
      </div>

      {existing ? (
        /* Stacked rather than a single row: this control is used both in a
           full-width panel and in a 20rem sidebar, and a row layout collapses
           the filename to two characters in the narrow case. */
        <div className="rounded-lg border border-outline-low bg-surface-2 px-ds-2xl py-ds-md">
          <p className="flex items-start gap-ds-md text-body-1 font-medium text-text-high">
            <PaperclipIcon className="mt-[3px] shrink-0 text-text-low" />
            <span className="min-w-0 break-all">{existing.fileName}</span>
          </p>
          <p className="mt-ds-xxs font-data text-caption-2 tabular-nums text-text-low">
            {formatFileSize(existing.sizeBytes)} · uploaded{" "}
            {formatDateTime(existing.uploadedAt)} by {existing.uploadedBy}
          </p>
          {/* Download goes through `GET /api/v1/documents/{id}/presign-download`.
              It fails closed until the owning module registers a
              `DocumentDownloadAuthzChecker` for this ownerType; see the
              hand-off note at the bottom of this file. */}
          <a
            href={`/api/v1/documents/${existing.id}/presign-download`}
            className="-ml-ds-xs mt-ds-xxs inline-flex min-h-11 items-center gap-ds-xs rounded-sm px-ds-xs text-body-1 font-medium text-primary-high underline decoration-transparent underline-offset-2 transition-colors duration-100 ease-move hover:decoration-current"
          >
            <DownloadIcon />
            Download
          </a>
        </div>
      ) : (
        stagedFile && (
          <div className="flex flex-wrap items-center gap-ds-2xl rounded-lg border border-dashed border-outline-high bg-surface-2 px-ds-2xl py-ds-md">
            <PaperclipIcon className="shrink-0 text-text-low" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-1 font-medium text-text-high">
                {stagedFile.name}
              </p>
              <p className="font-data text-caption-2 tabular-nums text-text-low">
                {formatFileSize(stagedFile.size)} · uploads when you save this
                record
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setStagedFile(null);
                onFileStaged?.(null);
              }}
            >
              Remove
              <span className="sr-only"> {stagedFile.name}</span>
            </Button>
          </div>
        )
      )}

      {/* The drop zone. Not focusable itself: the input inside it is the
          keyboard path, and a second tab stop that only accepts a pointer
          gesture would be a trap for a keyboard user. */}
      <div
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-drag-active={dragActive || undefined}
        className={cn(
          "flex flex-col gap-ds-md rounded-lg border border-dashed px-ds-2xl py-ds-2xl",
          "transition-colors duration-100 ease-move",
          dragActive
            ? "border-primary-med bg-primary-wash"
            : "border-outline-high bg-surface-0",
        )}
      >
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

        <div className="flex flex-wrap items-center gap-ds-2xl">
          <Button
            variant="secondary"
            disabled={busy}
            aria-busy={busy}
            onClick={() => inputRef.current?.click()}
          >
            <PaperclipIcon />
            {busy
              ? `${PHASE_LABEL[state.phase]}…`
              : attachedName
                ? "Replace file"
                : "Choose file"}
          </Button>

          <p className="text-body-1 text-text-low">
            {dragActive ? (
              <span className="font-medium text-primary-high">
                Release to attach
              </span>
            ) : (
              <>
                or drop a file here
                {/* `pointer: coarse` devices have no drag gesture to offer. */}
                <span className="sr-only">
                  , if your device supports dragging files
                </span>
              </>
            )}
          </p>

          {/* Success needs its own announcement: the `LiveRegion` below only
              ever holds the error banner. The region is always mounted and
              only its text changes, for the same reason `LiveRegion` is: a
              live region that mounts alongside its message is usually not
              announced. */}
          <span
            role="status"
            className="text-body-1 text-success-high empty:hidden"
          >
            {state.phase === "done" ? `${state.fileName} uploaded.` : ""}
          </span>
        </div>

        {busy && (
          <div className="flex flex-col gap-ds-xs">
            <div className="flex items-baseline justify-between gap-ds-md">
              <span className="text-caption-2 text-text-low">
                {PHASE_LABEL[state.phase]}
              </span>
              {state.phase === "uploading" && (
                <span className="font-data text-caption-2 tabular-nums text-text-low">
                  {percent}%
                </span>
              )}
            </div>
            {/* The value is measured, never simulated. The presign and attach
                round-trips have no measurable progress, so the bar holds at
                its last real value rather than inventing motion. */}
            <Progress
              value={percent}
              aria-label={PHASE_LABEL[state.phase]}
              className="h-1 bg-outline-low"
            />
          </div>
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
 * BACKEND HAND-OFF: document persistence
 *
 * TODO(backend): the presigned upload (steps 1-2) is real; step 3, the caller
 * creating the `Document` row for `storageKey` via `onUploaded`, is wired up
 * per owner type as the ProjectFlow domain routes land. Each owner type also
 * needs a `DocumentDownloadAuthzChecker` registered at boot
 * (`instrumentation.ts`) or the Download link above 403s: `lib/documents.ts`
 * fails closed for any `DocumentOwnerType` with no checker registered.
 * ────────────────────────────────────────────────────────────────────────── */
