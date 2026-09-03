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
 * Document download authorization.
 *
 * BUILD_PLAN.md Sec 2.6: "download checks the requester's
 * authorization for the owning entity before issuing a presigned GET —
 * document access inherits the same break-glass/RBAC rules as the
 * record it belongs to."
 *
 * `DocumentOwnerType` has exactly one member (`PROJECT`) in this
 * domain, so the rule is inlined directly rather than routed through a
 * runtime-registered checker map. (An earlier version of this file
 * used a pluggable `Map` populated by `instrumentation.ts`'s boot
 * hook — for a prior multi-owner-type domain that pattern made sense,
 * but under Next's dev-mode module isolation the `instrumentation.ts`
 * module instance and the route handler's module instance of this
 * file are NOT guaranteed to be the same object, so the map populated
 * at boot was never the map read from a request — every download was
 * silently denied. Found by /qa 2026-09-03, fixed by removing the
 * indirection instead of chasing module-identity timing.)
 */
export async function isAuthorizedToDownload(params: {
  user: SessionPayload;
  ownerType: DocumentOwnerType;
  ownerId: string;
}): Promise<boolean> {
  if (params.ownerType !== "PROJECT") {
    // Fail closed: no rule exists for any other owner type.
    return false;
  }

  const { prisma } = await import("./prisma");
  const { isProjectParticipant } = await import("./project-authz");

  if (params.user.role === "AI_TEAM_LEAD" || params.user.role === "MANAGEMENT") {
    return true;
  }

  const project = await prisma.project.findUnique({
    where: { id: params.ownerId },
    select: {
      ownerId: true,
      analystId: true,
      developerId: true,
      departmentId: true,
    },
  });
  if (!project) return false;
  return isProjectParticipant(params.user, project);
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
