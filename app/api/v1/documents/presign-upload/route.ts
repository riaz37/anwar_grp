import { NextRequest } from "next/server";
import { z } from "zod";
import { DocumentOwnerType } from "@prisma/client";
import { requireAuth } from "@/lib/authz";
import {
  presignUpload,
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
 * Authz: any authenticated user may request an upload URL — Phase 1
 * has no owning-entity model to check ownership against yet (see
 * lib/documents.ts doc comment on the download side's pluggable
 * checker). Later phases may want to tighten this to
 * requireRole([...]) per ownerType once Requisition/Candidate/etc.
 * exist; tracked as a follow-up, not a Phase 1 gap, since the actual
 * DB write (creating the Document row once upload completes) happens
 * in whichever module owns that entity and can apply its own rules.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = presignUploadSchema.parse(await req.json());

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
