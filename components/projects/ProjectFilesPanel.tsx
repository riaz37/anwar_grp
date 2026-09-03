"use client";

import { useState } from "react";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import { DownloadIcon, PaperclipIcon } from "@/components/ui/icons";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { ApiRequestError, postJson } from "@/lib/api-client";
import type { DocumentView } from "./types";

interface PresignDownloadResult {
  downloadUrl: string;
  expiresInSeconds: number;
}

export function ProjectFilesPanel({
  projectId,
  documents,
  onChanged,
}: {
  projectId: string;
  documents: DocumentView[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(documentId: string) {
    setDownloadingId(documentId);
    setError(null);
    try {
      const response = await fetch(`/api/v1/documents/${documentId}/presign-download`);
      const envelope = await response.json();
      if (!response.ok || !envelope.success) {
        throw new ApiRequestError(
          envelope.error?.message ?? "Couldn’t generate a download link.",
          response.status,
          envelope.error?.code ?? "UNKNOWN_ERROR",
        );
      }
      const result = envelope.data as PresignDownloadResult;
      window.open(result.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn’t generate a download link.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-lg">
      <LiveRegion>
        {error && (
          <InlineBanner tone="error" title="Download failed">
            {error}
          </InlineBanner>
        )}
      </LiveRegion>
      <DocumentUpload
        ownerType="PROJECT"
        ownerId={projectId}
        label="Attach a file"
        hint="Requirements, designs, test results, UAT feedback, approvals, or final documentation."
        onUploaded={async ({ storageKey, file }) => {
          await postJson("/api/v1/documents", {
            ownerType: "PROJECT",
            ownerId: projectId,
            storageKey,
            fileName: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          });
          onChanged();
        }}
      />

      {documents.length === 0 ? (
        <p className="text-body-sm text-muted">No files attached yet.</p>
      ) : (
        <ul className="flex flex-col gap-xs">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-sm rounded-md border border-border px-md py-sm text-body-sm"
            >
              <PaperclipIcon className="shrink-0 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium text-text">{d.fileName}</span>
              <span className="text-caption text-muted">{formatFileSize(d.sizeBytes)}</span>
              <span className="text-caption text-muted">
                {d.uploadedBy} — {formatDateTime(d.uploadedAt)}
              </span>
              <button
                type="button"
                onClick={() => handleDownload(d.id)}
                disabled={downloadingId === d.id}
                className="inline-flex min-h-11 items-center gap-xs rounded-sm px-sm text-body-sm font-medium text-accent-ink hover:bg-accent-soft disabled:cursor-progress disabled:opacity-60"
              >
                <DownloadIcon aria-hidden="true" />
                <span className="sr-only">Download {d.fileName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
