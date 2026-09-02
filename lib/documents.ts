import "server-only";
import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { DocumentOwnerType } from "@prisma/client";
import type { SessionPayload } from "./session";

const PRESIGN_UPLOAD_TTL_SECONDS = 5 * 60; // 5 minutes
const PRESIGN_DOWNLOAD_TTL_SECONDS = 5 * 60;

// Allowlist for Phase 1: CV/ERF/RRF/assessment docs and images. Extend
// per-module as later phases add specific document types.
export const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getS3Client(): S3Client {
  return new S3Client({
    endpoint: requireEnv("S3_ENDPOINT"),
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    },
  });
}

function getBucket(): string {
  return requireEnv("S3_BUCKET");
}

export class DocumentValidationError extends Error {}

export interface PresignUploadInput {
  ownerType: DocumentOwnerType;
  ownerId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface PresignUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

function validateUploadRequest(input: PresignUploadInput): void {
  if (!ALLOWED_CONTENT_TYPES.has(input.contentType)) {
    throw new DocumentValidationError(
      `Content type "${input.contentType}" is not allowed. Allowed: ${[
        ...ALLOWED_CONTENT_TYPES,
      ].join(", ")}`,
    );
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    throw new DocumentValidationError(
      `File size ${input.sizeBytes} bytes exceeds the ${MAX_UPLOAD_SIZE_BYTES} byte limit (or is non-positive).`,
    );
  }
  if (!input.fileName || input.fileName.length > 255) {
    throw new DocumentValidationError("Invalid file name.");
  }
}

function buildStorageKey(input: PresignUploadInput): string {
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${input.ownerType.toLowerCase()}/${input.ownerId}/${randomUUID()}-${safeName}`;
}

/**
 * Issues a presigned S3/MinIO PUT URL after validating file type and
 * size against the allowlist. Caller is responsible for creating the
 * Document row (with the returned storageKey) once the client
 * confirms the upload succeeded — this function does not touch the DB,
 * so it stays reusable outside of a route handler if needed.
 */
export async function presignUpload(
  input: PresignUploadInput,
): Promise<PresignUploadResult> {
  validateUploadRequest(input);

  const storageKey = buildStorageKey(input);
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_UPLOAD_TTL_SECONDS,
  });

  return {
    uploadUrl,
    storageKey,
    expiresInSeconds: PRESIGN_UPLOAD_TTL_SECONDS,
  };
}

/**
 * Pluggable authorization hook for document downloads.
 *
 * BUILD_PLAN.md Sec 2.6: "download checks the requester's
 * authorization for the owning entity before issuing a presigned GET —
 * document access inherits the same break-glass/RBAC rules as the
 * record it belongs to."
 *
 * Phase 1 only has auth/org models — there is no Requisition/
 * Candidate/Application/etc. to check ownership against yet. Each
 * later module that owns a DocumentOwnerType (CANDIDATE, APPLICATION,
 * REQUISITION, SCREENING_ASSESSMENT, EVALUATION,
 * JOINING_CHECKLIST_ITEM) MUST register a checker here before its
 * documents can be safely downloaded. Until a checker is registered
 * for a given ownerType, downloads for that type are denied by
 * default (fail closed, not fail open).
 *
 * A checker receives the requesting user's session and the Document's
 * owner (type + id) and returns true if that user may download it.
 * It should itself account for break-glass/ConfidentialDataGrant logic
 * once that lands (Sec 2.5) — this hook is just the seam later modules
 * plug into.
 */
export type DocumentDownloadAuthzChecker = (params: {
  user: SessionPayload;
  ownerType: DocumentOwnerType;
  ownerId: string;
}) => Promise<boolean> | boolean;

const downloadAuthzCheckers = new Map<
  DocumentOwnerType,
  DocumentDownloadAuthzChecker
>();

/** Called by a later module's init code to register its authz rule. */
export function registerDocumentDownloadAuthzChecker(
  ownerType: DocumentOwnerType,
  checker: DocumentDownloadAuthzChecker,
): void {
  downloadAuthzCheckers.set(ownerType, checker);
}

export async function isAuthorizedToDownload(params: {
  user: SessionPayload;
  ownerType: DocumentOwnerType;
  ownerId: string;
}): Promise<boolean> {
  const checker = downloadAuthzCheckers.get(params.ownerType);
  if (!checker) {
    // Fail closed: no owning module has registered a rule yet for
    // this ownerType, so nobody (not even TA_ADMIN) can download.
    return false;
  }
  return checker(params);
}

export interface PresignDownloadResult {
  downloadUrl: string;
  expiresInSeconds: number;
}

/**
 * Issues a presigned S3/MinIO GET URL for storageKey. Callers MUST
 * have already authorized the request (see isAuthorizedToDownload)
 * before calling this — this function itself does not check
 * authorization, it only talks to the object store.
 */
export async function presignDownload(
  storageKey: string,
): Promise<PresignDownloadResult> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: storageKey,
  });

  const downloadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_DOWNLOAD_TTL_SECONDS,
  });

  return { downloadUrl, expiresInSeconds: PRESIGN_DOWNLOAD_TTL_SECONDS };
}
