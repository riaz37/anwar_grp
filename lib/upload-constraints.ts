/**
 * Client-side mirror of the upload allowlist in `lib/documents.ts`.
 *
 * `lib/documents.ts` is `server-only` (it constructs an S3 client from
 * credentials), so the browser cannot import it. These constants exist purely
 * to fail fast in the file picker before a pointless round trip — the server
 * remains the only real boundary, and it revalidates every request.
 *
 * If `ALLOWED_CONTENT_TYPES` or `MAX_UPLOAD_SIZE_BYTES` change in
 * `lib/documents.ts`, change them here too. `GET /api/v1/documents/presign-upload`
 * already returns both values, so a future refactor can fetch them once at app
 * start instead of duplicating; kept static for now to avoid a request on
 * every form mount.
 */

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

/** `accept` attribute value for a file input, extensions included so the OS
 *  picker filters correctly even when it does not map MIME types. */
export const UPLOAD_ACCEPT = [
  ...ALLOWED_UPLOAD_TYPES,
  ".pdf",
  ".doc",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
].join(",");

export const ALLOWED_UPLOAD_TYPES_LABEL = "PDF, Word, PNG, JPEG or WebP";

export function validateUploadFile(file: File): string | null {
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
    return `“${file.name}” is a ${file.type || "unrecognised"} file. Upload a ${ALLOWED_UPLOAD_TYPES_LABEL} file instead.`;
  }
  if (file.size <= 0) {
    return `“${file.name}” is empty. Check the file and try again.`;
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `“${file.name}” is larger than the 20 MB limit. Compress it or upload a shorter version.`;
  }
  return null;
}
