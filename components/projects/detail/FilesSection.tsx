"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DocumentUpload } from "@/components/ui/DocumentUpload";
import { DownloadIcon, PaperclipIcon } from "@/components/ui/icons";
import { InlineBanner, LiveRegion } from "@/components/ui/InlineBanner";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { ApiRequestError, postJson } from "@/lib/api-client";
import type { DocumentView } from "../types";
import { Block, Empty, Num, ROW, RowList } from "./chrome";

interface PresignDownloadResult {
  downloadUrl: string;
  expiresInSeconds: number;
}

export function FilesSection({
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
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn’t generate a download link.",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Block
      id="files"
      eyebrow="Evidence"
      title="Attached files"
      count={documents.length}
    >
      <LiveRegion>
        {error && (
          <div className="mb-ds-2xl">
            <InlineBanner
              tone="error"
              title="Download failed"
              onDismiss={() => setError(null)}
            >
              {error}
            </InlineBanner>
          </div>
        )}
      </LiveRegion>

      <div className="max-w-[36rem]">
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
      </div>

      <div className="mt-ds-7xl">
        {documents.length === 0 ? (
          <Empty title="No files attached yet">
            Attach the artefacts a stage gate asks for: the requirements
            document, the design, the test results, the UAT sign-off. Anyone with
            access to this project can open them from here.
          </Empty>
        ) : (
          <RowList>
            {documents.map((d) => (
              <li key={d.id} className={ROW}>
                <PaperclipIcon className="shrink-0 text-text-low" aria-hidden="true" />
                <span
                  className="min-w-[12rem] flex-1 truncate font-medium text-text-high"
                  title={d.fileName}
                >
                  {d.fileName}
                </span>
                <span className="whitespace-nowrap font-data text-caption-2 tabular-nums text-text-low">
                  {formatFileSize(d.sizeBytes)}
                </span>
                <span className="whitespace-nowrap text-caption-2 text-muted-foreground">
                  {d.uploadedBy} · <Num>{formatDateTime(d.uploadedAt)}</Num>
                </span>
                {/* The row's only action, in the accent ink so it reads as the
                    actionable thing in an otherwise inert row. A real `Button`
                    so it keeps the shared focus ring and 44px hit area. */}
                <Button
                  variant="ghost"
                  onClick={() => handleDownload(d.id)}
                  disabled={downloadingId === d.id}
                  aria-busy={downloadingId === d.id}
                  title={`Download ${d.fileName}`}
                  className="shrink-0 text-primary-high hover:bg-primary-wash hover:text-primary-high disabled:cursor-progress"
                >
                  <DownloadIcon aria-hidden="true" />
                  <span className="sr-only">
                    {downloadingId === d.id
                      ? `Preparing download for ${d.fileName}`
                      : `Download ${d.fileName}`}
                  </span>
                </Button>
              </li>
            ))}
          </RowList>
        )}
      </div>
    </Block>
  );
}
