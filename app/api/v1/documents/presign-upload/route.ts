import { NextRequest } from "next/server";
import { z } from "zod";
import { DocumentOwnerType } from "@prisma/client";
import { requireAuth } from "@/lib/authz";
import {
  presignUpload,
  isAuthorizedForDocumentOwner,
  DocumentValidationError,
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/documents";
import { writeAudit } from "@/lib/audit";
import { ok, fail, handleRouteError } from "@/lib/api-response";

const presignUploadSchema = z.object({
  ownerType: z.nativeEnum(DocumentOwnerType),
  ownerId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_SIZE_BYTES),
});

/**
 * POST /api/v1/documents/presign-upload
 *
 * Authz: same owning-entity check as the download side
 * (isAuthorizedForDocumentOwner) — without it, any authenticated user
 * could get a presigned PUT into another project's storage namespace
 * (buildStorageKey scopes by ownerId) even though they can't see that
 * project anywhere else in the app.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = presignUploadSchema.parse(await req.json());

    const authorized = await isAuthorizedForDocumentOwner({
      user,
      ownerType: body.ownerType,
      ownerId: body.ownerId,
    });
    if (!authorized) {
      return fail(
        "FORBIDDEN",
        "You are not authorized to upload documents for this record.",
        403,
      );
    }

    const result = await presignUpload(body);

    await writeAudit({
      actorId: user.userId,
      action: "DOCUMENT_PRESIGN_UPLOAD",
      entityType: body.ownerType,
      entityId: body.ownerId,
      metadata: {
        storageKey: result.storageKey,
        fileName: body.fileName,
        contentType: body.contentType,
        sizeBytes: body.sizeBytes,
      },
    });

    return ok(result);
  } catch (err) {
    if (err instanceof DocumentValidationError) {
      return fail("DOCUMENT_VALIDATION_ERROR", err.message, 400);
    }
    return handleRouteError(err);
  }
}

// Surface the allowlist for client-side pre-validation (UX only —
// server-side validation above is the real boundary).
export async function GET() {
  return ok({
    allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
    maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
  });
}
